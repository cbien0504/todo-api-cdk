import hanVietData from "../data/kanji_han_viet.json";
import n3VocabData from "../data/mimikara_oboeru_vocab.json";
import type { RawVocabItem } from "../types/quiz";

export const HAN_VIET_SOURCE = hanVietData.source;
const KANJI_HAN_VIET: Record<string, string> = hanVietData.kanji;

const KANJI = /[㐀-鿿豈-﫿]/;
const ITERATION_MARK = "々";
/** Context or another spelling written in brackets by the word lists: "（お金を）下ろす", "足元（足下）". */
const ANNOTATION = /[（(][^）)]*[）)]/g;

/**
 * Kanji of a word in order, with 々 repeating the previous one: "様々な" → ["様", "様"].
 * Bracketed annotations are not part of the word: "（お金を）下ろす" → ["下"].
 */
const kanjiOf = (word: string): string[] => {
  const chars: string[] = [];
  for (const char of word.replace(ANNOTATION, "")) {
    if (KANJI.test(char)) chars.push(char);
    else if (char === ITERATION_MARK && chars.length > 0) chars.push(chars[chars.length - 1]);
  }
  return chars;
};

/** Hán Việt of the N3 vocabulary words keyed by their kanji, so readings match the N3 quiz. */
const WORD_HAN_VIET = new Map<string, string>();
for (const item of n3VocabData as RawVocabItem[]) {
  const chars = kanjiOf(item.kanji ?? "");
  const syllables = (item.han_viet ?? "").toUpperCase().split(/\s+/).filter(Boolean);
  const key = chars.join("");
  if (chars.length > 0 && chars.length === syllables.length && !WORD_HAN_VIET.has(key)) {
    WORD_HAN_VIET.set(key, syllables.join(" "));
  }
}

/**
 * Hán Việt reading of the kanji in a word, e.g. "得意" → "ĐẮC Ý", "包んで" → "BAO".
 * Returns an empty string for kana-only words.
 */
export const getHanViet = (word: string): string => {
  const chars = kanjiOf(word);
  if (chars.length === 0) return "";
  return WORD_HAN_VIET.get(chars.join("")) ?? chars.map((char) => KANJI_HAN_VIET[char] ?? "?").join(" ");
};
