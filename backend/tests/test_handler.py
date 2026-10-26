import base64
import json
import time
import unittest
from unittest import mock

from auth import token_hash
from handler import GET_PROGRESS, LOGIN, LOGOUT, MAX_BODY_BYTES, PATCH_PROGRESS, REGISTER, handle
from store import PROFILE, SESSION_PREFIX, MemoryProgressTable, VersionConflict

T = 1_700_000_000_000
PASSWORD = "mat-khau-1"


def call(table, route, body=None, cookies=None, raw=None, **params):
    event = {
        "routeKey": route,
        "pathParameters": params,
        "body": raw if raw is not None else json.dumps(body or {}),
        "cookies": cookies or [],
    }
    result = handle(event, table)
    return result["statusCode"], json.loads(result["body"]), result.get("cookies", [])


def sent_back(cookies):
    """The cookie as the browser sends it with the next requests."""
    return [cookies[0].split(";")[0]]


def register(table, username="bien", password=PASSWORD):
    status, body, cookies = call(table, REGISTER, {"username": username, "password": password})
    assert status == 200, body
    return sent_back(cookies)


def patch(table, session, username, deck, words=None, cards=None):
    return call(table, PATCH_PROGRESS, {"words": words or {}, "cards": cards or {}}, session, username=username, deck=deck)


def progress(table, session, username):
    return call(table, GET_PROGRESS, cookies=session, username=username)


class AccountTest(unittest.TestCase):
    def test_registers_a_new_username_and_opens_a_session(self):
        table = MemoryProgressTable()

        status, body, cookies = call(table, REGISTER, {"username": " Bien ", "password": PASSWORD})
        self.assertEqual((status, body), (200, {"username": "bien"}))
        self.assertIn("HttpOnly", cookies[0])
        profile = table.items[("bien", PROFILE)]
        self.assertTrue(profile["passwordHash"].startswith("scrypt$"))
        sessions = [key for key in table.items if key[1].startswith(SESSION_PREFIX)]
        self.assertEqual(sessions, [("bien", SESSION_PREFIX + token_hash(sent_back(cookies)[0].split(":")[1]))])
        self.assertEqual(progress(table, sent_back(cookies), "bien")[:2], (200, {"username": "bien", "progress": {}}))

    def test_refuses_a_username_already_taken(self):
        table = MemoryProgressTable()
        register(table)

        status, body, cookies = call(table, REGISTER, {"username": "BIEN", "password": "khac-hoan-toan"})
        self.assertEqual((status, body["error"], cookies), (409, "username_taken", []))

    def test_refuses_invalid_usernames_and_passwords(self):
        table = MemoryProgressTable()
        for body in [{"username": "bien nguyen", "password": PASSWORD}, {"username": "bien", "password": "12345"}, {"username": "bien"}]:
            with self.subTest(body=body):
                self.assertEqual(call(table, REGISTER, body)[0], 400)
        self.assertEqual(table.items, {})

    def test_logs_in_with_the_right_password_only(self):
        table = MemoryProgressTable()
        register(table)

        status, body, _ = call(table, LOGIN, {"username": "an.le", "password": PASSWORD})
        self.assertEqual((status, body["error"]), (401, "unknown_user"))
        status, body, cookies = call(table, LOGIN, {"username": "bien", "password": "sai-mat-khau"})
        self.assertEqual((status, body["error"], cookies), (401, "wrong_password", []))
        self.assertIn("còn 4 lần", body["message"])

        status, body, cookies = call(table, LOGIN, {"username": "Bien", "password": PASSWORD})
        self.assertEqual((status, body), (200, {"username": "bien"}))
        self.assertEqual(progress(table, sent_back(cookies), "bien")[0], 200)
        self.assertNotIn("failedLogins", table.items[("bien", PROFILE)])

    def test_waits_after_repeated_wrong_passwords(self):
        table = MemoryProgressTable()
        register(table)
        wrong = {"username": "bien", "password": "sai-mat-khau"}

        for _ in range(4):
            self.assertEqual(call(table, LOGIN, wrong)[0], 401)
        status, body, _ = call(table, LOGIN, wrong)
        self.assertEqual((status, body["error"]), (429, "locked"))
        # Even the right password waits.
        self.assertEqual(call(table, LOGIN, {"username": "bien", "password": PASSWORD})[0], 429)

        with mock.patch("time.time", return_value=time.time() + 6 * 60):
            self.assertEqual(call(table, LOGIN, {"username": "bien", "password": PASSWORD})[0], 200)
        self.assertNotIn("lockedUntil", table.items[("bien", PROFILE)])

    def test_logs_out(self):
        table = MemoryProgressTable()
        session = register(table)

        status, body, cookies = call(table, LOGOUT, cookies=session)
        self.assertEqual((status, body), (200, {}))
        self.assertIn("Max-Age=0", cookies[0])
        self.assertEqual(progress(table, session, "bien")[1]["error"], "unauthenticated")
        # Without a session too.
        self.assertEqual(call(table, LOGOUT)[0], 200)


