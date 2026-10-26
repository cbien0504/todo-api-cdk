import unicodedata
import unittest

from auth import (
    CLEARED_COOKIE,
    PASSWORD_MAX,
    check_password,
    hash_password,
    new_token,
    read_session_cookie,
    session_cookie,
    token_hash,
    verify_password,
)
from progress import InvalidInput


class PasswordTest(unittest.TestCase):
    def test_hashes_with_a_random_salt_and_verifies(self):
        stored = hash_password("mat-khau-1")

        self.assertTrue(stored.startswith("scrypt$16384$8$1$"))
        self.assertNotIn("mat-khau-1", stored)
        self.assertNotEqual(stored, hash_password("mat-khau-1"))
        self.assertTrue(verify_password("mat-khau-1", stored))
        self.assertFalse(verify_password("mat-khau-2", stored))

    def test_the_same_characters_typed_anywhere_give_the_same_password(self):
        # "ậ" and "ẩ" as one character each, or as a letter followed by combining marks.
        self.assertEqual(check_password("mật khẩu 1"), check_password(unicodedata.normalize("NFD", "mật khẩu 1")))

    def test_refuses_too_short_or_too_long_passwords(self):
        for raw in [None, 123456, "12345", "x" * (PASSWORD_MAX + 1)]:
            with self.subTest(raw=raw), self.assertRaises(InvalidInput):
                check_password(raw)


class SessionCookieTest(unittest.TestCase):
    def test_the_browser_sends_back_the_session(self):
        token = new_token()
        cookie = session_cookie("bien", token)

        for attribute in ("HttpOnly", "Secure", "SameSite=Strict", "Path=/api", "Max-Age=15552000"):
            self.assertIn(attribute, cookie)
        sent_back = cookie.split(";")[0]
        self.assertEqual(read_session_cookie(["theme=dark", sent_back]), ("bien", token))
        self.assertRegex(token_hash(token), r"^[0-9a-f]{64}$")
        self.assertIn("Max-Age=0", CLEARED_COOKIE)

    def test_ignores_missing_or_malformed_sessions(self):
        token = new_token()
        for cookies in [
            [],
            ["mimikara_session="],
            [f"mimikara_session=Bien Nguyen:{token}"],
            ["mimikara_session=bien:short"],
            [f"other=bien:{token}"],
        ]:
            with self.subTest(cookies=cookies):
                self.assertIsNone(read_session_cookie(cookies))


if __name__ == "__main__":
    unittest.main()
