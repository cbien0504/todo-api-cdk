import { describe, it, expect } from "vitest";
import { N2_EXAM, N3_EXAM } from "../data/examBanks";
import { MOCK_PAPER_KEY, groupIntoSections, reshuffleOptions, scoreExam, shuffleOptions } from "./examEngine";

const { questions: EXAM_QUESTIONS, lessons: EXAM_LESSONS, parts: EXAM_PARTS, mockTotal: MOCK_TOTAL } = N3_EXAM;
const buildExamPaper = N3_EXAM.buildPaper;

describe("examEngine (JLPT N3 Minchan)", () => {
  it("loads all 440 questions with 4 options and a valid answer", () => {
    expect(EXAM_QUESTIONS).toHaveLength(440);
    expect(new Set(EXAM_QUESTIONS.map((q) => q.id)).size).toBe(440);
    for (const q of EXAM_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      // Blank questions have no underlined target, all others do.
      expect(q.target === "").toBe(q.part === "context");
    }
    expect(EXAM_QUESTIONS.filter((q) => q.inferred)).toHaveLength(59);
    expect(EXAM_LESSONS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("builds a mock paper with the real N3 question count of each part", () => {
    const paper = buildExamPaper(MOCK_PAPER_KEY);

    expect(paper.total).toBe(MOCK_TOTAL);
    expect(paper.sections.map((s) => [s.part.id, s.questions.length])).toEqual(
      EXAM_PARTS.map((p) => [p.id, p.mockCount])
    );
    expect(paper.sections.map((s) => s.offset)).toEqual([0, 8, 14, 25]);

    const ids = paper.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of paper.sections) {
      expect(section.questions.every((q) => q.part === section.part.id)).toBe(true);
    }
  });

  it("builds lesson papers in source order, grouped by part", () => {
    const paper = buildExamPaper("lesson-1");

    expect(paper.title).toBe("Bài 1");
    expect(paper.total).toBe(60);
    expect(paper.sections.map((s) => s.part.id)).toEqual(["kanji-reading", "orthography"]);
    expect(paper.sections[0].questions.map((q) => q.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));

    expect(buildExamPaper("lesson-8").sections.map((s) => [s.part.id, s.questions.length])).toEqual([["paraphrase", 80]]);
  });

  it("builds part papers across all lessons", () => {
    expect(buildExamPaper("part-kanji-reading").total).toBe(120);
    expect(buildExamPaper("part-context").sections).toHaveLength(1);
  });

  it("orders sections like the real exam regardless of input order", () => {
    const shuffled = [...EXAM_QUESTIONS].reverse().slice(0, 200);
    const order = groupIntoSections(EXAM_PARTS, shuffled).map((s) => s.part.id);
    expect(order).toEqual(EXAM_PARTS.map((p) => p.id).filter((id) => order.includes(id)));
  });

  it("shuffles options without losing the correct answer", () => {
    const question = EXAM_QUESTIONS[0];
    const original = [...question.options];
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleOptions(question);
      expect([...shuffled.options].sort()).toEqual([...original].sort());
      expect(shuffled.options[shuffled.answer]).toBe(original[question.answer]);
    }
    expect(question.options).toEqual(original);
  });

  it("reshuffles a paper without changing its questions or answers", () => {
    const paper = buildExamPaper(MOCK_PAPER_KEY);
    const answersOf = (p: typeof paper) => p.sections.flatMap((s) => s.questions.map((q) => [q.id, q.options[q.answer]]));
    expect(answersOf(reshuffleOptions(paper))).toEqual(answersOf(paper));
  });

  it("scores answers per section", () => {
    const paper = buildExamPaper("lesson-1");
    const [reading, writing] = paper.sections;
    const answers = {
      [reading.questions[0].id]: reading.questions[0].answer,
      [reading.questions[1].id]: (reading.questions[1].answer + 1) % 4,
      [writing.questions[0].id]: writing.questions[0].answer,
    };

    const score = scoreExam(paper, answers);
    expect(score.correct).toBe(2);
    expect(score.total).toBe(60);
    expect(score.sections.map((s) => [s.correct, s.total])).toEqual([
      [1, 30],
      [1, 30],
    ]);
  });
});

describe("examEngine (JLPT N2 jtest.net quizzes)", () => {
  it("loads the 262 questions of the 26 quizzes with 4 options, a valid answer and an explanation", () => {
    expect(N2_EXAM.questions).toHaveLength(262);
    expect(new Set(N2_EXAM.questions.map((q) => q.id)).size).toBe(262);
    for (const q of N2_EXAM.questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.target === "").toBe(q.part === "context");
      // A usage question is the word alone.
      if (q.part === "usage") expect(q.before + q.after).toBe("");
      expect(q.explanation?.word).toBeTruthy();
      expect(q.explanation?.translation).toBeTruthy();
    }
    expect(N2_EXAM.lessons).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(N2_EXAM.lessonPaperOptions[0]).toEqual({ key: "lesson-1", label: "Quiz 1 (12 câu)" });
    expect(N2_EXAM.partPaperOptions.map((o) => o.label)).toEqual([
      "文脈規定 – Điền từ theo ngữ cảnh (191 câu)",
      "言い換え類義 – Từ gần nghĩa (41 câu)",
      "用法 – Cách dùng từ (30 câu)",
    ]);
  });

  it("builds a mock paper with the real N2 question count of each part", () => {
    const paper = N2_EXAM.buildPaper(MOCK_PAPER_KEY);

    expect(N2_EXAM.mockTotal).toBe(17);
    expect(paper.sections.map((s) => [s.part.id, s.questions.length, s.offset])).toEqual([
      ["context", 7, 0],
      ["paraphrase", 5, 7],
      ["usage", 5, 12],
    ]);
  });

  it("builds quiz papers grouped by part", () => {
    const paper = N2_EXAM.buildPaper("lesson-24");

    expect(paper.title).toBe("Quiz 24");
    expect(paper.sections.map((s) => [s.part.id, s.questions.map((q) => q.number)])).toEqual([
      ["paraphrase", [1, 2, 3, 4, 5]],
      ["usage", [6, 7, 8, 9, 10]],
    ]);
  });
});
