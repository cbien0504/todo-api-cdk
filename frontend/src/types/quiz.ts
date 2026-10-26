export interface RawVocabItem {
  stt: number | string;
  kanji?: string;
  han_viet?: string;
  hiragana?: string;
  meaning?: string;
  lesson?: string;
}

/** Word learned together with a vocabulary word ("học 1 được 2"). */
export interface Companion {
  /** syn: đồng nghĩa, ant: trái nghĩa, vt/vi: tha/tự động từ paired with a verb. */
  type: "syn" | "ant" | "vt" | "vi";
  word: string;
  /** Left out for kana words. */
  reading?: string;
  meaning: string;
}

export interface VocabItem {
  stt: number | string;
  kanji: string;
  han_viet: string;
  hiragana: string;
  meaning: string;
  question_text: string;
  lesson?: string;
}

export interface Question {
  stt: number | string;
  question_text: string;
  kanji: string;
  han_viet: string;
  hiragana: string;
  meaning: string;
  options: string[];
  answer: string;
  vocabIndex: number;
  lesson?: string;
}
