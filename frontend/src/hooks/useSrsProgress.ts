import { useCallback } from "react";
import type { DeckId } from "../types/progress";
import { gradeCard, type SrsGrade } from "../utils/srs";
import { useDeckProgress, useProgressStore } from "./useProgress";

/** Flashcard progress of a deck for the logged-in learner. */
export function useSrsProgress(deck: DeckId) {
  const store = useProgressStore();
  const { cards } = useDeckProgress(deck);

  const grade = useCallback(
    (key: string, value: SrsGrade, today: number) =>
      store.setCard(deck, key, gradeCard(store.getDeck(deck).cards[key], value, today)),
    [store, deck]
  );

  return { cards, grade };
}
