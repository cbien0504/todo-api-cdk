import { describe, it, expect } from "vitest";
import { N2_DECK, N3_DECK, N4_DECK, N5_DECK, UNREMEMBERED_BATCH_KEY, getItemKey } from "./vocabDecks";

const n2Word = (kanji: string, hiragana?: string) =>
  N2_DECK.items.find((i) => i.kanji === kanji && (!hiragana || i.hiragana === hiragana))!;

describe("vocabulary decks", () => {
  it("groups the N3 list into units of lessons", () => {
    expect(N3_DECK.unitGroups).toHaveLength(11);
    expect(N3_DECK.firstLesson?.title).toBe("Unit 1 - Lesson 1: Con người & quan hệ");
  });

  it("groups the crawled N2 list into 12 chapters of 5 lessons", () => {
    expect(N2_DECK.items.length).toBeGreaterThan(1500);
    expect(N2_DECK.unitGroups.map((group) => group.lessons.length)).toEqual(Array(12).fill(5));
    expect(N2_DECK.unitGroups[0].name).toBe("Chapter 1 – Quan hệ giữa người với người");
    expect(N2_DECK.firstLesson?.title).toBe("Chapter 1 - Bài 1: Gia đình");
    // Unremembered words are matched by number, so numbers must be unique.
    expect(new Set(N2_DECK.items.map(getItemKey)).size).toBe(N2_DECK.items.length);
  });

  it("groups the crawled N5 and N4 lists into chapters of lessons", () => {
    expect(N5_DECK.unitGroups.map((group) => group.lessons.length)).toEqual(Array(10).fill(5));
    expect(N5_DECK.unitGroups[0].name).toBe("Chapter 1 – Tự giới thiệu");
    expect(N5_DECK.firstLesson?.title).toBe("Chapter 1 - Bài 1: Là");
    expect(N4_DECK.unitGroups.map((group) => group.lessons.length)).toEqual([5, 5, 5, 5, 5, 5, 6]);
    expect(N4_DECK.unitGroups[0].name).toBe("Chapter 1 – Mỗi ngày của chúng tôi");
    expect(N4_DECK.firstLesson?.title).toBe("Chapter 1 - Bài 1: Thời gian");

    for (const deck of [N5_DECK, N4_DECK]) {
      expect(deck.items.length).toBeGreaterThan(850);
    }
  });

  it("finds every word by its key in the learner's progress", () => {
    expect([N5_DECK, N4_DECK, N3_DECK, N2_DECK].map((deck) => deck.id)).toEqual(["n5", "n4", "n3", "n2"]);
    for (const deck of [N5_DECK, N4_DECK, N3_DECK, N2_DECK]) {
      // Progress is matched by number: numbers are unique in a deck.
      expect(new Set(deck.items.map(getItemKey)).size).toBe(deck.items.length);
      for (const item of deck.items) expect(deck.itemByKey(getItemKey(item))).toBe(item);
    }
    expect(N3_DECK.itemByKey("stt_127")?.kanji).toBe("倒れる");
    expect(N3_DECK.itemByKey("stt_9999")).toBeUndefined();
  });

  it("reads kana-only N2 words from their reading", () => {
    const item = N2_DECK.items.find((i) => i.hiragana === "ありがたい")!;
    expect(item.kanji).toBe("");
    expect(item.question_text).toBe("ありがたい");
  });

  it("derives the Hán Việt of N5, N4 and N2 kanji words", () => {
    expect(n2Word("一家").han_viet).toBe("NHẤT GIA");
    expect(n2Word("自立（する）").han_viet).toBe("TỰ LẬP");
    expect(N2_DECK.items.find((i) => i.hiragana === "ありがたい")!.han_viet).toBe("");
    expect(N5_DECK.items.find((i) => i.kanji === "飲む")!.han_viet).toBe("ẨM");
    // The context in brackets is not part of the word.
    expect(N4_DECK.items.find((i) => i.kanji === "（お金を）下ろす")!.han_viet).toBe("HẠ");
    for (const deck of [N5_DECK, N4_DECK, N2_DECK]) {
      expect(deck.items.filter((i) => i.han_viet.includes("?"))).toEqual([]);
    }
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
    // Kana words have no reading of their own.
    expect(N5_DECK.companionsOf(N5_DECK.items.find((i) => i.hiragana === "わたし")!)).toEqual([
      { type: "syn", word: "ぼく", meaning: "tôi (nam, thân mật)" },
      { type: "syn", word: "わたくし", meaning: "tôi (rất lịch sự)" },
    ]);
    expect(N4_DECK.companionsOf(N4_DECK.items.find((i) => i.kanji === "開ける")!)[0]).toMatchObject({
      type: "vi",
      word: "開く",
    });

    for (const deck of [N5_DECK, N4_DECK, N3_DECK, N2_DECK]) {
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
