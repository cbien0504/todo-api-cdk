import { describe, it, expect } from "vitest";
import { getHanViet } from "./hanViet";
import { EXAM_QUESTIONS } from "./examEngine";

describe("getHanViet", () => {
  it("reads every kanji of a word", () => {
    expect(getHanViet("発見")).toBe("PHÁT KIẾN");
    expect(getHanViet("簡単")).toBe("GIẢN ĐƠN");
  });

  it("ignores okurigana and repeats the kanji before 々", () => {
    expect(getHanViet("包ん")).toBe("BAO");
    expect(getHanViet("表して")).toBe("BIỂU");
    expect(getHanViet("様々")).toBe("DẠNG DẠNG");
  });

  it("prefers the reading of the vocabulary word", () => {
    // 長 is read TRƯỜNG on its own but TRƯỞNG in 成長.
    expect(getHanViet("成長")).toBe("THÀNH TRƯỞNG");
  });

  it("returns an empty string for kana-only words", () => {
    expect(getHanViet("つつんで")).toBe("");
    expect(getHanViet("カタログ")).toBe("");
  });

  it("has a reading for every kanji of the exam words", () => {
    const words = EXAM_QUESTIONS.flatMap((q) => [q.target, ...q.options]);
    expect(words.filter((word) => getHanViet(word).includes("?"))).toEqual([]);
  });
});
