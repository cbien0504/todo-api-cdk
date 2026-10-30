"""Crawl the JLPT vocabulary quizzes of jtest.net into the exam JSON used by the frontend.

Usage (from the repo root):
    python3 scripts/crawl_jtest_quiz.py LEVEL [path/to/output.json]     # LEVEL: n5, n4, n3, n2, n1

The index page https://jtest.net/jlpt/<level>/vocabulary links the quizzes (Quiz 1, Quiz 2…).
A quiz page shows its questions without answers: the crawler submits it unanswered, like
a visitor would, and reads the correct option (check mark) and the explanation of every
question from the result page. Pages are fetched one at a time with a short pause.

Questions are fill-in-the-blank (（　　　）, part `context`), synonym of the underlined word
(`paraphrase`) or the sentence that uses a word correctly (`usage`, the word alone is
the question). The output has the format of scripts/build_exam_data.py, plus the
explanation of the site: the word with its reading and meaning, the sentence in
Vietnamese and other words of the sentence.
"""

import html
import http.cookiejar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "frontend" / "src" / "data"
BASE_URL = "https://jtest.net"
USER_AGENT = "Mozilla/5.0 (compatible; mimikara-vocab-crawler)"
PAUSE_SECONDS = 1.0

BLANK = "（　　　）"
TOKEN_RE = re.compile(r'name="_token" value="([^"]+)"')
ASK_RE = re.compile(r'type="radio" hidden name="ask\[(\d+)\]"')
QUESTION_RE = re.compile(r"<h5><b>問\s*(\d+)</b>(.*?)</h5>(.*?)(?=<hr>|<div class=\"submit-container\">)", re.S)
OPTION_RE = re.compile(r'<label class="form-check-label([^"]*)"[^>]*>\s*<span class="ml-1">\s*(\d)　(.*?)</span>(.*?)</label>', re.S)
UNDERLINE_RE = re.compile(r'\s?<span class="border-bottom[^"]*">(.*?)</span>\s?', re.S)
EXPLANATION_RE = re.compile(r'id="answerDetailArea"[^>]*>(.*?)</div>', re.S)
EXPLANATION_SPLIT_RE = re.compile(r"<p><strong>問\s*(\d+)</strong></p>")
PARAGRAPH_RE = re.compile(r"<p>(.*?)</p>", re.S)
BREAK_RE = re.compile(r"<br\s*/?>")
SUP_RE = re.compile(r"<sup>(.*?)</sup>", re.S)
TAG_RE = re.compile(r"<[^>]+>")


def text_of(fragment: str) -> str:
    # Only ASCII spaces collapse: the blank （　　　） is written with ideographic spaces.
    return re.sub(r"[ \t\r\n\xa0]+", " ", html.unescape(TAG_RE.sub("", fragment))).strip(" ")


def parse_sentence(fragment: str) -> tuple[str, str, str, str]:
    """(part, before, target, after) of a question; the 　 after "問 n" is not part of it."""
    fragment = fragment.lstrip("　 ")
    underline = UNDERLINE_RE.search(fragment)
    if underline:
        before, after = fragment[: underline.start()], fragment[underline.end() :]
        return "paraphrase", text_of(before), text_of(underline.group(1)), text_of(after)
    text = text_of(fragment)
    if BLANK in text:
        if text.count(BLANK) != 1:
            raise ValueError(f"Question with several blanks: {text}")
        before, after = text.split(BLANK)
        return "context", before.strip(), "", after.strip()
    return "usage", "", text, ""


def parse_explanations(page: str) -> dict[int, dict]:
    """Explanation of every question number, with the correct answer it names (`正解`)."""
    area = EXPLANATION_RE.search(page)
    if not area:
        return {}
    chunks = EXPLANATION_SPLIT_RE.split(area.group(1))
    explanations = {}
    for number, body in zip(chunks[1::2], chunks[2::2]):
        paragraphs = PARAGRAPH_RE.findall(body)
        correct = text_of(paragraphs[0]).removeprefix("正解:").strip()
        explanation = {"word": "", "translation": "", "vocab": []}
        for paragraph in paragraphs[1:]:
            # Other words of the sentence, in small print: one per line or separated by 　.
            for sup in SUP_RE.findall(paragraph):
                explanation["vocab"].extend(word for word in map(text_of, re.split(r"　|<br\s*/?>", sup)) if word)
            lines = [text_of(line) for line in BREAK_RE.split(SUP_RE.sub("", paragraph)) if text_of(line)]
            if not explanation["word"] and len(lines) == 1:
                explanation["word"] = lines[0]
            elif len(lines) >= 2:
                # The Japanese sentence (the question completed), then its translation.
                explanation["translation"] = " ".join(lines[1:])
        if not explanation["vocab"]:
            del explanation["vocab"]
        explanations[int(number)] = {"correct": correct, "explanation": explanation}
    return explanations


