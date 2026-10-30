import type { DeckId } from "../types/progress";
import type {
  ExamAnswers,
  ExamPaper,
  ExamPart,
  ExamPartId,
  ExamQuestion,
  ExamScore,
  ExamSection,
} from "../types/exam";
import { shuffleArray } from "./quizEngine";

/** Parts of a JLPT 文字・語彙 paper, in the order they appear in the real exam. */
export const EXAM_PARTS: Omit<ExamPart, "mockCount">[] = [
  {
    id: "kanji-reading",
    name: "漢字読み",
    label: "Đọc Kanji",
    instruction: "＿＿＿のことばの読み方として最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn cách đọc đúng nhất của từ được gạch chân.",
  },
  {
    id: "orthography",
    name: "表記",
    label: "Viết Kanji",
    instruction: "＿＿＿のことばを漢字で書くとき、最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn cách viết Kanji đúng nhất cho từ được gạch chân.",
  },
  {
    id: "context",
    name: "文脈規定",
    label: "Điền từ theo ngữ cảnh",
    instruction: "（　　）に入れるのに最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn từ thích hợp nhất để điền vào chỗ trống.",
  },
  {
    id: "paraphrase",
    name: "言い換え類義",
    label: "Từ gần nghĩa",
    instruction: "＿＿＿に意味が最も近いものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn từ có nghĩa gần nhất với phần gạch chân.",
  },
  {
    id: "usage",
    name: "用法",
    label: "Cách dùng từ",
    instruction: "つぎのことばの使い方として最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn câu dùng từ đã cho đúng nhất.",
  },
];

export const MOCK_PAPER_KEY = "mock";

const lessonKey = (lesson: number) => `lesson-${lesson}`;
const partKey = (part: ExamPartId) => `part-${part}`;

export interface ExamPaperOption {
  key: string;
  label: string;
}

/** The exam questions of a JLPT level, with the papers built from them. */
export interface ExamBank {
  id: DeckId;
  level: string;
  source: string;
  questions: ExamQuestion[];
  /** Parts of the level's paper in the real exam order, with their question count in the mock paper. */
  parts: ExamPart[];
  mockTotal: number;
  lessons: number[];
  /** "Bài 1", "Quiz 1"… */
  lessonName: (lesson: number) => string;
  /** Title of the lesson papers in the paper list. */
  lessonGroup: string;
  lessonPaperOptions: ExamPaperOption[];
  partPaperOptions: ExamPaperOption[];
  /**
   * Exam paper with shuffled options. Lesson and part papers keep the source order of
   * questions; any other key produces a random mock paper with the question counts of
   * the real JLPT exam.
   */
  buildPaper: (key: string) => ExamPaper;
}

interface ExamBankConfig {
  id: DeckId;
  level: string;
  data: { title: string; source: string; questions: unknown[] };
  /** Question count of every part in the real paper of the level; the bank has these parts only. */
  mockCounts: Partial<Record<ExamPartId, number>>;
  /** Word naming a lesson of the source: "Bài", "Quiz". */
  lessonUnit: string;
  lessonGroup: string;
}

/** Group questions into exam sections following the real paper order of parts. */
export const groupIntoSections = (parts: ExamPart[], questions: ExamQuestion[]): ExamSection[] => {
  const sections: ExamSection[] = [];
  let offset = 0;
  for (const part of parts) {
    const partQuestions = questions.filter((q) => q.part === part.id);
    if (partQuestions.length === 0) continue;
    sections.push({ part, offset, questions: partQuestions });
    offset += partQuestions.length;
  }
  return sections;
};

/** Copy of a question with its options in random order; `answer` follows the correct option. */
export const shuffleOptions = (question: ExamQuestion): ExamQuestion => {
  const order = shuffleArray(question.options.map((_, idx) => idx));
  return { ...question, options: order.map((idx) => question.options[idx]), answer: order.indexOf(question.answer) };
};

/** Same paper and questions with the options of every question shuffled again, for a new attempt. */
export const reshuffleOptions = (paper: ExamPaper): ExamPaper => ({
  ...paper,
  sections: paper.sections.map((section) => ({ ...section, questions: section.questions.map(shuffleOptions) })),
});

export const createExamBank = ({ data, mockCounts, lessonUnit, ...config }: ExamBankConfig): ExamBank => {
  const parts: ExamPart[] = EXAM_PARTS.flatMap((part) => {
    const mockCount = mockCounts[part.id];
    return mockCount === undefined ? [] : [{ ...part, mockCount }];
  });
  const questions = data.questions as ExamQuestion[];
  const lessons = Array.from(new Set(questions.map((q) => q.lesson))).sort((a, b) => a - b);
  const lessonName = (lesson: number) => `${lessonUnit} ${lesson}`;

  const questionsOfPart = (part: ExamPartId) => questions.filter((q) => q.part === part);
  const questionsOfLesson = (lesson: number) => questions.filter((q) => q.lesson === lesson);

  const resolvePaper = (key: string): { title: string; questions: ExamQuestion[] } => {
    const lesson = lessons.find((l) => lessonKey(l) === key);
    if (lesson !== undefined) {
      return { title: lessonName(lesson), questions: questionsOfLesson(lesson) };
    }
    const part = parts.find((p) => partKey(p.id) === key);
    if (part) {
      return { title: `${part.name} – ${part.label}`, questions: questionsOfPart(part.id) };
    }
    return {
      title: "Đề thi thử 文字・語彙",
      questions: parts.flatMap((p) => shuffleArray(questionsOfPart(p.id)).slice(0, p.mockCount)),
    };
  };

  return {
    ...config,
    source: `${data.title} · ${data.source}`,
    questions,
    parts,
    mockTotal: parts.reduce((sum, part) => sum + part.mockCount, 0),
    lessons,
    lessonName,
    lessonPaperOptions: lessons.map((lesson) => ({
      key: lessonKey(lesson),
      label: `${lessonName(lesson)} (${questionsOfLesson(lesson).length} câu)`,
    })),
    partPaperOptions: parts.map((part) => ({
      key: partKey(part.id),
      label: `${part.name} – ${part.label} (${questionsOfPart(part.id).length} câu)`,
    })),
    buildPaper: (key) => {
      const { title, questions: paperQuestions } = resolvePaper(key);
      const sections = groupIntoSections(parts, paperQuestions.map(shuffleOptions));
      return { key, title, total: paperQuestions.length, sections };
    },
  };
};

export const scoreExam = (paper: ExamPaper, answers: ExamAnswers): ExamScore => {
  const sections = paper.sections.map((section) => ({
    part: section.part,
    total: section.questions.length,
    correct: section.questions.filter((q) => answers[q.id] === q.answer).length,
  }));
  return {
    correct: sections.reduce((sum, s) => sum + s.correct, 0),
    total: paper.total,
    sections,
  };
};
