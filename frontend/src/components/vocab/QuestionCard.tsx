import type { WordStatus } from "../../types/progress";
import type { Companion, VocabItem } from "../../types/quiz";
import type { SessionQuestion } from "../../hooks/useVocabSession";
import CompanionList from "../ui/CompanionList";
import OptionButton from "../ui/OptionButton";
import { getOptionState } from "../ui/helpers";
import WordHero from "./WordHero";
import WordMarkButtons from "./WordMarkButtons";

interface QuestionCardProps {
  question: SessionQuestion;
  item: VocabItem | null;
  /** Words shown with the answer ("học 1 được 2"). */
  companions: Companion[];
  selectedIndex: number | null;
  isCorrect: boolean;
  isUnitMode: boolean;
  isReviewMode: boolean;
  /** Status of the word in the learner's progress; `undefined` while it was never marked. */
  status: WordStatus | undefined;
  hideHanViet: boolean;
  hideHiragana: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onSpeakText: (text: string) => void;
  onAnswer: (index: number) => void;
  onMarkUnremembered: () => void;
  onMarkRemembered: () => void;
  onNext: () => void;
}

export default function QuestionCard({
  question,
  item,
  companions,
  selectedIndex,
  isCorrect,
  isUnitMode,
  isReviewMode,
  status,
  hideHanViet,
  hideHiragana,
  isMuted,
  isSpeaking,
  onSpeak,
  onSpeakText,
  onAnswer,
  onMarkUnremembered,
  onMarkRemembered,
  onNext,
}: QuestionCardProps) {
  const isAnswered = selectedIndex !== null;

  return (
    <section className="card question-card">
      <div className="question-head">
        <div className="badge-row">
          {question.stt && <span className="badge tone-primary">#{question.stt}</span>}
          {isUnitMode && <span className="badge tone-warning">🎯 Luyện cả Unit</span>}
          {question.lesson && <span className="badge tone-success badge--truncate">{question.lesson}</span>}
          {isReviewMode && <span className="badge tone-warning">📌 Đang ôn từ chưa nhớ</span>}
          {question.isRetry && <span className="badge tone-warning">↩ Câu hỏi ôn tập lại</span>}
        </div>
        <span className="eyebrow">Chọn nghĩa tiếng Việt đúng</span>
      </div>

      <WordHero
        word={question}
        revealed={isAnswered}
        hideHanViet={hideHanViet}
        hideHiragana={hideHiragana}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        onSpeak={onSpeak}
      />

      <div className="options options--stacked">
        {question.options.map((option, idx) => (
          <OptionButton
            key={idx}
            index={idx}
            label={option}
            state={getOptionState({
              isSelected: selectedIndex === idx,
              isAnswer: option === question.answer,
              revealed: isAnswered,
            })}
            disabled={isAnswered}
            onSelect={() => onAnswer(idx)}
          />
        ))}
      </div>

      {isAnswered && (
        <div className={`feedback tone-${isCorrect ? "success" : "danger"}`}>
          <div className="feedback-body">
            <div className="feedback-title">
              <span>{isCorrect ? "✅ Chính xác!" : "❌ Chưa chính xác!"}</span>
              {item && status && (
                <span className={`badge tone-${status === "u" ? "danger" : "success"}`}>
                  {status === "u" ? "📌 Chưa nhớ" : "✨ Đã nhớ"}
                </span>
              )}
            </div>
            <p className="feedback-text">
              <strong lang="ja">{question.question_text}</strong>
              {question.han_viet ? ` [Hán Việt: ${question.han_viet}]` : ""} = <strong>{question.answer}</strong>
              {!isCorrect && " (tự động thêm vào danh sách Chưa nhớ)"}
            </p>
            <CompanionList companions={companions} onSpeak={onSpeakText} />
            {item && (
              <WordMarkButtons status={status} onMarkUnremembered={onMarkUnremembered} onMarkRemembered={onMarkRemembered} />
            )}
          </div>
          <button type="button" className="btn btn--primary" onClick={onNext}>
            Câu tiếp theo <kbd>Space / Enter ↵</kbd>
          </button>
        </div>
      )}
    </section>
  );
}
