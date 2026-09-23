import { describe, it, expect } from "vitest";
import {
  getQuestionText,
  cleanVocabData,
  QuizBuffer,
  buildQuestion,
  shuffleArray,
} from "./quizEngine";
import type { RawVocabItem, VocabItem } from "../types/quiz";

describe("quizEngine (Mimikara Oboeru N3)", () => {
  describe("getQuestionText", () => {
    it("returns 'Kanji (Hiragana)' when kanji is present", () => {
      expect(getQuestionText({ kanji: "男性", hiragana: "だんせい" })).toBe("男性 (だんせい)");
    });

    it("returns only hiragana when kanji is empty", () => {
      expect(getQuestionText({ kanji: "", hiragana: "たくさん" })).toBe("たくさん");
      expect(getQuestionText({ hiragana: "たくさん" })).toBe("たくさん");
    });
  });

  describe("cleanVocabData", () => {
    it("filters out items missing hiragana or meaning", () => {
      const raw: RawVocabItem[] = [
        { stt: 1, kanji: "男", hiragana: "おとこ", meaning: "đàn ông" },
        { stt: 2, kanji: "女", hiragana: "", meaning: "phụ nữ" },
        { stt: 3, kanji: "人", hiragana: "ひと", meaning: "" },
      ];
      const result = cleanVocabData(raw);
      expect(result).toHaveLength(1);
      expect(result[0].kanji).toBe("男");
    });

    it("deduplicates identical question_text and meaning entries", () => {
      const raw: RawVocabItem[] = [
        { stt: 1, kanji: "男", hiragana: "おとこ", meaning: "đàn ông" },
        { stt: 2, kanji: "男", hiragana: "おとこ", meaning: "đàn ông" },
      ];
      const result = cleanVocabData(raw);
      expect(result).toHaveLength(1);
    });
  });

  describe("QuizBuffer", () => {
    it("initializes with all indices in pendingNew and empty pendingRetry", () => {
      const buffer = new QuizBuffer([0, 1, 2, 3, 4]);
      expect(buffer.getAllIndicesCount()).toBe(5);
      expect(buffer.getPendingNewCount()).toBe(5);
      expect(buffer.getPendingRetryCount()).toBe(0);
      expect(buffer.remainingCount()).toBe(5);
      expect(buffer.isRoundComplete()).toBe(false);
    });

    it("pops all pendingNew first", () => {
      const buffer = new QuizBuffer([10, 20]);
      const first = buffer.nextIndex();
      const second = buffer.nextIndex();

      expect([10, 20]).toContain(first);
      expect([10, 20]).toContain(second);
      expect(first).not.toBe(second);
      expect(buffer.getPendingNewCount()).toBe(0);
    });

    it("prioritizes pendingNew over pendingRetry", () => {
      const buffer = new QuizBuffer([1, 2, 3]);
      const idx1 = buffer.nextIndex()!;
      // Mark idx1 wrong -> moves to pendingRetry
      buffer.markWrong(idx1);

      expect(buffer.getPendingNewCount()).toBe(2);
      expect(buffer.getPendingRetryCount()).toBe(1);

      // Next two should come from pendingNew, not the retry one
      const idx2 = buffer.nextIndex()!;
      const idx3 = buffer.nextIndex()!;
      expect(idx2).not.toBe(idx1);
      expect(idx3).not.toBe(idx1);

      // Now pendingNew is empty, next should be the retry one
      const idxRetry = buffer.nextIndex()!;
      expect(idxRetry).toBe(idx1);
    });

    it("becomes complete when both pendingNew and pendingRetry are empty", () => {
      const buffer = new QuizBuffer([1]);
      const idx = buffer.nextIndex()!;
      expect(idx).toBe(1);
      expect(buffer.isRoundComplete()).toBe(true);
      expect(buffer.nextIndex()).toBeNull();
    });

    it("resets buffer to start a new round", () => {
      const buffer = new QuizBuffer([1, 2]);
      buffer.nextIndex();
      buffer.nextIndex();
      expect(buffer.isRoundComplete()).toBe(true);

      buffer.reset();
      expect(buffer.isRoundComplete()).toBe(false);
      expect(buffer.getPendingNewCount()).toBe(2);
    });
  });

  describe("buildQuestion", () => {
    const mockItems: VocabItem[] = [
      { stt: 1, kanji: "男性", han_viet: "NAM TÍNH", hiragana: "だんせい", meaning: "đàn ông", question_text: "男性 (だんせい)" },
      { stt: 2, kanji: "女性", han_viet: "NỮ TÍNH", hiragana: "じょせい", meaning: "phụ nữ", question_text: "女性 (じょせい)" },
      { stt: 3, kanji: "高齢", han_viet: "CAO LINH", hiragana: "こうれい", meaning: "cao tuổi", question_text: "高齢 (こうれい)" },
      { stt: 4, kanji: "年上", han_viet: "NIÊN THƯỢNG", hiragana: "としうえ", meaning: "lớn tuổi hơn", question_text: "年上 (としうえ)" },
      { stt: 5, kanji: "先輩", han_viet: "TIÊN BỐI", hiragana: "せんぱい", meaning: "tiền bối", question_text: "先輩 (せんぱい)" },
    ];

    it("builds a question with exactly 4 options including correct answer", () => {
      const q = buildQuestion(mockItems, 0);

      expect(q.stt).toBe(1);
      expect(q.question_text).toBe("男性 (だんせい)");
      expect(q.answer).toBe("đàn ông");
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain("đàn ông");

      // Verify no duplicates in options
      const uniqueOptions = new Set(q.options);
      expect(uniqueOptions.size).toBe(4);
    });

    it("builds a question with 4 options using distractorPool when items has fewer than 4 elements", () => {
      const smallItems: VocabItem[] = [mockItems[0]]; // Only 1 item
      const q = buildQuestion(smallItems, 0, mockItems);

      expect(q.stt).toBe(1);
      expect(q.answer).toBe("đàn ông");
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain("đàn ông");

      const uniqueOptions = new Set(q.options);
      expect(uniqueOptions.size).toBe(4);
    });
  });

  describe("shuffleArray", () => {
    it("returns an array with the same elements and length", () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(arr);
      expect(shuffled).toHaveLength(5);
      expect(shuffled.sort()).toEqual(arr.sort());
    });
  });
});
