import type { DeckId, DeckProgress, Progress } from "../types/progress";
import { DECK_IDS } from "./progress";
import type { SrsCard } from "./srs";

/** Keys of the progress this browser saved before logins existed: one per level and kind. */
const LEGACY_KEYS: Record<DeckId, { unremembered: string; srs: string }> = {
  n5: { unremembered: "mimikara_n5_unremembered_words", srs: "mimikara_srs_n5" },
  n4: { unremembered: "mimikara_n4_unremembered_words", srs: "mimikara_srs_n4" },
  n3: { unremembered: "mimikara_unremembered_words", srs: "mimikara_srs_n3" },
  n2: { unremembered: "mimikara_n2_unremembered_words", srs: "mimikara_srs_n2" },
};

const WORD_KEY = /^stt_\d{1,5}$/;

export interface LegacyProgress {
  progress: Progress;
  unremembered: number;
  cards: number;
}

const read = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};

const isCard = (value: unknown): value is SrsCard =>
  !!value &&
  typeof value === "object" &&
  (["box", "due", "reviews", "lapses"] as const).every((field) => Number.isInteger((value as SrsCard)[field]));

/**
 * The progress saved in this browser before logins existed, as entries of the current format:
 * its unremembered words (in their order) and flashcards; a flashcard remembered at least once
 * counts as a remembered word. Null when there is none.
 */
export const readLegacyProgress = (now = Date.now()): LegacyProgress | null => {
  const progress: Progress = {};
  let unremembered = 0;
  let cards = 0;
  for (const deck of DECK_IDS) {
    const items = read(LEGACY_KEYS[deck].unremembered);
    const srs = read(LEGACY_KEYS[deck].srs);
    const keys = (Array.isArray(items) ? (items as { stt?: unknown }[]) : [])
      .map((item) => `stt_${item?.stt}`)
      .filter((key) => WORD_KEY.test(key));
    const deckProgress: DeckProgress = { words: {}, cards: {} };
    keys.forEach((key, index) => {
      deckProgress.words[key] = { s: "u", t: now - keys.length + index };
    });
    for (const [key, card] of Object.entries(srs && typeof srs === "object" ? srs : {})) {
      if (!WORD_KEY.test(key) || !isCard(card)) continue;
      deckProgress.cards[key] = { box: card.box, due: card.due, reviews: card.reviews, lapses: card.lapses, t: now };
      if (card.box > 0) deckProgress.words[key] ??= { s: "k", t: now };
    }
    unremembered += Object.values(deckProgress.words).filter((entry) => entry.s === "u").length;
    cards += Object.keys(deckProgress.cards).length;
    if (Object.keys(deckProgress.words).length || Object.keys(deckProgress.cards).length) progress[deck] = deckProgress;
  }
  return unremembered + cards > 0 ? { progress, unremembered, cards } : null;
};

/** Removes the progress saved before logins existed, once moved into an account. */
export const clearLegacyProgress = (): void => {
  for (const keys of Object.values(LEGACY_KEYS)) {
    localStorage.removeItem(keys.unremembered);
    localStorage.removeItem(keys.srs);
  }
};
