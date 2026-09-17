export interface RawVocabItem {
  stt: number | string;
  kanji?: string;
  han_viet?: string;
  hiragana?: string;
  meaning?: string;
}

export interface VocabItem {
  stt: number | string;
  kanji: string;
  han_viet: string;
  hiragana: string;
  meaning: string;
  question_text: string;
}

export interface Question {
  stt: number | string;
  question_text: string;
  kanji: string;
  han_viet: string;
  hiragana: string;
  meaning: string;
  options: string[];
  answer: string;
  vocabIndex: number;
}

export interface QuizStats {
  round: number;
  totalAnswered: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  bestStreak: number;
  masteredCount: number;
  totalInBatch: number;
  remainingCount: number;
  retryCount: number;
}

export interface AnswerHistoryEntry {
  question: Question;
  selectedOption: string;
  isCorrect: boolean;
  timestamp: number;
}
