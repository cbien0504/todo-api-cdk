"""Passwords and login sessions of the learners.

Passwords are hashed with scrypt and a random salt, the parameters stored with the hash.
Logging in opens a session: a random token the browser keeps in an HttpOnly cookie
("<username>:<token>", sent to /api only); the table only stores its SHA-256.
"""

import base64
import hashlib
import hmac
import re
import secrets
import unicodedata

from progress import USERNAME_RE, InvalidInput

PASSWORD_MIN, PASSWORD_MAX = 6, 128
PASSWORD_RULE = f"Mật khẩu dài từ {PASSWORD_MIN} đến {PASSWORD_MAX} ký tự"
# Parameters for interactive logins of the scrypt paper: 16 MiB, ~0.1 s on one core.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
SCRYPT_MAXMEM = 64 * 1024 * 1024

SESSION_COOKIE = "mimikara_session"
SESSION_DAYS = 180
COOKIE_ATTRIBUTES = "Path=/api; HttpOnly; Secure; SameSite=Strict"
CLEARED_COOKIE = f"{SESSION_COOKIE}=; Max-Age=0; {COOKIE_ATTRIBUTES}"
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def check_password(raw: object) -> str:
    """The password as hashed: the same characters typed on any device give the same password."""
    if not isinstance(raw, str):
        raise InvalidInput("Thiếu mật khẩu")
    password = unicodedata.normalize("NFC", raw)
    if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        raise InvalidInput(PASSWORD_RULE)
    return password


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int, length: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=length, maxmem=SCRYPT_MAXMEM)


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def hash_password(password: str) -> str:
    """Format: scrypt$<n>$<r>$<p>$<salt>$<hash>, salt and hash in base64."""
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P, 32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    scheme, n, r, p, salt, digest = stored.split("$")
    if scheme != "scrypt":
        return False
    expected = base64.b64decode(digest)
    actual = _scrypt(password, base64.b64decode(salt), int(n), int(r), int(p), len(expected))
    return hmac.compare_digest(actual, expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def session_cookie(username: str, token: str) -> str:
    return f"{SESSION_COOKIE}={username}:{token}; Max-Age={SESSION_DAYS * 24 * 3600}; {COOKIE_ATTRIBUTES}"


def read_session_cookie(cookies: list[str]) -> tuple[str, str] | None:
    """(username, token) of the session cookie; None when it is missing or malformed."""
    for cookie in cookies:
        name, _, value = cookie.strip().partition("=")
        username, _, token = value.partition(":")
        if name == SESSION_COOKIE and USERNAME_RE.match(username) and TOKEN_RE.match(token):
            return username, token
    return None
