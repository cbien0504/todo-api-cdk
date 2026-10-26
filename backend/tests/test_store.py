import importlib.util
import json
import os
import unittest

from handler import GET_PROGRESS, PATCH_PROGRESS, REGISTER, handle
from store import PROFILE, ProgressTable, VersionConflict

T = 1_700_000_000_000
NOW = "2026-10-26T00:00:00+00:00"
SUMMARY = {"known": 1, "unremembered": 0, "flashcards": 0}


@unittest.skipUnless(importlib.util.find_spec("moto"), "needs moto: pip install -r backend/requirements-dev.txt")
class ProgressTableTest(unittest.TestCase):
    """ProgressTable against DynamoDB mocked by moto."""

    def setUp(self):
        import boto3
        from moto import mock_aws

        os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-1")
        mock = mock_aws()
        mock.start()
        self.addCleanup(mock.stop)
        self.raw = boto3.resource("dynamodb").create_table(
            TableName="progress",
            KeySchema=[{"AttributeName": "username", "KeyType": "HASH"}, {"AttributeName": "record", "KeyType": "RANGE"}],
            AttributeDefinitions=[
                {"AttributeName": "username", "AttributeType": "S"},
                {"AttributeName": "record", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        self.table = ProgressTable(self.raw)

    def test_creates_a_profile_once(self):
        self.assertTrue(self.table.create_profile("bien", "hash", NOW))
        self.assertFalse(self.table.create_profile("bien", "other", NOW))
        self.assertEqual(self.table.get_profile("bien")["passwordHash"], "hash")
        self.assertIsNone(self.table.get_profile("an.le"))

    def test_counts_wrong_passwords_and_locks(self):
        self.table.create_profile("bien", "hash", NOW)
        self.assertEqual([self.table.add_login_failure("bien") for _ in range(3)], [1, 2, 3])

        self.table.lock("bien", 1_800_000_000)
        profile = self.table.get_profile("bien")
        self.assertEqual((profile["lockedUntil"], "failedLogins" in profile), (1_800_000_000, False))
        self.table.clear_login_failures("bien")
        self.assertNotIn("lockedUntil", self.table.get_profile("bien"))

    def test_keeps_sessions_apart_from_the_progress(self):
        self.table.create_profile("bien", "hash", NOW)
        self.table.create_session("bien", "abc", NOW, 1_900_000_000)
        self.table.save_deck("bien", "n5", {"words": {"stt_1": {"s": "k", "t": T}}, "cards": {}}, SUMMARY, 0, NOW)

        self.assertEqual(self.table.get_session("bien", "abc")["expiresAt"], 1_900_000_000)
        self.assertEqual(list(self.table.load_decks("bien")), ["n5"])
        self.table.delete_session("bien", "abc")
        self.assertIsNone(self.table.get_session("bien", "abc"))

    def test_a_new_password_closes_every_session(self):
        self.table.create_profile("bien", "hash", NOW)
        self.table.add_login_failure("bien")
        self.table.create_session("bien", "abc", NOW, 1_900_000_000)
        self.table.create_session("bien", "def", NOW, 1_900_000_000)

        self.assertTrue(self.table.set_password("bien", "new-hash"))
        self.assertFalse(self.table.set_password("an.le", "new-hash"))
        profile = self.table.get_profile("bien")
        self.assertEqual((profile["passwordHash"], "failedLogins" in profile), ("new-hash", False))
        self.assertEqual((self.table.get_session("bien", "abc"), self.table.get_session("bien", "def")), (None, None))

    def test_saves_and_loads_decks_with_their_counts(self):
        progress = {"words": {"stt_1": {"s": "k", "t": T}}, "cards": {}}
        self.table.save_deck("bien", "n5", progress, SUMMARY, 0, NOW)

        self.assertEqual(self.table.load_deck("bien", "n5"), (progress, 1))
        self.assertEqual(self.table.load_deck("bien", "n4"), ({"words": {}, "cards": {}}, 0))
        item = self.raw.get_item(Key={"username": "bien", "record": "n5"})["Item"]
        self.assertEqual((item["known"], item["unremembered"], item["flashcards"]), (1, 0, 0))
        with self.assertRaises(VersionConflict):
            self.table.save_deck("bien", "n5", progress, SUMMARY, 0, NOW)

    def test_records_the_counts_of_every_deck_in_an_existing_profile_only(self):
        self.table.create_profile("bien", "hash", "2026-10-26T01:00:00+00:00")
        self.table.touch_profile("bien", "2026-10-26T02:00:00+00:00", {"n3": {"known": 4, "unremembered": 2, "flashcards": 0}})
        self.table.touch_profile("bien", "2026-10-26T03:00:00+00:00", {"n5": {"known": 1, "unremembered": 0, "flashcards": 3}})
        self.table.touch_profile("an.le", "2026-10-26T03:00:00+00:00")

        profile = self.table.get_profile("bien")
        self.assertEqual(
            {k: v for k, v in profile.items() if k not in ("username", "record", "passwordHash")},
            {
                "createdAt": "2026-10-26T01:00:00+00:00",
                "lastSeenAt": "2026-10-26T03:00:00+00:00",
                "n3Known": 4,
                "n3Unremembered": 2,
                "n5Known": 1,
                "n5Unremembered": 0,
            },
        )
        self.assertIsNone(self.table.get_profile("an.le"))

    def test_serves_the_api_from_dynamodb(self):
        result = handle({"routeKey": REGISTER, "body": json.dumps({"username": "Bien", "password": "mat-khau-1"})}, self.table)
        session = [result["cookies"][0].split(";")[0]]
        event = {"pathParameters": {"username": "bien", "deck": "n2"}, "cookies": session}
        words = {"stt_7": {"s": "u", "t": T}}
        self.assertEqual(handle({**event, "routeKey": PATCH_PROGRESS, "body": json.dumps({"words": words})}, self.table)["statusCode"], 200)

        result = handle({**event, "routeKey": GET_PROGRESS}, self.table)
        self.assertEqual(json.loads(result["body"]), {"username": "bien", "progress": {"n2": {"words": words, "cards": {}}}})
        self.assertEqual(self.table.get_profile("bien")["n2Unremembered"], 1)
        self.assertEqual(self.raw.get_item(Key={"username": "bien", "record": PROFILE})["Item"]["n2Known"], 0)


if __name__ == "__main__":
    unittest.main()
