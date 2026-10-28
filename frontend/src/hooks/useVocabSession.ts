import { useState } from "react";
import type { Question, VocabItem } from "../types/quiz";
import { UNREMEMBERED_BATCH_KEY, type VocabDeck } from "../data/vocabDecks";
import { QuizBuffer, buildQuestion } from "../utils/quizEngine";
import { trackEvent } from "../utils/gtm";

export interface SessionQuestion extends Question {
  /** Drawn from the retry queue (answered wrong earlier in this round). */
  isRetry: boolean;
}

interface SessionState {
  batchKey: string;
  items: VocabItem[];
  /** Mutable queue of the current round; mutated only inside event handlers. */
  buffer: QuizBuffer;
  round: number;
  question: SessionQuestion | null;
  selectedIndex: number | null;
  correctCount: number;
  wrongCount: number;
  streak: number;
  bestStreak: number;
  wrongWords: VocabItem[];
}

const drawQuestion = (deck: VocabDeck, buffer: QuizBuffer, items: VocabItem[], batchKey: string): SessionQuestion | null => {
  if (buffer.isRoundComplete() || items.length === 0) return null;
  const isRetry = buffer.getPendingNewCount() === 0;
  const index = buffer.nextIndex();
  if (index === null || !items[index]) return null;
  // Review batches and tiny batches borrow distractor meanings from the whole deck.
  const distractorPool = batchKey === UNREMEMBERED_BATCH_KEY || items.length < 4 ? deck.items : undefined;
  return { ...buildQuestion(items, index, distractorPool), isRetry };
};

const startRound = (deck: VocabDeck, batchKey: string, items: VocabItem[]) => {
  const buffer = new QuizBuffer(items.map((_, i) => i));
  return {
    batchKey,
    items,
    buffer,
    question: drawQuestion(deck, buffer, items, batchKey),
    selectedIndex: null,
    correctCount: 0,
    wrongCount: 0,
    wrongWords: [],
  };
};

interface SessionOptions {
  deck: VocabDeck;
  /** Words to practice in a batch now: they follow the learner's marks, so every round asks for them again. */
  batchItems: (key: string) => VocabItem[];
  onAnswer: (question: Question) => void;
  onWrong: (item: VocabItem) => void;
}

/** Vocabulary quiz session: batch selection, question queue, answers and round stats. */
export function useVocabSession({ deck, batchItems, onAnswer, onWrong }: SessionOptions) {
  const [state, setState] = useState<SessionState>(() => ({
    ...startRound(deck, deck.firstLessonKey, batchItems(deck.firstLessonKey)),
    round: 1,
    streak: 0,
    bestStreak: 0,
  }));

  const { batchKey, items, buffer, question, selectedIndex } = state;
  const isAnswered = question !== null && selectedIndex !== null;
  const isCorrect = isAnswered && question.options[selectedIndex] === question.answer;
  const currentItem = question ? (items[question.vocabIndex] ?? null) : null;

  // The question on screen stays in its queue until it is answered.
  const pendingCurrent = question !== null && !isAnswered;
  const pendingNew = buffer.getPendingNewCount() + (pendingCurrent && !question.isRetry ? 1 : 0);
  const retry = buffer.getPendingRetryCount() + (pendingCurrent && question.isRetry ? 1 : 0);
  const total = items.length;

  const selectBatch = (key: string, keyItems = batchItems(key)) => {
    setState({ ...startRound(deck, key, keyItems), round: 1, streak: 0, bestStreak: 0 });
    trackEvent("batch_reset", { level: deck.level, batchKey: key, totalItems: keyItems.length });
  };

  const nextRound = () => {
    const roundItems = batchItems(batchKey);
    setState({ ...state, ...startRound(deck, batchKey, roundItems), round: state.round + 1 });
    trackEvent("quiz_start_round", { level: deck.level, round: state.round + 1, totalItems: roundItems.length });
  };

  const answer = (index: number) => {
    if (!question || isAnswered || index < 0 || index >= question.options.length) return;
    const correct = question.options[index] === question.answer;
    onAnswer(question);

    if (correct) {
      const streak = state.streak + 1;
      setState({
        ...state,
        selectedIndex: index,
        correctCount: state.correctCount + 1,
        streak,
        bestStreak: Math.max(state.bestStreak, streak),
      });
      trackEvent("quiz_answer", { level: deck.level, result: "correct", word: question.question_text, stt: question.stt });
      return;
    }

    buffer.markWrong(question.vocabIndex);
    const wrongWords =
      currentItem && !state.wrongWords.some((w) => w.question_text === currentItem.question_text)
        ? [...state.wrongWords, currentItem]
        : state.wrongWords;
    if (currentItem) onWrong(currentItem);
    setState({ ...state, selectedIndex: index, wrongCount: state.wrongCount + 1, streak: 0, wrongWords });
    trackEvent("quiz_answer", {
      level: deck.level,
      result: "wrong",
      word: question.question_text,
      correctAnswer: question.answer,
      stt: question.stt,
    });
  };

  const next = () => {
    const nextQuestion = drawQuestion(deck, buffer, items, batchKey);
    setState({ ...state, question: nextQuestion, selectedIndex: null });
    if (!nextQuestion) {
      trackEvent("quiz_completed", {
        level: deck.level,
        round: state.round,
        correct: state.correctCount,
        wrong: state.wrongCount,
        batch: batchKey,
      });
    }
  };

  return {
    batchKey,
    items,
    round: state.round,
    question,
    currentItem,
    selectedIndex,
    isAnswered,
    isCorrect,
    isRoundComplete: question === null,
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
    streak: state.streak,
    bestStreak: state.bestStreak,
    wrongWords: state.wrongWords,
    progress: { total, pendingNew, retry, mastered: Math.max(0, total - pendingNew - retry) },
    selectBatch,
    nextRound,
    answer,
    next,
  };
}

export type VocabSession = ReturnType<typeof useVocabSession>;
