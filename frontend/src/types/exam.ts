export type ExamPartId = "kanji-reading" | "orthography" | "context" | "paraphrase" | "usage";

/** Explanation of the answer, shown once the paper is submitted (jtest.net quizzes). */
export interface ExamExplanation {
  /** The word with its reading and meaning: "弱点（じゃくてん）: điểm yếu". */
  word: string;
  /** The completed sentence in Vietnamese. */
  translation: string;
  /** Other words of the sentence with their reading and meaning. */
  vocab?: string[];
}

export interface ExamQuestion {
  id: string;
  lesson: number;
  number: number;
  part: ExamPartId;
  before: string;
  /**
   * Underlined word of the sentence; empty for fill-in-the-blank (（　　）) questions.
   * A usage question is the word alone (no `before`/`after`), its options are sentences.
   */
  target: string;
  after: string;
  note?: string;
  options: string[];
  /** 0-based index into `options`. */
  answer: number;
  /** Answer was not confirmed in the source video (marked `*` in the document). */
  inferred: boolean;
  explanation?: ExamExplanation;
}

export interface ExamPart {
  id: ExamPartId;
  name: string;
  label: string;
  instruction: string;
  hint: string;
  /** Number of questions of this part in the mock paper: the count of the real JLPT paper of the level. */
  mockCount: number;
}

export interface ExamSection {
  part: ExamPart;
  /** Number of questions before this section, used for continuous numbering. */
  offset: number;
  questions: ExamQuestion[];
}

export interface ExamPaper {
  key: string;
  title: string;
  total: number;
  sections: ExamSection[];
}

export type ExamAnswers = Record<string, number>;

export interface SectionScore {
  part: ExamPart;
  correct: number;
  total: number;
}

export interface ExamScore {
  correct: number;
  total: number;
  sections: SectionScore[];
}
