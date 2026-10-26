import type { SrsCard } from "../utils/srs";

export type DeckId = "n5" | "n4" | "n3" | "n2";

/** "u": a word to review (chưa nhớ), "k": a remembered word (đã nhớ). */
export type WordStatus = "u" | "k";

/** Status of a word and when it last changed (epoch ms): copies from several devices merge by that time. */
export interface WordEntry {
  s: WordStatus;
  t: number;
}

/** Flashcard progress of a word and when it was last graded (epoch ms). */
export interface CardEntry extends SrsCard {
  t: number;
}

/** Progress of a learner in a deck, keyed by the `getItemKey` of its words ("stt_12"). */
export interface DeckProgress {
  words: Record<string, WordEntry>;
  cards: Record<string, CardEntry>;
}

export type Progress = Partial<Record<DeckId, DeckProgress>>;
