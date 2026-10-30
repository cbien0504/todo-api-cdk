import { useMemo, useRef, useState } from "react";
import type { ExamAnswers, ExamPaper } from "../../types/exam";
import { MOCK_PAPER_KEY, reshuffleOptions, scoreExam, type ExamBank } from "../../utils/examEngine";
import { HAN_VIET_SOURCE } from "../../utils/hanViet";
import { toPercent } from "../../utils/quizEngine";
import { trackEvent } from "../../utils/gtm";
import ResultPanel from "../ui/ResultPanel";
import { toneForPercent } from "../ui/helpers";
import ExamSectionCard from "./ExamSectionCard";

const RESULT_ICONS = { success: "🎉", warning: "👍", danger: "💪" } as const;

export default function ExamPractice({ bank }: { bank: ExamBank }) {
  const [paper, setPaper] = useState(() => bank.buildPaper(MOCK_PAPER_KEY));
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
  const selectId = `exam-paper-select-${bank.id}`;

  const startAttempt = (next: ExamPaper) => {
    setPaper(next);
    setAnswers({});
    setSubmitted(false);
    setOnlyWrong(false);
    setAttempt((n) => n + 1);
  };

  const startPaper = (key: string) => {
    startAttempt(bank.buildPaper(key));
    trackEvent("exam_start", { level: bank.id, paper: key });
  };

  // Same questions, options in a new order.
  const retryPaper = () => {
    startAttempt(reshuffleOptions(paper));
    trackEvent("exam_retry", { level: bank.id, paper: paper.key });
  };

  const answer = (questionId: string, index: number) => {
    if (!submitted) setAnswers((prev) => ({ ...prev, [questionId]: index }));
  };

  const submit = () => {
    setSubmitted(true);
    trackEvent("exam_submit", { level: bank.id, paper: paper.key, correct: score.correct, total: score.total });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="card toolbar">
        <div className="toolbar-row">
          <label htmlFor={selectId} className="field-label">
            Chọn đề
          </label>
          <select id={selectId} className="select" value={paper.key} onChange={(e) => startPaper(e.target.value)}>
            <option value={MOCK_PAPER_KEY}>🎲 Đề thi thử ngẫu nhiên ({bank.mockTotal} câu)</option>
            <optgroup label={bank.lessonGroup}>
              {bank.lessonPaperOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Theo dạng bài">
              {bank.partPaperOptions.map((o) => (
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
          {isMock && ` · số câu mỗi phần theo đề JLPT ${bank.level} thật`}
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
          headingId={`mondai-${bank.id}-${section.part.id}`}
          section={section}
          mondai={idx + 1}
          answers={answers}
          submitted={submitted}
          onlyWrong={onlyWrong}
          lessonName={bank.lessonName}
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
        Nguồn đề: {bank.source} · Âm Hán Việt: {HAN_VIET_SOURCE}
      </p>
    </>
  );
}
