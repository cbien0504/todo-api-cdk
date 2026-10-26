"""Progress of a learner: word statuses and flashcards of each JLPT level, merged entry by entry.

The progress of a deck (level) is
    {"words": {key: {"s": "u" | "k", "t": ms}},
     "cards": {key: {"box": int, "due": int, "reviews": int, "lapses": int, "t": ms}}}
where `key` is the "stt_<number>" of a word of the level, "u" a word to review (chưa nhớ),
"k" a remembered word (đã nhớ), and `t` when the entry last changed (epoch milliseconds).
Two copies merge entry by entry, the most recent `t` winning, so changes made on several
devices are all kept. frontend/src/utils/progress.ts merges with the same rule.
"""

import re

DECKS = ("n5", "n4", "n3", "n2")
SECTIONS = ("words", "cards")
STATUSES = ("u", "k")

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,29}$")
USERNAME_RULE = "3–30 ký tự: chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang"
KEY_RE = re.compile(r"^stt_\d{1,5}$")

# More entries than the largest deck (1546 words): bounds the size of a stored deck.
MAX_ENTRIES = 2000
# Leitner boxes of frontend/src/utils/srs.ts (BOX_INTERVALS).
MAX_BOX = 7
MAX_COUNT = 1_000_000
# Clock skew accepted from a device; later times are brought back to the server time.
MAX_CLOCK_SKEW_MS = 24 * 3600 * 1000


class InvalidInput(ValueError):
    """The request does not follow the API: answered with 400."""


def normalize_username(raw: object) -> str:
    """Usernames are case-insensitive: "Bien.Nguyen " → "bien.nguyen"."""
    if not isinstance(raw, str):
        raise InvalidInput("Thiếu tên đăng nhập")
    username = raw.strip().lower()
    if not USERNAME_RE.match(username):
        raise InvalidInput(f"Tên đăng nhập không hợp lệ ({USERNAME_RULE})")
    return username


def check_deck(deck: object) -> str:
    if deck not in DECKS:
        raise InvalidInput(f"Cấp độ không hợp lệ: {deck}")
    return deck


def _int(value: object, low: int, high: int, name: str) -> int:
    # bool is an int in Python: refuse it explicitly.
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise InvalidInput(f"{name} phải là số nguyên từ {low} đến {high}")
    return value


def _time(value: object, now_ms: int) -> int:
    return min(_int(value, 0, 2**53, "t"), now_ms + MAX_CLOCK_SKEW_MS)


def _word(entry: object, now_ms: int) -> dict:
    if not isinstance(entry, dict) or entry.get("s") not in STATUSES:
        raise InvalidInput('Trạng thái của từ phải là "u" hoặc "k"')
    return {"s": entry["s"], "t": _time(entry.get("t"), now_ms)}


def _card(entry: object, now_ms: int) -> dict:
    if not isinstance(entry, dict):
        raise InvalidInput("Thẻ ghi nhớ không hợp lệ")
    return {
        "box": _int(entry.get("box"), 0, MAX_BOX, "box"),
        "due": _int(entry.get("due"), 0, MAX_COUNT, "due"),
        "reviews": _int(entry.get("reviews"), 0, MAX_COUNT, "reviews"),
        "lapses": _int(entry.get("lapses"), 0, MAX_COUNT, "lapses"),
        "t": _time(entry.get("t"), now_ms),
    }


def parse_patch(body: object, now_ms: int) -> dict:
    """The validated entries of a progress patch; unknown fields are dropped."""
    if not isinstance(body, dict):
        raise InvalidInput("Nội dung phải là một đối tượng JSON")
    patch = {}
    for section, parse in (("words", _word), ("cards", _card)):
        entries = body.get(section, {})
        if not isinstance(entries, dict) or len(entries) > MAX_ENTRIES:
            raise InvalidInput(f"{section} phải là một đối tượng có tối đa {MAX_ENTRIES} mục")
        for key in entries:
            if not KEY_RE.match(key):
                raise InvalidInput(f"Mã từ không hợp lệ: {key}")
        patch[section] = {key: parse(entry, now_ms) for key, entry in entries.items()}
    return patch


def empty_progress() -> dict:
    return {section: {} for section in SECTIONS}


def merge(base: dict, incoming: dict) -> dict:
    """Entry-by-entry merge: an incoming entry replaces the stored one when it is more recent."""
    merged = {}
    for section in SECTIONS:
        entries = dict(base.get(section, {}))
        for key, entry in incoming.get(section, {}).items():
            if key not in entries or entry["t"] > entries[key]["t"]:
                entries[key] = entry
        merged[section] = entries
    return merged


def summarize(progress: dict) -> dict:
    """Counts shown in the DynamoDB console: remembered and to-review words, flashcards studied."""
    statuses = [entry["s"] for entry in progress["words"].values()]
    return {
        "known": statuses.count("k"),
        "unremembered": statuses.count("u"),
        "flashcards": len(progress["cards"]),
    }
