import { useMemo, useRef, useState } from "react";
import type { ExamAnswers, ExamPaper } from "../../types/exam";
import {
  EXAM_SOURCE,
  LESSON_PAPER_OPTIONS,
  MOCK_PAPER_KEY,
  MOCK_TOTAL,
  PART_PAPER_OPTIONS,
  buildExamPaper,
  reshuffleOptions,
  scoreExam,
} from "../../utils/examEngine";
import { HAN_VIET_SOURCE } from "../../utils/hanViet";
import { toPercent } from "../../utils/quizEngine";
import { trackEvent } from "../../utils/gtm";
import ResultPanel from "../ui/ResultPanel";
import { toneForPercent } from "../ui/helpers";
import ExamSectionCard from "./ExamSectionCard";

const RESULT_ICONS = { success: "🎉", warning: "👍", danger: "💪" } as const;

export default function ExamPractice() {
  const [paper, setPaper] = useState(() => buildExamPaper(MOCK_PAPER_KEY));
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  /** Remounts the questions on every attempt so revealed Hán Việt readings are hidden again. */
  const [attempt, setAttempt] = useState(0);
  const resultRef = useRef<HTMLElement>(null);

  const score = useMemo(() => scoreExam(paper, answers), [paper, answers]);
  const answeredCount = Object.keys(answers).length;
  const percent = toPercent(score.correct, score.total);
  const resultTone = toneForPercent(percent);
  const isMock = paper.key === MOCK_PAPER_KEY;

  const startAttempt = (next: ExamPaper) => {
    setPaper(next);
    setAnswers({});
    setSubmitted(false);
    setOnlyWrong(false);
    setAttempt((n) => n + 1);
  };

  const startPaper = (key: string) => {
    startAttempt(buildExamPaper(key));
    trackEvent("exam_start", { paper: key });
  };

  // Same questions, options in a new order.
  const retryPaper = () => {
    startAttempt(reshuffleOptions(paper));
    trackEvent("exam_retry", { paper: paper.key });
  };

  const answer = (questionId: string, index: number) => {
    if (!submitted) setAnswers((prev) => ({ ...prev, [questionId]: index }));
  };

  const submit = () => {
    setSubmitted(true);
    trackEvent("exam_submit", { paper: paper.key, correct: score.correct, total: score.total });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="card toolbar">
        <div className="toolbar-row">
          <label htmlFor="exam-paper-select" className="field-label">
            Chọn đề
          </label>
          <select id="exam-paper-select" className="select" value={paper.key} onChange={(e) => startPaper(e.target.value)}>
            <option value={MOCK_PAPER_KEY}>🎲 Đề thi thử ngẫu nhiên ({MOCK_TOTAL} câu)</option>
            <optgroup label="Theo bài (Từ vựng N3 – Minchan)">
              {LESSON_PAPER_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Theo dạng bài">
              {PART_PAPER_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            className="btn btn--secondary btn--icon"
            onClick={() => startPaper(paper.key)}
            title={isMock ? "Tạo đề thi thử mới" : "Làm lại đề này từ đầu"}
            aria-label={isMock ? "Tạo đề mới" : "Làm lại đề"}
          >
            🔄
          </button>
        </div>
        <p className="toolbar-note">
          <strong>{paper.title}</strong> · {paper.total} câu · {paper.sections.length} phần
          {isMock && " · cấu trúc theo đề JLPT N3 thật"}
        </p>
      </section>

      {submitted && (
        <ResultPanel
          panelRef={resultRef}
          icon={RESULT_ICONS[resultTone]}
          tone={resultTone}
          title={`Bạn làm đúng ${score.correct}/${score.total} câu (${percent}%)`}
          description="Đáp án đúng được tô xanh, lựa chọn sai được tô đỏ. Câu có dấu * là đáp án tham khảo."
          metrics={score.sections.map((s, idx) => ({
            label: `問題${idx + 1} ${s.part.name}`,
            value: `${s.correct}/${s.total}`,
            tone: toneForPercent(toPercent(s.correct, s.total)),
          }))}
          actions={
            <>
              <button type="button" className="btn btn--primary" onClick={retryPaper}>
                🔄 Làm lại đề này
              </button>
              <button
                type="button"
                className={`btn btn--secondary ${onlyWrong ? "is-active" : ""}`}
                onClick={() => setOnlyWrong(!onlyWrong)}
                aria-pressed={onlyWrong}
              >
                {onlyWrong ? "📄 Xem tất cả câu" : "❌ Chỉ xem câu sai"}
              </button>
            </>
          }
        />
      )}

      {paper.sections.map((section, idx) => (
        <ExamSectionCard
          key={`${attempt}-${section.part.id}`}
          section={section}
          mondai={idx + 1}
          answers={answers}
          submitted={submitted}
          onlyWrong={onlyWrong}
          onAnswer={answer}
        />
      ))}

      {!submitted && (
        <div className="submit-bar">
          <span>
            Đã làm <strong>{answeredCount}</strong> / {paper.total} câu
            {answeredCount < paper.total && <span className="muted submit-note"> · câu bỏ trống sẽ tính là sai</span>}
          </span>
          <button type="button" className="btn btn--primary" onClick={submit}>
            📤 Nộp bài
          </button>
        </div>
      )}

      <p className="hint">
        Nguồn đề: {EXAM_SOURCE} · Âm Hán Việt: {HAN_VIET_SOURCE}
      </p>
    </>
  );
}
