"""Build the kanji → Hán Việt table used for exam words and the N5, N4 and N2 vocabulary.

Usage (from the repo root):
    python3 scripts/build_han_viet_data.py [path/to/kanjidic2.xml[.gz]] [path/to/output.json]

Without a path, KANJIDIC2 is downloaded from EDRDG. Each kanji used by the exam words
(underlined targets and options), by the jtest.net decks (N5, N4 and N2, which have no
Hán Việt of their own) or by the companion words gets one reading, chosen in this order:
  1. OVERRIDES below (common reading when KANJIDIC2 lists several or a wrong one);
  2. the most frequent reading in the vocabulary JSON, so the exam agrees with the
     Hán Việt shown in the vocabulary quiz;
  3. the first Vietnamese reading of KANJIDIC2.
Run it again after regenerating the exam data or scripts/build_vocab_data.py.
"""

import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

from edrdg import KANJIDIC_URL, read_dictionary

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "frontend" / "src" / "data"
VOCAB_PATH = DATA_DIR / "mimikara_oboeru_vocab.json"
EXAM_PATH = DATA_DIR / "jlpt_n3_minchan_exam.json"
# The decks written by scripts/build_vocab_data.py.
JTEST_DECK_GLOB = "jtest_*_vocab.json"
COMPANIONS_PATH = DATA_DIR / "vocab_companions.json"
DEFAULT_OUTPUT = DATA_DIR / "kanji_han_viet.json"

KANJI_RE = re.compile(r"[㐀-鿿豈-﫿]")

OVERRIDES = {
    "両": "LƯỠNG",
    "刊": "SAN",
    "区": "KHU",
    "単": "ĐƠN",
    "収": "THU",
    "台": "ĐÀI",
    "択": "TRẠCH",
    "探": "THÁM",
    "朝": "TRIỀU",
    "校": "HIỆU",
    "着": "TRƯỚC",
    "示": "THỊ",
    "般": "BAN",
    "錬": "LUYỆN",
    # Read both ways in the vocabulary data.
    "長": "TRƯỜNG",
    "任": "NHIỆM",
    # Kanji of the N2 vocabulary.
    "刷": "LOÁT",
    "医": "Y",
    "占": "CHIẾM",
    "尽": "TẬN",
    "属": "THUỘC",
    "彩": "THÁI",
    "担": "ĐẢM",
    "挟": "HIỆP",
    "採": "THÁI",
    "易": "DỊ",
    "汰": "THẢI",
    "滝": "LANG",
    "監": "GIÁM",
    "索": "SÁCH",
    "継": "KẾ",
    "説": "THUYẾT",
    "較": "GIẢO",
    "払": "PHẤT",
    "政": "CHÍNH",
    # Kanji of the companion words.
    "乾": "CAN",
    "創": "SÁNG",
    "将": "TƯƠNG",
    "山": "SƠN",
    "斉": "TỀ",
    "晩": "VÃN",
    "沖": "XUNG",
    "脱": "THOÁT",
    "販": "PHÁN",
    "縦": "TUNG",
    "繰": "TAO",
    "怖": "BỐ",
    "浜": "TÂN",
    # Kanji of the N5 and N4 vocabulary.
    "飲": "ẨM",
}


def normalize(reading: str) -> str:
    return unicodedata.normalize("NFC", reading.strip().upper())


def load_kanjidic(source: Path | None) -> dict[str, list[str]]:
    readings = {}
    for character in ET.fromstring(read_dictionary(source, KANJIDIC_URL)).iter("character"):
        vietnamese = [normalize(r.text) for r in character.iter("reading") if r.get("r_type") == "vietnam"]
        if vietnamese:
            readings[character.findtext("literal")] = vietnamese
    return readings


def vocab_readings() -> dict[str, Counter]:
    """Per-kanji readings of the vocabulary words whose Hán Việt has one syllable per kanji."""
    counts: dict[str, Counter] = defaultdict(Counter)
    for item in json.loads(VOCAB_PATH.read_text(encoding="utf-8")):
        kanji = KANJI_RE.findall(item.get("kanji") or "")
        syllables = (item.get("han_viet") or "").split()
        if kanji and len(kanji) == len(syllables):
            for char, syllable in zip(kanji, syllables):
                counts[char][normalize(syllable)] += 1
    return counts


def needed_kanji() -> set[str]:
    words = [
        item["kanji"]
        for path in sorted(DATA_DIR.glob(JTEST_DECK_GLOB))
        for item in json.loads(path.read_text(encoding="utf-8"))["words"]
    ]
    for deck in json.loads(COMPANIONS_PATH.read_text(encoding="utf-8")).values():
        words += [companion["word"] for companions in deck.values() for companion in companions]
    for question in json.loads(EXAM_PATH.read_text(encoding="utf-8"))["questions"]:
        words += [question["target"], *question["options"]]
    return {char for word in words for char in KANJI_RE.findall(word)}


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    kanjidic = load_kanjidic(source)
    vocab = vocab_readings()
    table = {}
    missing = []
    for char in sorted(needed_kanji()):
        if char in OVERRIDES:
            table[char] = OVERRIDES[char]
        elif char in vocab:
            table[char] = vocab[char].most_common(1)[0][0]
        elif char in kanjidic:
            table[char] = kanjidic[char][0]
        else:
            missing.append(char)

    if missing:
        raise SystemExit(f"No Hán Việt reading for: {''.join(missing)} (add them to OVERRIDES)")

    data = {
        "source": "KANJIDIC2 (EDRDG, CC BY-SA 4.0) & từ vựng Mimikara Oboeru N3",
        "kanji": table,
    }
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(table)} kanji readings to {output}")


if __name__ == "__main__":
    main()
