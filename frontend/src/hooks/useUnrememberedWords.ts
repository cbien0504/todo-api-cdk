import { useCallback, useMemo } from "react";
import type { VocabItem } from "../types/quiz";
import { getItemKey, type VocabDeck } from "../data/vocabDecks";
import { trackEvent } from "../utils/gtm";
import { useDeckProgress, useProgressStore } from "./useProgress";

type MaybeItem = VocabItem | null | undefined;

/**
 * Words of a deck the learner has to review (`words`, chưa nhớ) and has remembered (`known`, đã nhớ),
 * in the order they were marked. They belong to the logged-in learner (see utils/progressStore).
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

  const isUnremembered = useCallback((item: MaybeItem) => !!item && entries[getItemKey(item)]?.s === "u", [entries]);

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

  /** A correct answer or a remembered flashcard: the word is remembered, unless it waits for review. */
  const markKnown = useCallback(
    (item: MaybeItem) => {
      if (item) store.markKnown(deck.id, getItemKey(item));
    },
    [store, deck.id]
  );

  return { words, known, isUnremembered, markUnremembered, markRemembered, markKnown };
}

export type UnrememberedWords = ReturnType<typeof useUnrememberedWords>;
