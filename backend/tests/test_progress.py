import unittest

from progress import MAX_CLOCK_SKEW_MS, MAX_ENTRIES, InvalidInput, merge, normalize_username, parse_patch, summarize

NOW = 1_800_000_000_000
CARD = {"box": 1, "due": 20_000, "reviews": 1, "lapses": 0, "t": NOW}


class UsernameTest(unittest.TestCase):
    def test_usernames_are_trimmed_and_case_insensitive(self):
        self.assertEqual(normalize_username("  Bien.Nguyen_2 "), "bien.nguyen_2")

    def test_rejects_invalid_usernames(self):
        for raw in [None, 12, "", "ab", "a" * 31, "bien nguyen", "biên", "-bien", "bien/x"]:
            with self.subTest(raw=raw), self.assertRaises(InvalidInput):
                normalize_username(raw)


class PatchTest(unittest.TestCase):
    def test_keeps_the_valid_entries_without_unknown_fields(self):
        patch = parse_patch(
            {"words": {"stt_1": {"s": "u", "t": NOW, "extra": 1}}, "cards": {"stt_1": {**CARD, "extra": 1}}, "other": {}},
            NOW,
        )
        self.assertEqual(patch, {"words": {"stt_1": {"s": "u", "t": NOW}}, "cards": {"stt_1": CARD}})
        self.assertEqual(parse_patch({}, NOW), {"words": {}, "cards": {}})

    def test_rejects_malformed_entries(self):
        too_many = {f"stt_{i}": {"s": "k", "t": NOW} for i in range(MAX_ENTRIES + 1)}
        for body in [
            [],
            {"words": []},
            {"words": too_many},
            {"words": {"word_1": {"s": "u", "t": NOW}}},
            {"words": {"stt_1": {"s": "x", "t": NOW}}},
            {"words": {"stt_1": {"s": "u", "t": "now"}}},
            {"words": {"stt_1": {"s": "u", "t": -1}}},
            {"cards": {"stt_1": {**CARD, "box": 8}}},
            {"cards": {"stt_1": {**CARD, "box": True}}},
            {"cards": {"stt_1": {**CARD, "reviews": 1.5}}},
            {"cards": {"stt_1": "card"}},
        ]:
            with self.subTest(body=body), self.assertRaises(InvalidInput):
                parse_patch(body, NOW)

    def test_brings_times_from_a_clock_far_ahead_back_to_the_server_time(self):
        patch = parse_patch({"words": {"stt_1": {"s": "k", "t": NOW + 10 * MAX_CLOCK_SKEW_MS}}}, NOW)
        self.assertEqual(patch["words"]["stt_1"]["t"], NOW + MAX_CLOCK_SKEW_MS)


class MergeTest(unittest.TestCase):
    def test_the_most_recent_entry_wins(self):
        base = {"words": {"stt_1": {"s": "u", "t": 5}, "stt_2": {"s": "u", "t": 5}}, "cards": {"stt_1": {**CARD, "t": 5}}}
        incoming = {
            "words": {"stt_1": {"s": "k", "t": 6}, "stt_2": {"s": "k", "t": 4}, "stt_3": {"s": "k", "t": 1}},
            "cards": {"stt_1": {**CARD, "box": 2, "t": 5}},
        }
        self.assertEqual(
            merge(base, incoming),
            {
                "words": {"stt_1": {"s": "k", "t": 6}, "stt_2": {"s": "u", "t": 5}, "stt_3": {"s": "k", "t": 1}},
                # Same time: the stored entry stays.
                "cards": {"stt_1": {**CARD, "t": 5}},
            },
        )
        self.assertEqual(base["words"]["stt_1"], {"s": "u", "t": 5})

    def test_counts_known_and_unremembered_words_and_flashcards(self):
        progress = {"words": {"stt_1": {"s": "k", "t": 1}, "stt_2": {"s": "u", "t": 1}, "stt_3": {"s": "k", "t": 1}}, "cards": {"stt_1": CARD}}
        self.assertEqual(summarize(progress), {"known": 2, "unremembered": 1, "flashcards": 1})


if __name__ == "__main__":
    unittest.main()
