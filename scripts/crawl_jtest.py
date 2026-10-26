"""Crawl a JLPT vocabulary list of jtest.net, with the related words of every entry.

Usage (from the repo root):
    python3 scripts/crawl_jtest.py LEVEL [path/to/output.json]     # LEVEL: n5, n4, n3, n2, n1

The index page https://jtest.net/tu-vung-<level> links the chapters of the book
(はじめての日本語能力試験 単語), 5 or 6 sections each. Every section page has a table
with the word, its furigana (absent for kana-only words), the Vietnamese meaning and
"Từ liên quan" (synonyms, antonyms, ... each with reading and meaning). Pages are
fetched one at a time with a short pause. The raw result goes to
scripts/data/jtest_<level>.json; run scripts/build_vocab_data.py afterwards to update
the frontend data.
"""

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "scripts" / "data"
BASE_URL = "https://jtest.net"
USER_AGENT = "Mozilla/5.0 (compatible; mimikara-vocab-crawler)"
PAUSE_SECONDS = 1.0

ROW_RE = re.compile(r"<tr>(.*?)</tr>", re.S)
NUMBER_RE = re.compile(r"<th[^>]*>\s*(\d+)")
WORD_RE = re.compile(r'id="word\d+"[^>]*>(.*?)</small>', re.S)
FURIGANA_RE = re.compile(r'id="furigana\d+"[^>]*>(.*?)</small>', re.S)
MEANING_RE = re.compile(r'id="meaning\d+"[^>]*>(.*?)</span>', re.S)
RELATED_RE = re.compile(r"<summary[^>]*>Từ liên quan</summary>(.*?)</details>", re.S)
CATEGORY_RE = re.compile(r'<div class="mb-1">\s*<span class="badge[^"]*">(.*?)</span>(.*?)</div>', re.S)
RELATED_ITEM_RE = re.compile(r'<span class="d-inline-block ml-1">(.*?)<span class="text-muted">\((.*?)\)</span>\s*</span>', re.S)
RUBY_RE = re.compile(r"<ruby><rb>(.*?)</rb><rp>（</rp><rt>(.*?)</rt><rp>）</rp></ruby>", re.S)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(path: str) -> str:
    request = urllib.request.Request(BASE_URL + path, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub("", fragment))).strip()


def parse_index(page: str, index_path: str) -> tuple[dict[int, str], list[tuple[int, int, str, str]]]:
    """Chapter titles and (chapter, section, section title, path) of every section page."""
    link_re = re.compile(rf'<a[^>]+href="({index_path}/chapter-(\d+)(?:/section-(\d+))?)"[^>]*>(.*?)</a>', re.S)
    chapters: dict[int, str] = {}
    sections: dict[tuple[int, int], tuple[str, str]] = {}
    for path, chapter, section, label in link_re.findall(page):
        title = text_of(label)
        if section:
            # "Bài 1 Gia đình" → "Gia đình"
            sections[(int(chapter), int(section))] = (re.sub(r"^Bài\s+\d+\s*", "", title), path)
        else:
            # "Chapter 1 Quan hệ giữa người với người" → "Quan hệ giữa người với người"
            chapters[int(chapter)] = re.sub(r"^Chapter\s+\d+\s*", "", title)
    ordered = [(c, s, title, path) for (c, s), (title, path) in sorted(sections.items())]
    return chapters, ordered


def parse_related(row: str) -> dict[str, list[dict]]:
    """Related words by category ("Đồng nghĩa", "Trái nghĩa", ...), each with reading and meaning."""
    block = RELATED_RE.search(row)
    if not block:
        return {}
    related = {}
    for category, items in CATEGORY_RE.findall(block.group(1)):
        words = []
        for word_html, meaning in RELATED_ITEM_RE.findall(items):
            word = text_of(RUBY_RE.sub(r"\1", word_html))
            reading = text_of(RUBY_RE.sub(r"\2", word_html))
            words.append({"word": word, "reading": reading, "meaning": text_of(meaning)})
        if words:
            related[text_of(category)] = words
    return related


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
                "related": parse_related(row),
            }
        )
    expected = len(WORD_RE.findall(body))
    if len(words) != expected or [w["stt"] for w in words] != list(range(1, expected + 1)):
        raise SystemExit(f"{lesson}: parsed {len(words)} of {expected} words")
    return words


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    level = sys.argv[1].lower()
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DATA_DIR / f"jtest_{level}.json"
    index_path = f"/tu-vung-{level}"

    index = fetch(index_path)
    title = text_of(re.search(r"<title>(.*?)</title>", index, re.S).group(1)).split(" - ")[-1].split(" | ")[0]
    chapters, sections = parse_index(index, index_path)
    if not sections:
        raise SystemExit("No section links found on the index page")

    words: list[dict] = []
    for chapter, section, section_title, path in sections:
        time.sleep(PAUSE_SECONDS)
        lesson = f"Chapter {chapter} - Bài {section}: {section_title}"
        section_words = parse_section(fetch(path), lesson)
        print(f"{lesson}: {len(section_words)} từ")
        words.extend(section_words)

    # Pages number words from 1 in every section; the app needs numbers unique across the list.
    for stt, word in enumerate(words, start=1):
        word["stt"] = stt

    data = {
        "title": title,
        "source": f"JTest.net – {BASE_URL}{index_path}",
        "units": {f"Chapter {number}": title for number, title in sorted(chapters.items())},
        "words": words,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(words)} words from {len(sections)} sections to {output}")


if __name__ == "__main__":
    main()
