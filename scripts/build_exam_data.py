"""Convert JLPT_N3_tu_vung_Minchan.docx into the exam JSON used by the frontend.

Usage (from the repo root):
    pip install python-docx
    python3 scripts/build_exam_data.py [path/to/docx] [path/to/output.json]

Each question keeps the underlined word of the original sentence (`target`) so the
UI can render it like the real JLPT paper. Blank questions (（　　）) have an empty
`target`. Answers come from the answer tables at the end of the document; answers
marked with `*` there are flagged as `inferred`.
"""

import json
import re
import sys
from pathlib import Path

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "JLPT_N3_tu_vung_Minchan.docx"
DEFAULT_OUTPUT = ROOT / "frontend" / "src" / "data" / "jlpt_n3_minchan_exam.json"

BLANK = "（　　）"
QUESTION_RE = re.compile(r"^(\d+)）")
OPTION_RE = re.compile(r"^\s*([1-4])\.\s*(.+?)\s*$")
LESSON_RE = re.compile(r"^BÀI\s+(\d+)$")
NOTE_RE = re.compile(r"（(Gợi ý:.*)）\s*$")

PART_BY_INSTRUCTION = [
    ("読み方", "kanji-reading"),
    ("漢字で書く", "orthography"),
    ("に入れる", "context"),
    ("意味が最も近い", "paraphrase"),
]


def detect_part(instruction: str) -> str:
    for marker, part in PART_BY_INSTRUCTION:
        if marker in instruction:
            return part
    raise ValueError(f"Unknown section instruction: {instruction}")


def split_sentence(paragraph: Paragraph) -> tuple[str, str, str]:
    """Split a question paragraph into (before, target, after) around the underline or blank."""
    runs = [(run.text, bool(run.underline)) for run in paragraph.runs]
    underlined = [i for i, (_, underline) in enumerate(runs) if underline]

    if underlined:
        first, last = underlined[0], underlined[-1]
        before = "".join(text for text, _ in runs[:first])
        target = "".join(text for text, _ in runs[first : last + 1])
        after = "".join(text for text, _ in runs[last + 1 :])
        # Keep surrounding spaces outside of the underline.
        stripped = target.strip()
        lead = target[: len(target) - len(target.lstrip())]
        trail = target[len(target.rstrip()) :]
        return before + lead, stripped, trail + after

    text = paragraph.text
    if text.count(BLANK) != 1:
        raise ValueError(f"Question has neither underline nor a single blank: {text}")
    before, after = text.split(BLANK)
    return before, "", after


def parse_options(text: str) -> list[tuple[int, str]]:
    options = []
    for chunk in text.split("\t"):
        if not chunk.strip():
            continue
        match = OPTION_RE.match(chunk)
        if not match:
            raise ValueError(f"Cannot parse option chunk: {chunk!r} in {text!r}")
        options.append((int(match.group(1)), match.group(2)))
    return options


def parse_answer_table(table: Table, lesson: int, answers: dict) -> None:
    rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
    for numbers, values in zip(rows[0::2], rows[1::2]):
        for number, value in zip(numbers, values):
            if not number:
                continue
            answers[(lesson, int(number))] = (int(value.rstrip("*")), value.endswith("*"))


def iter_blocks(document):
    for child in document.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            yield Paragraph(child, document)
        elif tag == "tbl":
            yield Table(child, document)


def parse(source: Path) -> dict:
    document = docx.Document(str(source))
    questions: list[dict] = []
    answers: dict[tuple[int, int], tuple[int, bool]] = {}

    in_answer_key = False
    lesson = None
    part = None
    current = None

    for block in iter_blocks(document):
        if isinstance(block, Table):
            if in_answer_key:
                parse_answer_table(block, lesson, answers)
            continue

        text = block.text.strip()
        style = block.style.name if block.style is not None else ""
        if not text:
            continue

        if style.startswith("Heading"):
            if text == "ĐÁP ÁN":
                in_answer_key = True
                continue
            match = LESSON_RE.match(text)
            if match:
                lesson = int(match.group(1))
            continue

        if in_answer_key or lesson is None:
            continue

        if text.startswith("問題"):
            part = detect_part(text)
            continue

        match = QUESTION_RE.match(text)
        if match:
            before, target, after = split_sentence(block)
            before = QUESTION_RE.sub("", before.lstrip(), count=1)
            note = None
            note_match = NOTE_RE.search(after)
            if note_match:
                note = note_match.group(1).strip()
                after = after[: note_match.start()]
            current = {
                "id": f"b{lesson}-{match.group(1)}",
                "lesson": lesson,
                "number": int(match.group(1)),
                "part": part,
                "before": before.lstrip(),
                "target": target,
                "after": after.rstrip(),
                "options": [],
            }
            if note:
                current["note"] = note
            questions.append(current)
            continue

        if current is not None and OPTION_RE.match(text.split("\t")[0]):
            for index, option in parse_options(text):
                if index != len(current["options"]) + 1:
                    raise ValueError(f"Options out of order in {current['id']}: {text!r}")
                current["options"].append(option)

    for question in questions:
        if len(question["options"]) != 4:
            raise ValueError(f"{question['id']} has {len(question['options'])} options")
        key = (question["lesson"], question["number"])
        if key not in answers:
            raise ValueError(f"Missing answer for {question['id']}")
        answer, inferred = answers[key]
        question["answer"] = answer - 1
        question["inferred"] = inferred

    return {
        "title": "JLPT N3 – 文字・語彙 練習問題",
        "source": "Từ vựng N3 – Học cùng Minchan",
        "questions": questions,
    }


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    data = parse(source)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    counts: dict[str, int] = {}
    for question in data["questions"]:
        counts[question["part"]] = counts.get(question["part"], 0) + 1
    print(f"Wrote {len(data['questions'])} questions to {output}: {counts}")


if __name__ == "__main__":
    main()
