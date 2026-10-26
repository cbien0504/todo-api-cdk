import hanVietData from "../data/kanji_han_viet.json";
import { ALL_ITEMS } from "../data/vocabBatches";

export const HAN_VIET_SOURCE = hanVietData.source;
const KANJI_HAN_VIET: Record<string, string> = hanVietData.kanji;

const KANJI = /[㐀-鿿豈-﫿]/;
const ITERATION_MARK = "々";

/** Kanji of a word in order, with 々 repeating the previous one: "様々な" → ["様", "様"]. */
const kanjiOf = (word: string): string[] => {
  const chars: string[] = [];
  for (const char of word) {
    if (KANJI.test(char)) chars.push(char);
    else if (char === ITERATION_MARK && chars.length > 0) chars.push(chars[chars.length - 1]);
  }
  return chars;
};

/** Hán Việt of vocabulary words keyed by their kanji, so readings match the vocabulary quiz. */
const WORD_HAN_VIET = new Map<string, string>();
for (const item of ALL_ITEMS) {
  const chars = kanjiOf(item.kanji);
  const syllables = item.han_viet.toUpperCase().split(/\s+/).filter(Boolean);
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
