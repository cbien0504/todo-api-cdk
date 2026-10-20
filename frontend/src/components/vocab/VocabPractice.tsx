import { useState } from "react";
import {
  FIRST_LESSON,
  FIRST_LESSON_KEY,
  UNREMEMBERED_BATCH_KEY,
  getBatchTitle,
  isUnitBatch,
} from "../../data/vocabBatches";
import { booleanCodec, usePersistentState } from "../../hooks/usePersistentState";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useSpeech } from "../../hooks/useSpeech";
import { useUnrememberedWords } from "../../hooks/useUnrememberedWords";
import { useVocabSession } from "../../hooks/useVocabSession";
import { toPercent } from "../../utils/quizEngine";
import { trackEvent } from "../../utils/gtm";
import ResultPanel from "../ui/ResultPanel";
import VocabTable from "../ui/VocabTable";
import ProgressPanel from "./ProgressPanel";
import QuestionCard from "./QuestionCard";
import UnrememberedModal from "./UnrememberedModal";
import VocabToolbar from "./VocabToolbar";

const FIRST_LESSON_NAME = FIRST_LESSON ? FIRST_LESSON.title : "Bài đầu tiên";

export default function VocabPractice({ active }: { active: boolean }) {
  const [isMuted, setIsMuted] = usePersistentState("mimikara_is_muted", false, booleanCodec);
  const [hideHanViet, setHideHanViet] = usePersistentState("mimikara_hide_han_viet", false, booleanCodec);
  const [hideHiragana, setHideHiragana] = usePersistentState("mimikara_hide_hiragana", false, booleanCodec);
  const [isListOpen, setIsListOpen] = useState(false);

  const { speak, stop, isSpeaking } = useSpeech(isMuted);
  const unremembered = useUnrememberedWords();
  const session = useVocabSession({
    unrememberedWords: unremembered.words,
    onAnswer: (question) => speak(question.hiragana),
    onWrong: unremembered.markUnremembered,
  });

  const isReviewMode = session.batchKey === UNREMEMBERED_BATCH_KEY;
  const remainingToReview = unremembered.words.length;

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (next) stop();
    trackEvent("toggle_mute", { muted: next });
  };

  const toggleHanViet = () => {
    setHideHanViet(!hideHanViet);
    trackEvent("toggle_hide_han_viet", { hide: !hideHanViet });
  };

  const toggleHiragana = () => {
    setHideHiragana(!hideHiragana);
    trackEvent("toggle_hide_hiragana", { hide: !hideHiragana });
  };

  const reviewUnremembered = () => {
    setIsListOpen(false);
    session.selectBatch(UNREMEMBERED_BATCH_KEY);
  };

  // Single primary action of the round-complete screen, shared by its button and Enter/Space.
  const completeAction =
    isReviewMode && remainingToReview === 0
      ? { label: `📖 Quay lại Luyện tập Bài 1 (${FIRST_LESSON_NAME})`, run: () => session.selectBatch(FIRST_LESSON_KEY) }
      : {
          label: isReviewMode
            ? `🔄 Tiếp tục ôn tập (${remainingToReview} từ còn lại)`
            : "🔄 Bắt đầu lượt mới (Shuffle lại)",
          run: session.nextRound,
        };

  const isEmptyReview = isReviewMode && session.items.length === 0;

  useKeyboardShortcuts(active && !isListOpen, (e) => {
    const key = e.key.toLowerCase();
    if (key === "m") {
      e.preventDefault();
      toggleMute();
      return;
    }
    if (isEmptyReview) return;
    if (session.isRoundComplete) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        completeAction.run();
      }
      return;
    }
    if (!session.isAnswered) {
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        session.answer(Number(e.key) - 1);
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      session.next();
    } else if (key === "c") {
      e.preventDefault();
      unremembered.markUnremembered(session.currentItem);
    } else if (key === "d") {
      e.preventDefault();
      unremembered.markRemembered(session.currentItem);
    }
  });

  const accuracy = toPercent(session.correctCount, session.correctCount + session.wrongCount);

  let content;
  if (isEmptyReview) {
    content = (
      <ResultPanel
        icon="🎉"
        title="Danh sách Chưa nhớ hiện đang trống!"
        description="Tuyệt vời! Bạn không có từ vựng nào trong danh sách chưa nhớ. Hãy chọn bài học để luyện tập tiếp nhé!"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => session.selectBatch(FIRST_LESSON_KEY)}>
            📖 Luyện tập Bài 1 ({FIRST_LESSON_NAME})
          </button>
        }
      />
    );
  } else if (session.isRoundComplete) {
    content = (
      <ResultPanel
        icon="🎉"
        title={
          isReviewMode
            ? remainingToReview === 0
              ? "Xuất sắc! Bạn đã thuộc hết tất cả các từ trong danh sách Chưa nhớ!"
              : `Hoàn thành 1 lượt ôn tập! Hiện còn ${remainingToReview} từ chưa nhớ.`
            : "Xuất sắc! Bạn đã nhớ hết tất cả từ vựng!"
        }
        description={
          isReviewMode
            ? "Tất cả các từ trong lượt ôn tập này đã được bạn kiểm tra lại."
            : "Tất cả các câu hỏi trong lượt này (bao gồm cả các từ từng làm sai) đều đã được bạn trả lời chính xác."
        }
        metrics={[
          { label: "Lượt trả lời đúng", value: session.correctCount, tone: "success" },
          { label: "Lượt trả lời sai", value: session.wrongCount, tone: "danger" },
          { label: "Tỉ lệ chính xác", value: `${accuracy}%`, tone: "primary" },
        ]}
        actions={
          <button type="button" className="btn btn--primary" onClick={completeAction.run}>
            {completeAction.label}
          </button>
        }
      >
        {session.wrongWords.length > 0 && (
          <div className="result-section">
            <h3 className="result-section-title">
              📝 Các từ bạn đã từng làm sai trong lượt này ({session.wrongWords.length} từ)
            </h3>
            <VocabTable items={session.wrongWords} showHanViet={!hideHanViet} />
          </div>
        )}
      </ResultPanel>
    );
  } else if (session.question) {
    content = (
      <QuestionCard
        question={session.question}
        item={session.currentItem}
        selectedIndex={session.selectedIndex}
        isCorrect={session.isCorrect}
        isUnitMode={isUnitBatch(session.batchKey)}
        isReviewMode={isReviewMode}
        isUnremembered={unremembered.isUnremembered(session.currentItem)}
        hideHanViet={hideHanViet}
        hideHiragana={hideHiragana}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        onSpeak={() => speak(session.question!.hiragana, true)}
        onAnswer={session.answer}
        onMarkUnremembered={() => unremembered.markUnremembered(session.currentItem)}
        onMarkRemembered={() => unremembered.markRemembered(session.currentItem)}
        onNext={session.next}
      />
    );
  }

  return (
    <>
      <VocabToolbar
        batchKey={session.batchKey}
        unrememberedCount={unremembered.words.length}
        isMuted={isMuted}
        hideHanViet={hideHanViet}
        hideHiragana={hideHiragana}
        onSelectBatch={session.selectBatch}
        onToggleMute={toggleMute}
        onToggleHanViet={toggleHanViet}
        onToggleHiragana={toggleHiragana}
        onOpenList={() => setIsListOpen(true)}
      />

      <ProgressPanel
        title={getBatchTitle(session.batchKey)}
        round={session.round}
        streak={session.streak}
        bestStreak={session.bestStreak}
        {...session.progress}
      />

      {content}

      <p className="hint">
        Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>C</kbd> chưa nhớ / <kbd>D</kbd> đã nhớ ·{" "}
        <kbd>Space</kbd>/<kbd>Enter</kbd> câu tiếp theo · <kbd>M</kbd> bật/tắt loa
      </p>

      {isListOpen && (
        <UnrememberedModal
          words={unremembered.words}
          onClose={() => setIsListOpen(false)}
          onReview={reviewUnremembered}
          onSpeak={(item) => speak(item.hiragana, true)}
          onMarkRemembered={unremembered.markRemembered}
        />
      )}
    </>
  );
}
