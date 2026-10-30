import type { ExamQuestion } from "../../types/exam";
import HanVietButton from "../ui/HanVietButton";
import OptionButton from "../ui/OptionButton";
import { getOptionState } from "../ui/helpers";

interface ExamQuestionItemProps {
  question: ExamQuestion;
  displayNumber: number;
  /** Lesson of the source the question comes from: "Bài 1", "Quiz 1". */
  lessonName: string;
  selected: number | undefined;
  submitted: boolean;
  onAnswer: (index: number) => void;
}

export default function ExamQuestionItem({
  question,
  displayNumber,
  lessonName,
  selected,
  submitted,
  onAnswer,
}: ExamQuestionItemProps) {
  const { before, target, after, note, options, answer, explanation } = question;
  // Usage options are whole sentences: one per row, without the Hán Việt of every kanji.
  const isUsage = question.part === "usage";
  const status = !submitted ? "" : selected === undefined ? "is-skipped" : selected === answer ? "is-correct" : "is-wrong";

  return (
    <li className={`exam-question ${status}`} aria-label={`Câu ${displayNumber}`}>
      <div className="exam-question-head">
        <span className="exam-number">{displayNumber}</span>
        <p className="exam-sentence" lang="ja">
          {before}
          {target ? (
            <>
              <u className="exam-target">{target}</u>
              <HanVietButton word={target} />
            </>
          ) : (
            <span className={`exam-blank ${submitted ? "is-filled" : ""}`}>{submitted ? options[answer] : "　　"}</span>
          )}
          {after}
        </p>
      </div>
      {note && <p className="exam-note">💡 {note}</p>}

      <div className={`options ${isUsage ? "options--stacked" : "options--grid"}`} role="group" aria-label={`Đáp án câu ${displayNumber}`}>
        {options.map((option, idx) => (
          <div key={idx} className="option-cell">
            <OptionButton
              index={idx}
              label={option}
              lang="ja"
              state={getOptionState({ isSelected: selected === idx, isAnswer: idx === answer, revealed: submitted })}
              disabled={submitted}
              onSelect={() => onAnswer(idx)}
            />
            {!isUsage && <HanVietButton word={option} />}
          </div>
        ))}
      </div>

      {submitted && explanation && (
        <div className="exam-explanation">
          <p>
            📘 <span lang="ja">{explanation.word}</span>
          </p>
          <p>{explanation.translation}</p>
          {explanation.vocab && <p className="muted">{explanation.vocab.join(" · ")}</p>}
        </div>
      )}

      {submitted && (
        <p className="exam-meta">
          {selected === undefined && <span className="badge tone-warning">Chưa trả lời</span>}
          <span>
            Nguồn: {lessonName} – câu {question.number}
          </span>
          {question.inferred && <span title="Giáo viên không khoanh rõ đáp án trong video">* Đáp án tham khảo</span>}
        </p>
      )}
    </li>
  );
}
