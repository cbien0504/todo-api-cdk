import { UNREMEMBERED_BATCH_KEY, isUnitBatch, type VocabDeck } from "../../data/vocabDecks";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import type { UnrememberedWords } from "../../hooks/useUnrememberedWords";
import type { VocabSettings } from "../../hooks/useVocabSettings";
import type { VocabSession } from "../../hooks/useVocabSession";
import { toPercent } from "../../utils/quizEngine";
import ProgressCard from "../ui/ProgressCard";
import ResultPanel from "../ui/ResultPanel";
import VocabTable from "../ui/VocabTable";
import QuestionCard from "./QuestionCard";

interface QuizPracticeProps {
  deck: VocabDeck;
  session: VocabSession;
  unremembered: UnrememberedWords;
  settings: VocabSettings;
  /** Keyboard shortcuts are listened to. */
  active: boolean;
  isSpeaking: boolean;
  speak: (text: string, force?: boolean) => void;
  onSelectBatch: (key: string) => void;
}

/** Multiple-choice quiz: pick the Vietnamese meaning; wrong answers come back later in the round. */
export default function QuizPractice({
  deck,
  session,
  unremembered,
  settings,
  active,
  isSpeaking,
  speak,
  onSelectBatch,
}: QuizPracticeProps) {
  const { isMuted, hideHanViet, hideHiragana } = settings;
  const firstLessonName = deck.firstLesson ? deck.firstLesson.title : "Bài đầu tiên";
  const isReviewMode = session.batchKey === UNREMEMBERED_BATCH_KEY;
  const remainingToReview = unremembered.words.length;
  const isEmptyReview = isReviewMode && session.items.length === 0;

  // Single primary action of the round-complete screen, shared by its button and Enter/Space.
  const completeAction =
    isReviewMode && remainingToReview === 0
      ? { label: `📖 Quay lại Luyện tập Bài 1 (${firstLessonName})`, run: () => onSelectBatch(deck.firstLessonKey) }
      : {
          label: isReviewMode
            ? `🔄 Tiếp tục ôn tập (${remainingToReview} từ còn lại)`
            : "🔄 Bắt đầu lượt mới (Shuffle lại)",
          run: session.nextRound,
        };

  useKeyboardShortcuts(active && !isEmptyReview, (e) => {
    const key = e.key.toLowerCase();
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

  const { total, mastered, retry, pendingNew } = session.progress;
  const accuracy = toPercent(session.correctCount, session.correctCount + session.wrongCount);

  let content;
  if (isEmptyReview) {
    content = (
      <ResultPanel
        icon="🎉"
        title="Danh sách Chưa nhớ hiện đang trống!"
        description="Tuyệt vời! Bạn không có từ vựng nào trong danh sách chưa nhớ. Hãy chọn bài học để luyện tập tiếp nhé!"
        actions={
          <button type="button" className="btn btn--primary" onClick={() => onSelectBatch(deck.firstLessonKey)}>
            📖 Luyện tập Bài 1 ({firstLessonName})
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
            <VocabTable items={session.wrongWords} showHanViet={!hideHanViet} companionsOf={deck.companionsOf} />
          </div>
        )}
      </ResultPanel>
    );
  } else if (session.question) {
    content = (
      <QuestionCard
        question={session.question}
        item={session.currentItem}
        companions={session.currentItem ? deck.companionsOf(session.currentItem) : []}
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
        onSpeakText={(text) => speak(text, true)}
        onAnswer={session.answer}
        onMarkUnremembered={() => unremembered.markUnremembered(session.currentItem)}
        onMarkRemembered={() => unremembered.markRemembered(session.currentItem)}
        onNext={session.next}
      />
    );
  }

  return (
    <>
      <ProgressCard
        eyebrow={`Lượt ${session.round} · Đang ôn`}
        title={deck.getBatchTitle(session.batchKey)}
        count={
          <>
            <strong>{mastered}</strong> / {total} từ ({toPercent(mastered, total)}%)
          </>
        }
        total={total}
        segments={[
          { tone: "success", label: "Đã nhớ", value: mastered },
          { tone: "warning", label: "Cần làm lại", value: retry },
          { tone: "primary", label: "Chưa làm", value: pendingNew },
        ]}
        extra={
          <>
            🔥 Chuỗi đúng <strong>{session.streak}</strong> <span className="muted">(kỷ lục {session.bestStreak})</span>
          </>
        }
      />
      {content}
    </>
  );
}
