import type { ExamQuestion } from "../../types/exam";
import OptionButton from "../ui/OptionButton";
import { getOptionState } from "../ui/helpers";

interface ExamQuestionItemProps {
  question: ExamQuestion;
  displayNumber: number;
  selected: number | undefined;
  submitted: boolean;
  onAnswer: (index: number) => void;
}

export default function ExamQuestionItem({ question, displayNumber, selected, submitted, onAnswer }: ExamQuestionItemProps) {
  const { before, target, after, note, options, answer } = question;
  const status = !submitted ? "" : selected === undefined ? "is-skipped" : selected === answer ? "is-correct" : "is-wrong";

  return (
    <li className={`exam-question ${status}`} aria-label={`Câu ${displayNumber}`}>
      <div className="exam-question-head">
        <span className="exam-number">{displayNumber}</span>
        <p className="exam-sentence" lang="ja">
          {before}
          {target ? (
            <u className="exam-target">{target}</u>
          ) : (
            <span className={`exam-blank ${submitted ? "is-filled" : ""}`}>{submitted ? options[answer] : "　　"}</span>
          )}
          {after}
        </p>
      </div>
      {note && <p className="exam-note">💡 {note}</p>}

      <div className="options options--grid" role="group" aria-label={`Đáp án câu ${displayNumber}`}>
        {options.map((option, idx) => (
          <OptionButton
            key={idx}
            index={idx}
            label={option}
            lang="ja"
            state={getOptionState({ isSelected: selected === idx, isAnswer: idx === answer, revealed: submitted })}
            disabled={submitted}
            onSelect={() => onAnswer(idx)}
          />
        ))}
      </div>

      {submitted && (
        <p className="exam-meta">
          {selected === undefined && <span className="badge tone-warning">Chưa trả lời</span>}
          <span>
            Nguồn: Bài {question.lesson} – câu {question.number}
          </span>
          {question.inferred && <span title="Giáo viên không khoanh rõ đáp án trong video">* Đáp án tham khảo</span>}
        </p>
      )}
    </li>
  );
}
