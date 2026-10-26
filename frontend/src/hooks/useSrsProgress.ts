import { useCallback } from "react";
import { gradeCard, type SrsCards, type SrsGrade } from "../utils/srs";
import { usePersistentState, type StorageCodec } from "./usePersistentState";

const codec: StorageCodec<SrsCards> = {
  parse: (raw) => {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SrsCards) : undefined;
  },
  serialize: (value) => JSON.stringify(value),
};

/** Flashcard progress of a deck, saved in localStorage under `storageKey`. */
export function useSrsProgress(storageKey: string) {
  const [cards, setCards] = usePersistentState<SrsCards>(storageKey, {}, codec);

  const grade = useCallback(
    (key: string, value: SrsGrade, today: number) =>
      setCards((previous) => ({ ...previous, [key]: gradeCard(previous[key], value, today) })),
    [setCards]
  );

  return { cards, grade };
}