def parse_result(page: str, quiz: int) -> list[dict]:
    explanations = parse_explanations(page)
    questions = []
    for number, sentence, body in QUESTION_RE.findall(page):
        number = int(number)
        part, before, target, after = parse_sentence(sentence)
        options, answers = [], []
        for label_class, index, option, rest in OPTION_RE.findall(body):
            if int(index) != len(options) + 1:
                raise ValueError(f"Quiz {quiz} 問{number}: options out of order")
            if "check.svg" in rest:
                answers.append(len(options))
            options.append(text_of(option))
        if len(options) != 4 or len(answers) != 1:
            raise ValueError(f"Quiz {quiz} 問{number}: {len(options)} options, {len(answers)} answers")
        question = {
            "id": f"q{quiz}-{number}",
            "lesson": quiz,
            "number": number,
            "part": part,
            "before": before,
            "target": target,
            "after": after,
            "options": options,
            "answer": answers[0],
            "inferred": False,
        }
        detail = explanations.get(number)
        if detail:
            if detail["correct"] != options[answers[0]]:
                print(f"Quiz {quiz} 問{number}: explanation names {detail['correct']!r}, answer is {options[answers[0]]!r}")
            question["explanation"] = detail["explanation"]
        questions.append(question)
    if [q["number"] for q in questions] != list(range(1, len(questions) + 1)):
        raise ValueError(f"Quiz {quiz}: questions are not numbered 1…{len(questions)}")
    return questions


class Client:
    """Fetches pages with the session cookie the quiz form needs."""

    def __init__(self) -> None:
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def fetch(self, path: str, form: list[tuple[str, str]] | None = None) -> str:
        data = urllib.parse.urlencode(form).encode() if form is not None else None
        headers = {"User-Agent": USER_AGENT, "Referer": BASE_URL + path}
        request = urllib.request.Request(BASE_URL + path, data=data, headers=headers)
        with self.opener.open(request, timeout=30) as response:
            return response.read().decode("utf-8")


def crawl_quiz(client: Client, path: str, quiz: int) -> list[dict]:
    """Submit the quiz unanswered and parse the result page."""
    page = client.fetch(path)
    token = TOKEN_RE.search(page)
    asks = sorted({int(index) for index in ASK_RE.findall(page)})
    if not token or not asks:
        raise ValueError(f"Quiz {quiz}: no form found on {path}")
    time.sleep(PAUSE_SECONDS)
    result = client.fetch(path, [("_token", token.group(1))] + [(f"ask[{index}]", "0") for index in asks])
    questions = parse_result(result, quiz)
    if len(questions) != len(asks):
        raise ValueError(f"Quiz {quiz}: parsed {len(questions)} of {len(asks)} questions")
    return questions


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    level = sys.argv[1].lower()
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DATA_DIR / f"jtest_{level}_exam.json"
    index_path = f"/jlpt/{level}/vocabulary"

    client = Client()
    index = client.fetch(index_path)
    title = text_of(re.search(r'<h1 class="bd-title">(.*?)</h1>', index, re.S).group(1))
    quizzes = sorted({int(n): path for path, n in re.findall(rf'href="({index_path}/series-\d+/quiz-(\d+))"', index)}.items())
    if not quizzes:
        raise SystemExit("No quiz links found on the index page")

    questions: list[dict] = []
    for quiz, path in quizzes:
        time.sleep(PAUSE_SECONDS)
        quiz_questions = crawl_quiz(client, path, quiz)
        parts = {}
        for question in quiz_questions:
            parts[question["part"]] = parts.get(question["part"], 0) + 1
        print(f"Quiz {quiz}: {len(quiz_questions)} câu {parts}")
        questions.extend(quiz_questions)

    data = {"title": title, "source": f"JTest.net – {BASE_URL}{index_path}", "questions": questions}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for question in questions:
        counts[question["part"]] = counts.get(question["part"], 0) + 1
    print(f"Wrote {len(questions)} questions of {len(quizzes)} quizzes to {output}: {counts}")


if __name__ == "__main__":
    main()