class ProgressTest(unittest.TestCase):
    def test_needs_an_open_session_of_that_learner(self):
        table = MemoryProgressTable()
        bien, an = register(table, "bien"), register(table, "an.le")

        self.assertEqual(progress(table, None, "bien")[0], 401)
        self.assertEqual(progress(table, an, "bien")[0], 401)
        self.assertEqual(patch(table, an, "bien", "n3", {"stt_1": {"s": "u", "t": T}})[0], 401)
        self.assertEqual(progress(table, ["mimikara_session=bien:" + "x" * 43], "bien")[0], 401)
        self.assertEqual(progress(table, bien, "bien")[0], 200)
        with mock.patch("time.time", return_value=time.time() + 181 * 24 * 3600):
            self.assertEqual(progress(table, bien, "bien")[1]["message"], "Phiên đăng nhập đã hết hạn: hãy đăng nhập lại")

    def test_merges_the_patches_returned_with_the_progress(self):
        table = MemoryProgressTable()
        session = register(table)
        card = {"box": 1, "due": 20_000, "reviews": 1, "lapses": 0, "t": T}

        status, body, _ = patch(table, session, "bien", "n3", {"stt_1": {"s": "u", "t": T}, "stt_2": {"s": "k", "t": T}}, {"stt_1": card})
        self.assertEqual((status, body), (200, {"deck": "n3", "summary": {"known": 1, "unremembered": 1, "flashcards": 1}}))
        # From another device: stt_1 remembered later, an older change of stt_2 is ignored.
        other_device = sent_back(call(table, LOGIN, {"username": "bien", "password": PASSWORD})[2])
        patch(table, other_device, "bien", "n3", {"stt_1": {"s": "k", "t": T + 1}, "stt_2": {"s": "u", "t": T - 1}})

        self.assertEqual(
            progress(table, session, "bien")[1]["progress"],
            {"n3": {"words": {"stt_1": {"s": "k", "t": T + 1}, "stt_2": {"s": "k", "t": T}}, "cards": {"stt_1": card}}},
        )
        profile = table.items[("bien", PROFILE)]
        self.assertEqual((profile["n3Known"], profile["n3Unremembered"]), (2, 0))

    def test_keeps_learners_and_decks_apart(self):
        table = MemoryProgressTable()
        an, binh = register(table, "an.le"), register(table, "binh")
        patch(table, an, "an.le", "n5", {"stt_1": {"s": "u", "t": T}})
        patch(table, binh, "binh", "n2", {"stt_1": {"s": "k", "t": T}})

        self.assertEqual(list(progress(table, an, "an.le")[1]["progress"]), ["n5"])
        self.assertEqual(list(progress(table, binh, "binh")[1]["progress"]), ["n2"])

    def test_merges_again_when_the_deck_was_saved_meanwhile(self):
        class ConcurrentTable(MemoryProgressTable):
            """Another device saves the deck right after this request read it, once."""

            concurrent_save = True

            def load_deck(self, username, deck):
                loaded = super().load_deck(username, deck)
                if self.concurrent_save:
                    self.concurrent_save = False
                    other, version = super().load_deck(username, deck)
                    other["words"]["stt_9"] = {"s": "u", "t": T}
                    super().save_deck(username, deck, other, {}, version, "now")
                return loaded

        table = ConcurrentTable()
        session = register(table)
        self.assertEqual(patch(table, session, "bien", "n4", {"stt_1": {"s": "k", "t": T}})[0], 200)
        self.assertEqual(set(table.load_deck("bien", "n4")[0]["words"]), {"stt_1", "stt_9"})

    def test_answers_409_after_repeated_conflicts(self):
        class BusyTable(MemoryProgressTable):
            def save_deck(self, *args):
                raise VersionConflict("n3")

        table = BusyTable()
        self.assertEqual(patch(table, register(table), "bien", "n3", {"stt_1": {"s": "k", "t": T}})[0], 409)

    def test_rejects_invalid_requests(self):
        table = MemoryProgressTable()
        session = register(table)
        self.assertEqual(patch(table, session, "bien", "n1", {"stt_1": {"s": "k", "t": T}})[0], 400)
        self.assertEqual(patch(table, session, "bien", "n3", {"stt_1": {"s": "x", "t": T}})[0], 400)
        self.assertEqual(call(table, PATCH_PROGRESS, cookies=session, raw="{", username="bien", deck="n3")[0], 400)
        self.assertEqual(call(table, PATCH_PROGRESS, cookies=session, raw="[]", username="bien", deck="n3")[0], 400)
        too_large = " " * (MAX_BODY_BYTES + 1)
        self.assertEqual(call(table, PATCH_PROGRESS, cookies=session, raw=too_large, username="bien", deck="n3")[0], 413)
        self.assertEqual(call(table, "GET /api/users")[1]["error"], "unknown_route")
        self.assertEqual(table.load_decks("bien"), {})

    def test_reads_base64_bodies(self):
        table = MemoryProgressTable()
        raw = base64.b64encode(json.dumps({"username": "bien", "password": PASSWORD}).encode()).decode()
        result = handle({"routeKey": REGISTER, "body": raw, "isBase64Encoded": True}, table)
        self.assertEqual(result["statusCode"], 200)


if __name__ == "__main__":
    unittest.main()
