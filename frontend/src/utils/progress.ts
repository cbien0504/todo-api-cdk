import type { DeckId, DeckProgress } from "../types/progress";

export const DECK_IDS: readonly DeckId[] = ["n5", "n4", "n3", "n2"];
export const EMPTY_DECK: DeckProgress = { words: {}, cards: {} };

// Same rules as backend/progress.py.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;
export const USERNAME_RULE = "3–30 ký tự: chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang";

/** Usernames are case-insensitive: " Bien.Nguyen" → "bien.nguyen"; null when it breaks the rule. */
export const normalizeUsername = (raw: string): string | null => {
  const username = raw.trim().toLowerCase();
  return USERNAME_PATTERN.test(username) ? username : null;
};

// Same rule as backend/auth.py, which counts the characters of the NFC form.
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;
export const PASSWORD_RULE = `Mật khẩu dài từ ${PASSWORD_MIN} đến ${PASSWORD_MAX} ký tự`;

export const isValidPassword = (password: string): boolean => {
  const length = [...password.normalize("NFC")].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
};

const mergeEntries = <E extends { t: number }>(base: Record<string, E>, incoming: Record<string, E> = {}) => {
  let merged = base;
  for (const [key, entry] of Object.entries(incoming)) {
    if (!base[key] || entry.t > base[key].t) {
      if (merged === base) merged = { ...base };
      merged[key] = entry;
    }
  }
  return merged;
};

/**
 * Entry-by-entry merge, as backend/progress.py does: an incoming entry replaces the current one
 * when it changed later. Unchanged sections keep their identity.
 */
export const mergeDeck = (base: DeckProgress, incoming: Partial<DeckProgress>): DeckProgress => {
  const words = mergeEntries(base.words, incoming.words);
  const cards = mergeEntries(base.cards, incoming.cards);
  return words === base.words && cards === base.cards ? base : { words, cards };
};
