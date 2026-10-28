import { useCallback, useMemo } from "react";
import type { WordStatus } from "../types/progress";
import type { VocabItem } from "../types/quiz";
import { getItemKey, type VocabDeck } from "../data/vocabDecks";
import { trackEvent } from "../utils/gtm";
import { useDeckProgress, useProgressStore } from "./useProgress";

type MaybeItem = VocabItem | null | undefined;

/**
 * Words of a deck the learner has to review (`words`, chưa nhớ) and has remembered (`known`, đã nhớ),
 * in the order they were marked. They belong to the logged-in learner (see utils/progressStore).
 * A word is remembered only when the learner marks it so; a wrong answer marks it to review.
 */
export function useUnrememberedWords(deck: VocabDeck) {
  const store = useProgressStore();
  const { words: entries } = useDeckProgress(deck.id);

  const { words, known } = useMemo(() => {
    const lists = { u: [] as { t: number; item: VocabItem }[], k: [] as { t: number; item: VocabItem }[] };
    for (const [key, entry] of Object.entries(entries)) {
      const item = deck.itemByKey(key);
      if (item) lists[entry.s].push({ t: entry.t, item });
    }
    const ordered = (list: { t: number; item: VocabItem }[]) => list.sort((a, b) => a.t - b.t).map(({ item }) => item);
    return { words: ordered(lists.u), known: ordered(lists.k) };
  }, [deck, entries]);

  /** Status of a word; `undefined` while it was never marked. */
  const statusOf = useCallback(
    (item: MaybeItem): WordStatus | undefined => (item ? entries[getItemKey(item)]?.s : undefined),
    [entries]
  );

  /** How many of these words are remembered (đã nhớ). */
  const countKnown = useCallback((items: VocabItem[]) => items.filter((item) => statusOf(item) === "k").length, [statusOf]);

  /** Words to practice in a batch; `onlyUnlearned` leaves out the remembered ones but keeps the words never studied. */
  const batchItems = useCallback(
    (key: string, onlyUnlearned: boolean) => {
      const items = deck.getBatchItems(key, words);
      return onlyUnlearned ? items.filter((item) => statusOf(item) !== "k") : items;
    },
    [deck, words, statusOf]
  );

  const markUnremembered = useCallback(
    (item: MaybeItem) => {
      if (item && store.setWordStatus(deck.id, getItemKey(item), "u")) {
        trackEvent("vocab_mark_unremembered", { word: item.question_text });
      }
    },
    [store, deck.id]
  );

  const markRemembered = useCallback(
    (item: MaybeItem) => {
      if (item && store.setWordStatus(deck.id, getItemKey(item), "k")) {
        trackEvent("vocab_mark_remembered", { word: item.question_text });
      }
    },
    [store, deck.id]
  );

  return { words, known, statusOf, countKnown, batchItems, markUnremembered, markRemembered };
}

export type UnrememberedWords = ReturnType<typeof useUnrememberedWords>;
