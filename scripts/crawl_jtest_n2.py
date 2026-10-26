"""Crawl the JLPT N2 vocabulary list of jtest.net into the JSON used by the frontend.

Usage (from the repo root):
    python3 scripts/crawl_jtest_n2.py [path/to/output.json]

The index page https://jtest.net/tu-vung-n2 links 12 chapters of 5 sections each
(はじめての日本語能力試験 N2 単語 2500). Every section page has a table with the word,
its furigana (absent for kana-only words) and the Vietnamese meaning. Pages are
fetched one at a time with a short pause. Run scripts/build_han_viet_data.py
afterwards so the Hán Việt table covers the new kanji.
"""

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "frontend" / "src" / "data" / "jtest_n2_vocab.json"
BASE_URL = "https://jtest.net"
INDEX_PATH = "/tu-vung-n2"
USER_AGENT = "Mozilla/5.0 (compatible; mimikara-n2-vocab-crawler)"
PAUSE_SECONDS = 1.0

LINK_RE = re.compile(r'<a[^>]+href="(/tu-vung-n2/chapter-(\d+)(?:/section-(\d+))?)"[^>]*>(.*?)</a>', re.S)
ROW_RE = re.compile(r"<tr>(.*?)</tr>", re.S)
NUMBER_RE = re.compile(r"<th[^>]*>\s*(\d+)")
WORD_RE = re.compile(r'id="word\d+"[^>]*>(.*?)</small>', re.S)
FURIGANA_RE = re.compile(r'id="furigana\d+"[^>]*>(.*?)</small>', re.S)
MEANING_RE = re.compile(r'id="meaning\d+"[^>]*>(.*?)</span>', re.S)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(path: str) -> str:
    request = urllib.request.Request(BASE_URL + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub("", fragment))).strip()


def parse_index(page: str) -> tuple[dict[int, str], list[tuple[int, int, str, str]]]:
    """Chapter titles and (chapter, section, section title, path) of every section page."""
    chapters: dict[int, str] = {}
    sections: dict[tuple[int, int], tuple[str, str]] = {}
    for path, chapter, section, label in LINK_RE.findall(page):
        title = text_of(label)
        if section:
            # "Bài 1 Gia đình" → "Gia đình"
            sections[(int(chapter), int(section))] = (re.sub(r"^Bài\s+\d+\s*", "", title), path)
        else:
            # "Chapter 1 Quan hệ giữa người với người" → "Quan hệ giữa người với người"
            chapters[int(chapter)] = re.sub(r"^Chapter\s+\d+\s*", "", title)
    ordered = [(c, s, title, path) for (c, s), (title, path) in sorted(sections.items())]
    return chapters, ordered


def parse_section(page: str, lesson: str) -> list[dict]:
    """Words of a section page; `stt` is the section-local number, renumbered by the caller."""
    body = page[page.find('id="vocabularyTable"') :]
    body = body[: body.find("</table>")]
    words = []
    for row in ROW_RE.findall(body):
        word = WORD_RE.search(row)
        meaning = MEANING_RE.search(row)
        number = NUMBER_RE.search(row)
        if not (word and meaning and number):
            continue
        furigana = FURIGANA_RE.search(row)
        word_text = text_of(word.group(1))
        # Kana-only words have no furigana: the word itself is the reading.
        words.append(
            {
                "stt": int(number.group(1)),
                "kanji": word_text if furigana else "",
                "hiragana": text_of(furigana.group(1)) if furigana else word_text,
                "meaning": text_of(meaning.group(1)),
                "lesson": lesson,
            }
        )
    expected = len(WORD_RE.findall(body))
    if len(words) != expected or [w["stt"] for w in words] != list(range(1, expected + 1)):
        raise SystemExit(f"{lesson}: parsed {len(words)} of {expected} words")
    return words


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    chapters, sections = parse_index(fetch(INDEX_PATH))
    if not sections:
        raise SystemExit("No section links found on the index page")

    words: list[dict] = []
    for chapter, section, title, path in sections:
        time.sleep(PAUSE_SECONDS)
        lesson = f"Chapter {chapter} - Bài {section}: {title}"
        section_words = parse_section(fetch(path), lesson)
        if not section_words:
            raise SystemExit(f"No words parsed from {path}")
        print(f"{lesson}: {len(section_words)} từ")
        words.extend(section_words)

    # Pages number words from 1 in every section; the app needs numbers unique across the list.
    for stt, word in enumerate(words, start=1):
        word["stt"] = stt

    data = {
        "title": "はじめての日本語能力試験 N2 単語 2500",
        "source": f"JTest.net – {BASE_URL}{INDEX_PATH}",
        "units": {f"Chapter {number}": title for number, title in sorted(chapters.items())},
        "words": words,
    }
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(words)} words from {len(sections)} sections to {output}")


if __name__ == "__main__":
    main()
