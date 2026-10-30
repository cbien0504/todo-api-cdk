"""Terminal quiz of the JLPT N2 vocabulary: pick the Vietnamese meaning of a word among 4.

Usage (from the repo root):
    python3 scripts/quiz_n2.py [--an-hiragana]

Choose a chapter and a lesson (or the whole list), then answer with 1–4; q quits at any
prompt. A wrong word comes back later in the round, and after the round you can review
only the words you got wrong. Words come from frontend/src/data/jtest_n2_vocab.json
(scripts/build_vocab_data.py), Hán Việt from frontend/src/data/kanji_han_viet.json.
"""

import argparse
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DATA = ROOT / "frontend" / "src" / "data"
VOCAB_PATH = FRONTEND_DATA / "jtest_n2_vocab.json"
HAN_VIET_PATH = FRONTEND_DATA / "kanji_han_viet.json"

OPTION_COUNT = 4
KANJI = re.compile(r"[㐀-鿿豈-﫿]")
ITERATION_MARK = "々"
# Context or another spelling written in brackets by the word lists: "（お金を）下ろす", "足元（足下）".
ANNOTATION = re.compile(r"[（(][^）)]*[）)]")
CHAPTER = re.compile(r"^(Chapter\s+\d+)")

USE_COLOR = sys.stdout.isatty()


def paint(text, code):
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text


def bold(text):
    return paint(text, "1")


def dim(text):
    return paint(text, "2")


def green(text):
    return paint(text, "32")


def red(text):
    return paint(text, "31")


def han_viet(word, readings):
    """Hán Việt of the kanji of a word, e.g. "一家" → "NHẤT GIA"; empty for a kana-only word."""
    chars = []
    for char in ANNOTATION.sub("", word):
        if KANJI.match(char):
            chars.append(char)
        elif char == ITERATION_MARK and chars:
            chars.append(chars[-1])
    return " ".join(readings.get(char, "?") for char in chars)


def load_words():
    """Chapter titles keyed by "Chapter 1"…, and the words of the list without duplicates."""
    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    readings = json.loads(HAN_VIET_PATH.read_text(encoding="utf-8"))["kanji"]
    words, seen = [], set()
    for raw in data["words"]:
        kanji = (raw.get("kanji") or "").strip()
        hiragana = (raw.get("hiragana") or "").strip()
        meaning = (raw.get("meaning") or "").strip()
        word = kanji or hiragana
        if not hiragana or not meaning or (word, meaning) in seen:
            continue
        seen.add((word, meaning))
        words.append(
            {
                "word": word,
                "kanji": kanji,
                "hiragana": hiragana,
                "meaning": meaning,
                "han_viet": han_viet(kanji, readings),
                "lesson": (raw.get("lesson") or "").strip(),
            }
        )
    return data["units"], words


def group_lessons(words):
    """{"Chapter 1": {"Chapter 1 - Bài 1: Gia đình": [words…], …}, …} in the order of the list."""
    chapters = {}
    for word in words:
        match = CHAPTER.match(word["lesson"])
        chapter = match.group(1) if match else "Khác"
        chapters.setdefault(chapter, {}).setdefault(word["lesson"], []).append(word)
    return chapters


def read(prompt):
    """A line typed by the learner, lowercased; q, Ctrl+C or Ctrl+D quits."""
    try:
        value = input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        value = "q"
    if value == "q":
        print("\nTạm biệt! Hẹn gặp lại 👋")
        sys.exit(0)
    return value


def ask_number(prompt, low, high):
    while True:
        value = read(prompt)
        if value.isdigit() and low <= int(value) <= high:
            return int(value)
        print(red(f"Hãy nhập một số từ {low} đến {high} (q để thoát)."))


def choose_batch(units, chapters, all_words):
    """Title and words of the chapter, lesson or whole list chosen by the learner."""
    names = list(chapters)
    print(bold("\n📚 Chọn chương"))
    print(f"  0. Tất cả từ vựng N2 ({len(all_words)} từ)")
    for index, chapter in enumerate(names, 1):
        count = sum(len(words) for words in chapters[chapter].values())
        print(f"  {index}. {chapter} – {units.get(chapter, '')} ({count} từ)")
    choice = ask_number("Chương số: ", 0, len(names))
    if choice == 0:
        return "Tất cả từ vựng N2", all_words

    chapter = names[choice - 1]
    lessons = list(chapters[chapter].items())
    chapter_words = [word for _, words in lessons for word in words]
    print(bold(f"\n📖 {chapter} – {units.get(chapter, '')}"))
    print(f"  0. Cả chương ({len(chapter_words)} từ)")
    for index, (lesson, words) in enumerate(lessons, 1):
        print(f"  {index}. {lesson} ({len(words)} từ)")
    choice = ask_number("Bài số: ", 0, len(lessons))
    if choice == 0:
        return f"Cả {chapter} – {units.get(chapter, '')}", chapter_words
    return lessons[choice - 1]


