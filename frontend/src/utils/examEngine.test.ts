import { describe, it, expect } from "vitest";
import {
  EXAM_LESSONS,
  EXAM_PARTS,
  EXAM_QUESTIONS,
  MOCK_PAPER_KEY,
  MOCK_TOTAL,
  buildExamPaper,
  groupIntoSections,
  reshuffleOptions,
  scoreExam,
  shuffleOptions,
} from "./examEngine";

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
    const order = groupIntoSections(shuffled).map((s) => s.part.id);
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
