import { describe, it, expect } from "vitest";
import { N2_DECK, N3_DECK, UNREMEMBERED_BATCH_KEY, getItemKey } from "./vocabBatches";

const n2Word = (kanji: string, hiragana?: string) =>
  N2_DECK.items.find((i) => i.kanji === kanji && (!hiragana || i.hiragana === hiragana))!;

describe("vocabulary decks", () => {
  it("groups the N3 list into units of lessons", () => {
    expect(N3_DECK.unitGroups).toHaveLength(11);
    expect(N3_DECK.firstLesson?.title).toBe("Unit 1 - Lesson 1: Con người & quan hệ");
    expect(N3_DECK.unrememberedStorageKey).toBe("mimikara_unremembered_words");
  });

  it("groups the crawled N2 list into 12 chapters of 5 lessons", () => {
    expect(N2_DECK.items.length).toBeGreaterThan(1500);
    expect(N2_DECK.unitGroups.map((group) => group.lessons.length)).toEqual(Array(12).fill(5));
    expect(N2_DECK.unitGroups[0].name).toBe("Chapter 1 – Quan hệ giữa người với người");
    expect(N2_DECK.firstLesson?.title).toBe("Chapter 1 - Bài 1: Gia đình");
    // Unremembered words are matched by number, so numbers must be unique.
    expect(new Set(N2_DECK.items.map(getItemKey)).size).toBe(N2_DECK.items.length);
  });

  it("reads kana-only N2 words from their reading", () => {
    const item = N2_DECK.items.find((i) => i.hiragana === "ありがたい")!;
    expect(item.kanji).toBe("");
    expect(item.question_text).toBe("ありがたい");
  });

  it("derives the Hán Việt of N2 kanji words", () => {
    expect(n2Word("一家").han_viet).toBe("NHẤT GIA");
    expect(n2Word("自立（する）").han_viet).toBe("TỰ LẬP");
    expect(N2_DECK.items.find((i) => i.hiragana === "ありがたい")!.han_viet).toBe("");
    expect(N2_DECK.items.filter((i) => i.han_viet.includes("?"))).toEqual([]);
  });

  it("pairs words with companions: verb pairs, synonyms and antonyms", () => {
    const n3Word = (kanji: string) => N3_DECK.items.find((i) => i.kanji === kanji)!;
    expect(N3_DECK.companionsOf(n3Word("倒れる"))[0]).toEqual({
      type: "vt",
      word: "倒す",
      reading: "たおす",
      meaning: expect.any(String),
    });
    expect(N3_DECK.companionsOf(n3Word("倒す"))[0]).toMatchObject({ type: "vi", word: "倒れる" });
    expect(N3_DECK.companionsOf(n3Word("男性")).map((c) => [c.type, c.word])).toContainEqual(["ant", "女性"]);
    expect(N2_DECK.companionsOf(n2Word("一家"))).toEqual([
      { type: "syn", word: "家族", reading: "かぞく", meaning: "gia đình" },
      { type: "syn", word: "世帯", reading: "せたい", meaning: "hộ gia đình" },
    ]);

    for (const deck of [N3_DECK, N2_DECK]) {
      for (const item of deck.items) {
        const companions = deck.companionsOf(item);
        expect(companions.length).toBeLessThanOrEqual(2);
        for (const companion of companions) {
          expect(companion.word).not.toBe(item.kanji || item.hiragana);
          expect(companion.meaning).not.toBe("");
        }
      }
    }
  });

  it("returns the items and title of a batch", () => {
    const [chapter1] = N2_DECK.unitGroups;
    expect(N2_DECK.getBatchItems(chapter1.key, [])).toHaveLength(
      chapter1.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0)
    );
    expect(N2_DECK.getBatchTitle(chapter1.key)).toBe("Cả Chapter 1 – Quan hệ giữa người với người");
    expect(N2_DECK.getBatchItems(UNREMEMBERED_BATCH_KEY, [n2Word("一家")])).toEqual([n2Word("一家")]);
  });
});
