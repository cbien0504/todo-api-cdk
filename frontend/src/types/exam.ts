export type ExamPartId = "kanji-reading" | "orthography" | "context" | "paraphrase";

export interface ExamQuestion {
  id: string;
  lesson: number;
  number: number;
  part: ExamPartId;
  before: string;
  /** Underlined word of the sentence; empty for fill-in-the-blank (（　　）) questions. */
  target: string;
  after: string;
  note?: string;
  options: string[];
  /** 0-based index into `options`. */
  answer: number;
  /** Answer was not confirmed in the source video (marked `*` in the document). */
  inferred: boolean;
}

export interface ExamPart {
  id: ExamPartId;
  name: string;
  label: string;
  instruction: string;
  hint: string;
  /** Number of questions of this part in a real JLPT N3 文字・語彙 paper. */
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
