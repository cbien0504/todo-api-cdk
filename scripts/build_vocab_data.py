"""Build the vocabulary data of the frontend from the jtest.net crawls and JMdict.

Usage (from the repo root):
    python3 scripts/build_vocab_data.py [path/to/JMdict_e[.gz]]

Inputs: scripts/data/jtest_<level>.json (scripts/crawl_jtest.py; n2 is required, n3, n4,
n1 and n5 are used when present), the Mimikara N3 vocabulary, and JMdict (EDRDG,
CC BY-SA 4.0), downloaded when no path is given. Outputs:
  - frontend/src/data/jtest_n2_vocab.json: the N2 deck (words without related lists);
  - frontend/src/data/vocab_companions.json: up to two companion words per N3 and N2
    word, so that learning one word teaches two. In order of preference:
      * its transitive/intransitive pair (自動詞/他動詞, types "vt"/"vi"), detected
        with the transitivity of JMdict and the usual okurigana alternations;
      * synonyms ("syn") and antonyms ("ant") from the "Từ liên quan" lists of
        jtest.net, plus JMdict antonyms. Mimikara N3 words are matched to the jtest
        lists by word and reading, N3 first.
    Companions need a Vietnamese meaning, looked up in all the word lists.
Run scripts/build_han_viet_data.py afterwards so companions get their Hán Việt.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from edrdg import JMDICT_URL, read_dictionary

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_DATA = ROOT / "scripts" / "data"
FRONTEND_DATA = ROOT / "frontend" / "src" / "data"
N3_VOCAB_PATH = FRONTEND_DATA / "mimikara_oboeru_vocab.json"
N2_OUTPUT = FRONTEND_DATA / "jtest_n2_vocab.json"
COMPANIONS_OUTPUT = FRONTEND_DATA / "vocab_companions.json"

JTEST_LEVELS = ["n3", "n2", "n4", "n1", "n5"]
MAX_COMPANIONS = 2
# Categories of jtest "Từ liên quan", and the companion types written to the JSON.
SYNONYM, ANTONYM = "Đồng nghĩa", "Trái nghĩa"
TYPE_CODES = {SYNONYM: "syn", ANTONYM: "ant"}
TRANSITIVE, INTRANSITIVE = "vt", "vi"
COMMON_PRIORITIES = {"news1", "ichi1", "spec1", "spec2", "gai1"}

# Annotations of the word lists: （する）, （な）, [と], [お], 〜
ANNOTATION_RE = re.compile(r"（[^）]*）|\([^)]*\)|\[[^\]]*\]|[〜~\s]")
HIRAGANA_RE = re.compile(r"[\u3040-\u309f]+")
HIRAGANA_TAIL_RE = re.compile(r"[\u3040-\u309f]+$")

# Kana by consonant row and vowel column (・ marks empty cells).
GOJUON = {
    "": "あいうえお", "k": "かきくけこ", "g": "がぎぐげご", "s": "さしすせそ", "z": "ざじずぜぞ",
    "t": "たちつてと", "d": "だぢづでど", "n": "なにぬねの", "h": "はひふへほ", "b": "ばびぶべぼ",
    "p": "ぱぴぷぺぽ", "m": "まみむめも", "y": "や・ゆ・よ", "r": "らりるれろ", "w": "わ・・・を",
}
KANA_SOUND = {kana: (consonant, "aiueo"[i]) for consonant, row in GOJUON.items() for i, kana in enumerate(row) if kana != "・"}
# Tails (after the common reading prefix) of 自動詞/他動詞 pairs that no vowel rule covers.
FIXED_TAILS = {
    ("る", "す"), ("れる", "す"), ("わる", "える"), ("る", "せる"), ("える", "やす"),
    ("かれる", "ける"),  # 分かれる/分ける
    ("なる", "す"),  # 無くなる/無くす
    ("う", "わせる"),  # 合う/合わせる
}
# Pairs the tail rules accept but that are different verbs.
DENIED_PAIRS = {("分ける", "分かる"), ("分かる", "分ける")}


def normalize(text: str) -> str:
    return ANNOTATION_RE.sub("", text or "")


def same_row(a: str, b: str) -> bool:
    return a in KANA_SOUND and b in KANA_SOUND and KANA_SOUND[a][0] == KANA_SOUND[b][0]


def vowel(kana: str) -> str:
    return KANA_SOUND.get(kana, ("", ""))[1]


def is_pair_tail(a: str, b: str) -> bool:
    """True when two reading tails alternate like a 自動詞/他動詞 pair (上がる/上げる, 開く/開ける…)."""
    for x, y in ((a, b), (b, a)):
        if (x, y) in FIXED_TAILS:
            return True
        if len(x) == 1 and len(y) == 2 and same_row(x, y[0]):
            # 開く/開ける, 割る/割れる; 動く/動かす, 済む/済ます
            if y[1] == "る" and vowel(x) == "u" and vowel(y[0]) == "e":
                return True
            if y[1] == "す" and vowel(x) == "u" and vowel(y[0]) == "a":
                return True
        if len(x) == 2 and len(y) == 2 and same_row(x[0], y[0]):
            # 上がる/上げる; 起きる/起こす, 伸びる/伸ばす; 逃げる/逃がす, 冷める/冷ます
            if x[1] == y[1] == "る" and vowel(x[0]) == "a" and vowel(y[0]) == "e":
                return True
            if x[1] == "る" and y[1] == "す" and vowel(x[0]) == "i" and vowel(y[0]) in "oa":
                return True
            if x[1] == "る" and y[1] == "す" and vowel(x[0]) == "e" and vowel(y[0]) == "a":
                return True
    return False


def common_prefix_length(a: str, b: str) -> int:
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    return n


def first_transitivity(entry: ET.Element) -> set[str]:
    """Transitivity of the main sense: the first sense stating one (senses inherit the previous pos)."""
    pos: set[str] = set()
    for sense in entry.iter("sense"):
        pos = {p.text for p in sense.iter("pos")} or pos
        trans = ({"vi"} if "intransitive verb" in pos else set()) | ({"vt"} if "transitive verb" in pos else set())
        if trans:
            return trans
    return set()


def load_jmdict(source: Path | None) -> tuple[dict[tuple[str, str], dict], dict[str, list[str]]]:
    """Verbs keyed by (kanji form or "", reading), and antonyms keyed by word.

    A verb is {"trans": {"vi"} or {"vt"} of its main sense, "common": bool, "potential": bool}.
    """
    verbs: dict[tuple[str, str], dict] = {}
    antonyms: dict[str, list[str]] = {}
    for entry in ET.fromstring(read_dictionary(source, JMDICT_URL)).iter("entry"):
        kanji_forms = [k.findtext("keb") for k in entry.iter("k_ele")]
        # <ant>最低・2</ant> names the antonym's word and sense.
        for form in kanji_forms or [r.findtext("reb") for r in entry.iter("r_ele")]:
            antonyms.setdefault(form, []).extend(a.text.split("・")[0] for a in entry.iter("ant"))

        if not any((p.text or "").startswith(("Godan verb", "Ichidan verb")) for p in entry.iter("pos")):
            continue
        priorities = {p.text for p in entry.iter("ke_pri")} | {p.text for p in entry.iter("re_pri")}
        first_gloss = entry.findtext("sense/gloss") or ""
        info = {
            "trans": first_transitivity(entry),
            "common": bool(priorities & COMMON_PRIORITIES),
            # 読める "to be able to read" is a potential form, not the pair of 読む.
            "potential": first_gloss.startswith("to be able to"),
        }
        for r_ele in entry.iter("r_ele"):
            reading = r_ele.findtext("reb")
            restrictions = [r.text for r in r_ele.iter("re_restr")]
            forms = [] if r_ele.find("re_nokanji") is not None else [k for k in kanji_forms if not restrictions or k in restrictions]
            for form in [*forms, ""]:
                current = verbs.setdefault((form, reading), {"trans": set(), "common": False, "potential": True})
                current["trans"] |= info["trans"]
                current["common"] |= info["common"]
                current["potential"] &= info["potential"]
    return verbs, antonyms


class Verbs:
    """JMdict verbs indexed for pair lookups."""

    def __init__(self, forms: dict[tuple[str, str], dict]) -> None:
        self.forms = forms
        self.by_initial: dict[str, list] = {}
        self.by_reading: dict[str, list] = {}
        for (form, reading), info in forms.items():
            self.by_initial.setdefault((form or reading)[0], []).append(((form, reading), info))
            if form:
                self.by_reading.setdefault(reading, []).append((form, info))

    def kanji_stems(self, reading: str, trans: set[str]) -> set[str]:
        """Kanji part of the written forms of a kana verb: ぶつかる → {"打"}."""
        return {HIRAGANA_TAIL_RE.sub("", form) for form, info in self.by_reading.get(reading, []) if info["trans"] == trans}


class VietnameseDictionary:
    """Vietnamese meanings of every word met in the word lists and their related words."""

    def __init__(self) -> None:
        self.by_form: dict[tuple[str, str], str] = {}
        self.by_word: dict[str, tuple[str, str]] = {}

    def add(self, word: str, reading: str, meaning: str) -> None:
        word, reading = normalize(word) or normalize(reading), normalize(reading)
        if word and meaning:
            self.by_form.setdefault((word, reading), meaning)
            self.by_word.setdefault(word, (reading, meaning))


def find_pair(word: str, reading: str, verbs: Verbs, dictionary: VietnameseDictionary) -> dict | None:
    """The 自動詞/他動詞 counterpart of a verb, with its meaning, or None."""
    is_kana_word = word == reading
    own = verbs.forms.get(("" if is_kana_word else word, reading))
    if not own or len(own["trans"]) != 1:
        return None
    wanted = {"vt"} if own["trans"] == {"vi"} else {"vi"}

    prefix = word if is_kana_word else HIRAGANA_TAIL_RE.sub("", word)
    okurigana = word[len(prefix) :]
    if not prefix or not reading.endswith(okurigana):
        return None
    stem_reading = "" if is_kana_word else reading[: len(reading) - len(okurigana)]
    own_stems = verbs.kanji_stems(reading, own["trans"]) if is_kana_word else set()

    candidates = []
    for (form, other_reading), info in verbs.by_initial.get(word[0], []):
        if info["trans"] != wanted or info["potential"] or other_reading == reading:
            continue
        if is_kana_word:
            # Kana verbs pair up only when written with the same kanji: ぶつかる/ぶつける (打), not だまる/だます (黙/騙).
            if form or not own_stems & verbs.kanji_stems(other_reading, wanted):
                continue
        elif not (
            form.startswith(prefix)
            and HIRAGANA_RE.fullmatch(form[len(prefix) :])
            and other_reading.startswith(stem_reading)
        ):
            continue
        shown = form or other_reading
        n = common_prefix_length(reading, other_reading)
        if (word, shown) in DENIED_PAIRS or n == 0 or not is_pair_tail(reading[n:], other_reading[n:]):
            continue
        exact = dictionary.by_form.get((shown, other_reading))
        meaning = exact or dictionary.by_word.get(shown, ("", ""))[1]
        if meaning:
            # Prefer common verbs, meanings of that very spelling, and full okurigana (掛かる over 掛る).
            candidates.append((not info["common"], exact is None, -len(shown), shown, other_reading, meaning))
    if not candidates:
        return None
    *_, shown, other_reading, meaning = min(candidates)
    return {
        "type": TRANSITIVE if wanted == {"vt"} else INTRANSITIVE,
        "word": shown,
        "reading": other_reading,
        "meaning": meaning,
    }


def pick_companions(word: str, pair: dict | None, synonyms: list[dict], antonyms: list[dict]) -> list[dict]:
    """Pair first, then alternate synonyms and antonyms; at most MAX_COMPANIONS distinct words."""
    synonyms = [{"type": TYPE_CODES[SYNONYM], **w} for w in synonyms]
    antonyms = [{"type": TYPE_CODES[ANTONYM], **w} for w in antonyms]
    ordered = [pair] if pair else []
    for i in range(max(len(synonyms), len(antonyms))):
        ordered += synonyms[i : i + 1] + antonyms[i : i + 1]

    picked, seen = [], {normalize(word)}
    for companion in ordered:
        key = normalize(companion["word"])
        if key in seen or not companion["meaning"]:
            continue
        seen.add(key)
        # The reading is left out when it is the word itself (kana words).
        picked.append({k: v for k, v in companion.items() if k != "reading" or v != companion["word"]})
        if len(picked) == MAX_COMPANIONS:
            break
    return picked


def main() -> None:
    jmdict = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    n3 = json.loads(N3_VOCAB_PATH.read_text(encoding="utf-8"))
    # Related words of the jtest lists, the level closest to N3 first (Mimikara N3 words are matched to them).
    jtest = {
        level: json.loads(path.read_text(encoding="utf-8"))
        for level in JTEST_LEVELS
        if (path := SCRIPT_DATA / f"jtest_{level}.json").exists()
    }
    n2 = jtest["n2"]

    dictionary = VietnameseDictionary()
    related_by_form: dict[tuple[str, str], dict] = {}
    related_by_word: dict[str, dict] = {}
    for entry in n3:
        dictionary.add(entry.get("kanji") or entry["hiragana"], entry["hiragana"], entry["meaning"])
    for data in jtest.values():
        for entry in data["words"]:
            word, reading = normalize(entry["kanji"] or entry["hiragana"]), normalize(entry["hiragana"])
            dictionary.add(word, reading, entry["meaning"])
            related_by_form.setdefault((word, reading), entry["related"])
            related_by_word.setdefault(word, entry["related"])
            for words in entry["related"].values():
                for related in words:
                    dictionary.add(related["word"], related["reading"], related["meaning"])

    verb_forms, jmdict_antonyms = load_jmdict(jmdict)
    verbs = Verbs(verb_forms)

    def companions_of(entry: dict, related: dict | None) -> list[dict]:
        word, reading = normalize(entry.get("kanji") or entry["hiragana"]), normalize(entry["hiragana"])
        if related is None:
            related = related_by_form.get((word, reading)) or related_by_word.get(word) or {}
        antonyms = related.get(ANTONYM, []) + [
            {"word": antonym, "reading": dictionary.by_word[antonym][0], "meaning": dictionary.by_word[antonym][1]}
            for antonym in jmdict_antonyms.get(word, [])
            if antonym in dictionary.by_word
        ]
        pair = find_pair(word, reading, verbs, dictionary)
        return pick_companions(word, pair, related.get(SYNONYM, []), antonyms)

    companions = {
        "n3": {str(e["stt"]): c for e in n3 if (c := companions_of(e, None))},
        "n2": {str(e["stt"]): c for e in n2["words"] if (c := companions_of(e, e["related"]))},
    }
    COMPANIONS_OUTPUT.write_text(json.dumps(companions, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    n2_deck = {**n2, "words": [{k: v for k, v in w.items() if k != "related"} for w in n2["words"]]}
    N2_OUTPUT.write_text(json.dumps(n2_deck, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    for level, deck in (("n3", n3), ("n2", n2["words"])):
        found = companions[level]
        pairs = sum(1 for c in found.values() if c[0]["type"] in (TRANSITIVE, INTRANSITIVE))
        print(f"{level}: {len(found)}/{len(deck)} words with companions, {pairs} 自動詞/他動詞 pairs")


if __name__ == "__main__":
    main()
