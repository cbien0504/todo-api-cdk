import { useCallback, useMemo } from "react";
import type { VocabItem } from "../types/quiz";
import { getItemKey } from "../data/vocabBatches";
import { trackEvent } from "../utils/gtm";
import { jsonArrayCodec, usePersistentState } from "./usePersistentState";

const STORAGE_KEY = "mimikara_unremembered_words";
const codec = jsonArrayCodec<VocabItem>();

type MaybeItem = VocabItem | null | undefined;

export function useUnrememberedWords() {
  const [words, setWords] = usePersistentState<VocabItem[]>(STORAGE_KEY, [], codec);
  const keys = useMemo(() => new Set(words.map(getItemKey)), [words]);

  const isUnremembered = useCallback((item: MaybeItem) => !!item && keys.has(getItemKey(item)), [keys]);

  const markUnremembered = useCallback(
    (item: MaybeItem) => {
      if (!item || keys.has(getItemKey(item))) return;
      setWords([...words, item]);
      trackEvent("vocab_mark_unremembered", { word: item.question_text });
    },
    [keys, words, setWords]
  );

  const markRemembered = useCallback(
    (item: MaybeItem) => {
      if (!item) return;
      const targetKey = getItemKey(item);
      setWords(words.filter((w) => getItemKey(w) !== targetKey));
      trackEvent("vocab_mark_remembered", { word: item.question_text });
    },
    [words, setWords]
  );

  return { words, isUnremembered, markUnremembered, markRemembered };
}
