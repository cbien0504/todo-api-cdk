import examData from "../data/jlpt_n3_minchan_exam.json";
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

export const EXAM_SOURCE = `${examData.title} · ${examData.source}`;
export const EXAM_QUESTIONS = examData.questions as ExamQuestion[];

/** Parts of the JLPT N3 文字・語彙 paper, in the order they appear in the real exam. */
export const EXAM_PARTS: ExamPart[] = [
  {
    id: "kanji-reading",
    name: "漢字読み",
    label: "Đọc Kanji",
    instruction: "＿＿＿のことばの読み方として最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn cách đọc đúng nhất của từ được gạch chân.",
    mockCount: 8,
  },
  {
    id: "orthography",
    name: "表記",
    label: "Viết Kanji",
    instruction: "＿＿＿のことばを漢字で書くとき、最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn cách viết Kanji đúng nhất cho từ được gạch chân.",
    mockCount: 6,
  },
  {
    id: "context",
    name: "文脈規定",
    label: "Điền từ theo ngữ cảnh",
    instruction: "（　　）に入れるのに最もよいものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn từ thích hợp nhất để điền vào chỗ trống.",
    mockCount: 11,
  },
  {
    id: "paraphrase",
    name: "言い換え類義",
    label: "Từ gần nghĩa",
    instruction: "＿＿＿に意味が最も近いものを、1・2・3・4から一つえらびなさい。",
    hint: "Chọn từ có nghĩa gần nhất với phần gạch chân.",
    mockCount: 5,
  },
];

export const MOCK_PAPER_KEY = "mock";
export const MOCK_TOTAL = EXAM_PARTS.reduce((sum, part) => sum + part.mockCount, 0);

const lessonKey = (lesson: number) => `lesson-${lesson}`;
const partKey = (part: ExamPartId) => `part-${part}`;

const questionsOfPart = (part: ExamPartId) => EXAM_QUESTIONS.filter((q) => q.part === part);
const questionsOfLesson = (lesson: number) => EXAM_QUESTIONS.filter((q) => q.lesson === lesson);

export const EXAM_LESSONS: number[] = Array.from(new Set(EXAM_QUESTIONS.map((q) => q.lesson))).sort(
  (a, b) => a - b
);

export interface ExamPaperOption {
  key: string;
  label: string;
}

export const LESSON_PAPER_OPTIONS: ExamPaperOption[] = EXAM_LESSONS.map((lesson) => ({
  key: lessonKey(lesson),
  label: `Bài ${lesson} (${questionsOfLesson(lesson).length} câu)`,
}));

export const PART_PAPER_OPTIONS: ExamPaperOption[] = EXAM_PARTS.map((part) => ({
  key: partKey(part.id),
  label: `${part.name} – ${part.label} (${questionsOfPart(part.id).length} câu)`,
}));

/** Group questions into exam sections following the real paper order of parts. */
export const groupIntoSections = (questions: ExamQuestion[]): ExamSection[] => {
  const sections: ExamSection[] = [];
  let offset = 0;
  for (const part of EXAM_PARTS) {
    const partQuestions = questions.filter((q) => q.part === part.id);
    if (partQuestions.length === 0) continue;
    sections.push({ part, offset, questions: partQuestions });
    offset += partQuestions.length;
  }
  return sections;
};

const resolvePaper = (key: string): { title: string; questions: ExamQuestion[] } => {
  const lesson = EXAM_LESSONS.find((l) => lessonKey(l) === key);
  if (lesson !== undefined) {
    return { title: `Bài ${lesson}`, questions: questionsOfLesson(lesson) };
  }
  const part = EXAM_PARTS.find((p) => partKey(p.id) === key);
  if (part) {
    return { title: `${part.name} – ${part.label}`, questions: questionsOfPart(part.id) };
  }
  return {
    title: "Đề thi thử 文字・語彙",
    questions: EXAM_PARTS.flatMap((p) => shuffleArray(questionsOfPart(p.id)).slice(0, p.mockCount)),
  };
};

/**
 * Build an exam paper. Lesson and part papers keep the source order; any other key
 * produces a random mock paper with the question counts of the real JLPT N3 exam.
 */
export const buildExamPaper = (key: string): ExamPaper => {
  const { title, questions } = resolvePaper(key);
  const sections = groupIntoSections(questions);
  return { key, title, total: questions.length, sections };
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