def make_options(item, pool):
    """The meaning of the word and other meanings of the pool, shuffled."""
    others = list({word["meaning"] for word in pool if word["meaning"] != item["meaning"]})
    options = random.sample(others, min(OPTION_COUNT - 1, len(others))) + [item["meaning"]]
    random.shuffle(options)
    return options


def describe(item):
    """一家 (いっか) [NHẤT GIA] = Một nhà, cả nhà, cả gia đình"""
    reading = f" ({item['hiragana']})" if item["kanji"] else ""
    hv = f" [{item['han_viet']}]" if item["han_viet"] else ""
    return f"{bold(item['word'])}{reading}{hv} = {item['meaning']}"


def play_round(words, pool, hide_reading):
    """Asks every word until it is answered right; returns the right and wrong answers and the words missed."""
    queue = random.sample(words, len(words))
    right = wrong = 0
    missed = []
    while queue:
        item = queue.pop(0)
        options = make_options(item, pool)
        print(dim(f"\n[Đã đúng {right}/{len(words)} · còn {len(queue) + 1} câu]"))
        print("  " + bold(item["word"]))
        if item["kanji"] and not hide_reading:
            print("  " + dim(item["hiragana"]))
        for index, option in enumerate(options, 1):
            print(f"    {index}. {option}")

        answer = options[ask_number("Đáp án (1–4): ", 1, len(options)) - 1]
        if answer == item["meaning"]:
            right += 1
            print(green("✅ Chính xác! ") + describe(item))
        else:
            wrong += 1
            print(red("❌ Sai rồi! ") + describe(item))
            if item not in missed:
                missed.append(item)
            # Comes back after the other words of the round.
            queue.append(item)
    return right, wrong, missed


def option_pool(words, all_words):
    """Wrong options come from the batch, or from the whole list when the batch has too few meanings."""
    return words if len({word["meaning"] for word in words}) >= OPTION_COUNT else all_words


def main():
    parser = argparse.ArgumentParser(description="Học từ vựng JLPT N2 bằng trắc nghiệm trên terminal.")
    parser.add_argument("--an-hiragana", action="store_true", help="ẩn cách đọc khi hỏi, chỉ hiện sau khi trả lời")
    args = parser.parse_args()

    units, all_words = load_words()
    chapters = group_lessons(all_words)
    print(bold("🇯🇵 Luyện từ vựng JLPT N2") + dim(" · nhập q để thoát bất cứ lúc nào"))

    batch_title, batch_words = choose_batch(units, chapters, all_words)
    title, words = batch_title, batch_words
    while True:
        print(bold(f"\n===== {title} · {len(words)} từ ====="))
        right, wrong, missed = play_round(words, option_pool(words, all_words), args.an_hiragana)

        accuracy = round(100 * right / (right + wrong))
        print(bold("\n🎉 Hoàn thành lượt!") + f" Đúng {green(right)} · Sai {red(wrong)} · Chính xác {accuracy}%")
        if missed:
            print(bold(f"\n📝 Các từ đã sai ({len(missed)} từ):"))
            for item in missed:
                print("  • " + describe(item))

        actions = {"l": "Làm lại cả bài", "b": "Chọn bài khác", "q": "Thoát"}
        if missed:
            actions = {"r": f"Ôn lại {len(missed)} từ sai", **actions}
        print("\n" + " · ".join(f"[{key}] {label}" for key, label in actions.items()))
        while (choice := read("Chọn: ")) not in actions:
            print(red("Hãy chọn một trong: " + ", ".join(actions)))

        if choice == "r":
            title, words = f"Ôn lại từ sai – {batch_title}", missed
        elif choice == "l":
            title, words = batch_title, batch_words
        else:
            batch_title, batch_words = choose_batch(units, chapters, all_words)
            title, words = batch_title, batch_words


if __name__ == "__main__":
    main()
