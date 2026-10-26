import { describe, expect, it } from "vitest";
import { EMPTY_DECK, mergeDeck, normalizeUsername } from "./progress";

describe("usernames", () => {
  it("are trimmed and case-insensitive, like on the server", () => {
    expect(normalizeUsername("  Bien.Nguyen_2 ")).toBe("bien.nguyen_2");
    for (const raw of ["", "ab", "a".repeat(31), "bien nguyen", "biên", "-bien", "bien/x"]) {
      expect(normalizeUsername(raw)).toBeNull();
    }
  });
});

describe("mergeDeck", () => {
  it("keeps the most recent entry of each word, as the server does", () => {
    const base = { words: { stt_1: { s: "u" as const, t: 5 }, stt_2: { s: "u" as const, t: 5 } }, cards: {} };
    const merged = mergeDeck(base, {
      words: { stt_1: { s: "k", t: 6 }, stt_2: { s: "k", t: 5 }, stt_3: { s: "k", t: 1 } },
    });

    expect(merged.words).toEqual({ stt_1: { s: "k", t: 6 }, stt_2: { s: "u", t: 5 }, stt_3: { s: "k", t: 1 } });
    expect(merged.cards).toBe(base.cards);
    expect(base.words.stt_1.s).toBe("u");
  });

  it("returns the same deck when nothing is newer", () => {
    const base = { words: { stt_1: { s: "u" as const, t: 5 } }, cards: {} };
    expect(mergeDeck(base, { words: { stt_1: { s: "k", t: 4 } } })).toBe(base);
    expect(mergeDeck(EMPTY_DECK, {})).toBe(EMPTY_DECK);
  });
});
