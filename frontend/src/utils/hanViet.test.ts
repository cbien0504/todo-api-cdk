import { describe, it, expect } from "vitest";
import { getHanViet } from "./hanViet";
import { N2_EXAM, N3_EXAM } from "../data/examBanks";

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

  it("leaves out the context and spellings written in brackets", () => {
    expect(getHanViet("（お金を）下ろす")).toBe("HẠ");
    expect(getHanViet("足元（足下）")).toBe("TÚC NGUYÊN");
    expect(getHanViet("(勉強が）できる")).toBe("");
    expect(getHanViet("自立（する）")).toBe("TỰ LẬP");
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
    // Usage options are sentences, shown without Hán Việt.
    const words = [...N3_EXAM.questions, ...N2_EXAM.questions].flatMap((q) => [
      q.target,
      ...(q.part === "usage" ? [] : q.options),
    ]);
    expect(words.filter((word) => getHanViet(word).includes("?"))).toEqual([]);
  });
});
