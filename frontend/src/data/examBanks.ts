import n3ExamData from "./jlpt_n3_minchan_exam.json";
import n2ExamData from "./jtest_n2_exam.json";
import { createExamBank } from "../utils/examEngine";

/** Từ vựng N3 – Minchan, 8 lessons (scripts/build_exam_data.py). */
export const N3_EXAM = createExamBank({
  id: "n3",
  level: "N3",
  data: n3ExamData,
  mockCounts: { "kanji-reading": 8, orthography: 6, context: 11, paraphrase: 5 },
  lessonUnit: "Bài",
  lessonGroup: "Theo bài (Từ vựng N3 – Minchan)",
});

/** The 26 vocabulary quizzes of jtest.net, with the explanation of every answer (scripts/crawl_jtest_quiz.py). */
export const N2_EXAM = createExamBank({
  id: "n2",
  level: "N2",
  data: n2ExamData,
  mockCounts: { context: 7, paraphrase: 5, usage: 5 },
  lessonUnit: "Quiz",
  lessonGroup: "Theo quiz (JTest.net)",
});
