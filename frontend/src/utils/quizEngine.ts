import type { RawVocabItem, VocabItem, Question } from "../types/quiz";

/**
 * Format question text according to Python quiz spec:
 * Kanji (Hiragana) if kanji is present, else Hiragana.
 */
export const getQuestionText = (item: { kanji?: string; hiragana?: string }): string => {
  const kanji = (item.kanji || "").trim();
  const hiragana = (item.hiragana || "").trim();
  if (kanji) {
    return `${kanji} (${hiragana})`;
  }
  return hiragana;
};

/**
 * Clean, validate and deduplicate raw vocabulary items.
 */
export const cleanVocabData = (rawList: RawVocabItem[]): VocabItem[] => {
  const seen = new Set<string>();
  const items: VocabItem[] = [];

  for (const entry of rawList) {
    const stt = entry.stt ?? "";
    const kanji = (entry.kanji || "").trim();
    const han_viet = (entry.han_viet || "").trim();
    const hiragana = (entry.hiragana || "").trim();
    const meaning = (entry.meaning || "").trim();

    if (!hiragana || !meaning) {
      continue;
    }

    const qText = getQuestionText({ kanji, hiragana });
    const key = `${qText}:::${meaning}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      stt,
      kanji,
      han_viet,
      hiragana,
      meaning,
      question_text: qText,
    });
  }

  return items;
};

/**
 * Shuffle an array in place using Fisher-Yates algorithm and return it.
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * QuizBuffer class replicates the Python QuizBuffer logic:
 * - Maintains pending_new (questions never asked in current round)
 * - Maintains pending_retry (questions answered incorrectly in current round)
 * - Prioritizes pending_new over pending_retry
 * - A question is removed only when answered correctly
 */
export class QuizBuffer {
  private allIndices: number[];
  private pendingNew: number[];
  private pendingRetry: number[];

  constructor(indices: number[]) {
    this.allIndices = [...indices];
    this.pendingNew = [];
    this.pendingRetry = [];
    this.reset();
  }

  public reset(): void {
    this.pendingNew = shuffleArray(this.allIndices);
    this.pendingRetry = [];
  }

  public isRoundComplete(): boolean {
    return this.pendingNew.length === 0 && this.pendingRetry.length === 0;
  }

  public nextIndex(): number | null {
    if (this.isRoundComplete()) {
      return null;
    }
    if (this.pendingNew.length > 0) {
      return this.pendingNew.shift() ?? null;
    }
    return this.pendingRetry.shift() ?? null;
  }

  public markWrong(idx: number): void {
    this.pendingRetry.push(idx);
  }

  public remainingCount(): number {
    return this.pendingNew.length + this.pendingRetry.length;
  }

  public getPendingNewCount(): number {
    return this.pendingNew.length;
  }

  public getPendingRetryCount(): number {
    return this.pendingRetry.length;
  }

  public getAllIndicesCount(): number {
    return this.allIndices.length;
  }

  public setIndices(indices: number[]): void {
    this.allIndices = [...indices];
    this.reset();
  }
}

/**
 * Generate a 4-option multiple choice question for a target vocabulary item.
 * Picks 3 random distractor meanings from pool that differ from correct meaning.
 */
export const buildQuestion = (items: VocabItem[], correctIdx: number): Question => {
  const correctItem = items[correctIdx];
  const correctMeaning = correctItem.meaning;

  // Filter candidates with different meanings
  const candidateIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (i !== correctIdx && items[i].meaning !== correctMeaning) {
      candidateIndices.push(i);
    }
  }

  const shuffledCandidates = shuffleArray(candidateIndices);
  const sampleCount = Math.min(3, shuffledCandidates.length);
  const wrongIndices = shuffledCandidates.slice(0, sampleCount);

  const rawOptions = [
    ...wrongIndices.map((i) => items[i].meaning),
    correctMeaning,
  ];

  const options = shuffleArray(rawOptions);

  return {
    stt: correctItem.stt,
    question_text: correctItem.question_text,
    kanji: correctItem.kanji,
    han_viet: correctItem.han_viet,
    hiragana: correctItem.hiragana,
    meaning: correctMeaning,
    options,
    answer: correctMeaning,
    vocabIndex: correctIdx,
  };
};
