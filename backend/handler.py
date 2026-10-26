"""Lambda behind the HTTP API of the study app (CloudFront /api/* → API Gateway → here).

POST  /api/register                          {"username", "password"} → {"username"} + session cookie
POST  /api/login                             {"username", "password"} → {"username"} + session cookie
POST  /api/logout                                                     → {} and the cookie cleared
GET   /api/users/{username}/progress                                  → {"username", "progress"}
PATCH /api/users/{username}/progress/{deck}   {"words", "cards"}       → {"deck", "summary"}

The progress routes need the session cookie of that username. A patch carries the entries
changed on a device; they are merged into the stored deck (see progress.py). Errors are never
403 or 404: CloudFront answers those with the page of the app.
"""

import base64
import json
import math
import os
import time
from datetime import datetime, timezone

from auth import (
    CLEARED_COOKIE,
    SESSION_DAYS,
    check_password,
    hash_password,
    new_token,
    read_session_cookie,
    session_cookie,
    token_hash,
    verify_password,
)
from progress import MAX_ENTRIES, SECTIONS, InvalidInput, check_deck, merge, normalize_username, parse_patch, summarize
from store import ProgressTable, VersionConflict

REGISTER = "POST /api/register"
LOGIN = "POST /api/login"
LOGOUT = "POST /api/logout"
GET_PROGRESS = "GET /api/users/{username}/progress"
PATCH_PROGRESS = "PATCH /api/users/{username}/progress/{deck}"
MAX_BODY_BYTES = 512 * 1024
# A deck saved by another request in the meantime is read and merged again.
SAVE_ATTEMPTS = 3
# Wrong passwords in a row before the account waits LOCK_MINUTES: guessing passwords takes forever.
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 5


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


class PayloadTooLarge(InvalidInput):
    """Answered with 413."""


_table: ProgressTable | None = None


