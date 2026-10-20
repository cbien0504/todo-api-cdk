import type { ExamAnswers, ExamSection } from "../../types/exam";
import ExamQuestionItem from "./ExamQuestionItem";

interface ExamSectionCardProps {
  section: ExamSection;
  mondai: number;
  answers: ExamAnswers;
  submitted: boolean;
  onlyWrong: boolean;
  onAnswer: (questionId: string, index: number) => void;
}

/** One 問題 of the paper: shared instruction followed by all of its questions. */
export default function ExamSectionCard({ section, mondai, answers, submitted, onlyWrong, onAnswer }: ExamSectionCardProps) {
  const { part, offset, questions } = section;
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  const visible = questions
    .map((question, idx) => ({ question, displayNumber: offset + idx + 1 }))
    .filter(({ question }) => !(submitted && onlyWrong) || answers[question.id] !== question.answer);

  return (
    <section className="card exam-section" aria-labelledby={`mondai-${part.id}`}>
      <header className="exam-section-head">
        <h2 className="exam-section-title" id={`mondai-${part.id}`}>
          <span className="mondai" lang="ja">
            問題{mondai}
          </span>
          <span lang="ja">{part.name}</span>
          <span className="muted">· {part.label}</span>
        </h2>
        <span className={`badge ${submitted ? (correct === questions.length ? "tone-success" : "tone-warning") : "tone-primary"}`}>
          {submitted ? `${correct}/${questions.length} đúng` : `${questions.length} câu`}
        </span>
      </header>
      <p className="exam-instruction" lang="ja">
        {part.instruction}
      </p>
      <p className="exam-hint">{part.hint}</p>

      {visible.length === 0 ? (
        <p className="empty-state">🎉 Không có câu sai trong phần này.</p>
      ) : (
        <ol className="exam-questions">
          {visible.map(({ question, displayNumber }) => (
            <ExamQuestionItem
              key={question.id}
              question={question}
              displayNumber={displayNumber}
              selected={answers[question.id]}
              submitted={submitted}
              onAnswer={(index) => onAnswer(question.id, index)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