def handler(event: dict, context: object) -> dict:
    """Lambda entry point."""
    global _table
    if _table is None:
        import boto3

        _table = ProgressTable(boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"]))
    return handle(event, _table)


def handle(event: dict, table) -> dict:
    try:
        route = event.get("routeKey")
        params = event.get("pathParameters") or {}
        if route == REGISTER:
            return register(table, _body(event))
        if route == LOGIN:
            return login(table, _body(event))
        if route == LOGOUT:
            return logout(table, event)
        if route == GET_PROGRESS:
            return _json(200, get_progress(table, _learner(table, event, params.get("username"))))
        if route == PATCH_PROGRESS:
            username = _learner(table, event, params.get("username"))
            return _json(200, patch_progress(table, username, params.get("deck"), _body(event)))
        return _json(400, {"error": "unknown_route", "message": f"Không có API {route}"})
    except ApiError as error:
        return _json(error.status, {"error": error.code, "message": str(error)})
    except PayloadTooLarge as error:
        return _json(413, {"error": "payload_too_large", "message": str(error)})
    except InvalidInput as error:
        return _json(400, {"error": "invalid_input", "message": str(error)})
    except VersionConflict:
        return _json(409, {"error": "conflict", "message": "Tiến độ đang được lưu từ nơi khác, hãy thử lại"})


def register(table, body: dict) -> dict:
    username = normalize_username(body.get("username"))
    password = check_password(body.get("password"))
    taken = ApiError(409, "username_taken", "Tên đăng nhập này đã có người dùng: hãy chọn tên khác, hoặc đăng nhập nếu đó là bạn")
    if table.get_profile(username):
        raise taken
    # The condition of create_profile settles two registrations of the same name at once.
    if not table.create_profile(username, hash_password(password), _now_iso()):
        raise taken
    return _open_session(table, username)


def login(table, body: dict) -> dict:
    username = normalize_username(body.get("username"))
    password = check_password(body.get("password"))
    profile = table.get_profile(username)
    if not profile or "passwordHash" not in profile:
        raise ApiError(401, "unknown_user", "Chưa có tài khoản tên này: bấm Đăng ký để tạo mới")

    now = time.time()
    locked_until = int(profile.get("lockedUntil", 0))
    if locked_until > now:
        raise ApiError(429, "locked", f"Sai mật khẩu quá nhiều lần: hãy thử lại sau {math.ceil((locked_until - now) / 60)} phút")
    if not verify_password(password, profile["passwordHash"]):
        failures = table.add_login_failure(username)
        if failures >= MAX_FAILED_LOGINS:
            table.lock(username, int(now) + LOCK_MINUTES * 60)
            raise ApiError(429, "locked", f"Sai mật khẩu {failures} lần liền: hãy thử lại sau {LOCK_MINUTES} phút")
        raise ApiError(401, "wrong_password", f"Sai mật khẩu (còn {MAX_FAILED_LOGINS - failures} lần thử)")

    if "failedLogins" in profile or "lockedUntil" in profile:
        table.clear_login_failures(username)
    return _open_session(table, username)


def logout(table, event: dict) -> dict:
    session = read_session_cookie(event.get("cookies") or [])
    if session:
        table.delete_session(session[0], token_hash(session[1]))
    return _json(200, {}, cookies=[CLEARED_COOKIE])


def get_progress(table, username: str) -> dict:
    decks = table.load_decks(username)
    table.touch_profile(username, _now_iso())
    return {"username": username, "progress": {deck: progress for deck, (progress, _version) in decks.items()}}


def patch_progress(table, username: str, deck: object, body: dict) -> dict:
    deck = check_deck(deck)
    patch = parse_patch(body, int(time.time() * 1000))
    now = _now_iso()
    for attempt in range(SAVE_ATTEMPTS):
        stored, version = table.load_deck(username, deck)
        merged = merge(stored, patch)
        if any(len(merged[section]) > MAX_ENTRIES for section in SECTIONS):
            raise PayloadTooLarge(f"Mỗi cấp độ lưu tối đa {MAX_ENTRIES} từ")
        summary = summarize(merged)
        try:
            table.save_deck(username, deck, merged, summary, version, now)
            break
        except VersionConflict:
            if attempt == SAVE_ATTEMPTS - 1:
                raise
    table.touch_profile(username, now, {deck: summary})
    return {"deck": deck, "summary": summary}


def _open_session(table, username: str) -> dict:
    token = new_token()
    now = _now_iso()
    table.create_session(username, token_hash(token), now, int(time.time()) + SESSION_DAYS * 24 * 3600)
    table.touch_profile(username, now)
    return _json(200, {"username": username}, cookies=[session_cookie(username, token)])


def _learner(table, event: dict, username: object) -> str:
    """The username of the path, when the session cookie belongs to it and is still open."""
    username = normalize_username(username)
    session = read_session_cookie(event.get("cookies") or [])
    if session is None or session[0] != username:
        raise ApiError(401, "unauthenticated", "Hãy đăng nhập lại")
    stored = table.get_session(username, token_hash(session[1]))
    if stored is None or int(stored["expiresAt"]) <= time.time():
        raise ApiError(401, "unauthenticated", "Phiên đăng nhập đã hết hạn: hãy đăng nhập lại")
    return username


def _body(event: dict) -> dict:
    raw = event.get("body") or ""
    data = base64.b64decode(raw) if event.get("isBase64Encoded") else raw.encode()
    if len(data) > MAX_BODY_BYTES:
        raise PayloadTooLarge(f"Nội dung vượt quá {MAX_BODY_BYTES // 1024} KB")
    try:
        body = json.loads(data or b"{}")
    except ValueError as error:
        raise InvalidInput("Nội dung không phải JSON") from error
    if not isinstance(body, dict):
        raise InvalidInput("Nội dung phải là một đối tượng JSON")
    return body


def _json(status: int, body: dict, cookies: list[str] | None = None) -> dict:
    response = {
        "statusCode": status,
        "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
        "body": json.dumps(body, ensure_ascii=False, separators=(",", ":")),
    }
    if cookies:
        response["cookies"] = cookies
    return response


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
