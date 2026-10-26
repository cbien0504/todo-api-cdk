import { useState } from "react";
import { UNREMEMBERED_BATCH_KEY, type VocabDeck } from "../../data/vocabDecks";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { enumCodec, usePersistentState } from "../../hooks/usePersistentState";
import { useSpeech } from "../../hooks/useSpeech";
import { useUnrememberedWords } from "../../hooks/useUnrememberedWords";
import type { VocabSettings } from "../../hooks/useVocabSettings";
import { useVocabSession } from "../../hooks/useVocabSession";
import { trackEvent } from "../../utils/gtm";
import FlashcardPractice from "./FlashcardPractice";
import QuizPractice from "./QuizPractice";
import UnrememberedModal from "./UnrememberedModal";
import VocabToolbar from "./VocabToolbar";

const MODES = [
  { id: "quiz", label: "📝 Trắc nghiệm", hint: "Chọn nghĩa đúng trong 4 đáp án" },
  { id: "flashcard", label: "🧠 Thẻ ghi nhớ", hint: "Lặp lại ngắt quãng: học nhanh, nhớ lâu" },
] as const;

type VocabMode = (typeof MODES)[number]["id"];

const modeCodec = enumCodec<VocabMode>(MODES.map((m) => m.id));

interface VocabPracticeProps {
  deck: VocabDeck;
  active: boolean;
  settings: VocabSettings;
}

export default function VocabPractice({ deck, active, settings }: VocabPracticeProps) {
  const { isMuted, hideHanViet, hideHiragana } = settings;
  const [isListOpen, setIsListOpen] = useState(false);
  const [mode, setMode] = usePersistentState<VocabMode>(`mimikara_vocab_mode_${deck.id}`, "quiz", modeCodec);
  // Restarts the flashcard session whenever a batch is (re)selected.
  const [flashcardRun, setFlashcardRun] = useState(0);

  const { speak, stop, isSpeaking } = useSpeech(isMuted);
  const unremembered = useUnrememberedWords(deck);
  const session = useVocabSession({
    deck,
    unrememberedWords: unremembered.words,
    onAnswer: (question) => speak(question.hiragana),
    onCorrect: unremembered.markKnown,
    onWrong: unremembered.markUnremembered,
  });

  const toggleMute = () => {
    if (!isMuted) stop();
    settings.toggleMute();
  };

  const selectMode = (next: VocabMode) => {
    setMode(next);
    trackEvent("vocab_mode", { level: deck.level, mode: next });
  };

  const selectBatch = (key: string) => {
    session.selectBatch(key);
    setFlashcardRun((run) => run + 1);
  };

  const reviewUnremembered = () => {
    setIsListOpen(false);
    selectBatch(UNREMEMBERED_BATCH_KEY);
  };

  // The speaker shortcut works in both modes; each mode listens to its own other keys.
  useKeyboardShortcuts(active && !isListOpen, (e) => {
    if (e.key.toLowerCase() === "m") {
      e.preventDefault();
      toggleMute();
    }
  });

  return (
    <>
      <div className="mode-switch" role="group" aria-label="Cách học">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-btn ${mode === m.id ? "is-active" : ""}`}
            aria-pressed={mode === m.id}
            onClick={() => selectMode(m.id)}
          >
            <span className="mode-label">{m.label}</span>
            <span className="mode-hint">{m.hint}</span>
          </button>
        ))}
      </div>

      <VocabToolbar
        deck={deck}
        batchKey={session.batchKey}
        unrememberedCount={unremembered.words.length}
        isMuted={isMuted}
        hideHanViet={hideHanViet}
        hideHiragana={hideHiragana}
        onSelectBatch={selectBatch}
        onToggleMute={toggleMute}
        onToggleHanViet={settings.toggleHanViet}
        onToggleHiragana={settings.toggleHiragana}
        onOpenList={() => setIsListOpen(true)}
      />

      {mode === "flashcard" ? (
        <FlashcardPractice
          key={flashcardRun}
          deck={deck}
          title={deck.getBatchTitle(session.batchKey)}
          items={session.items}
          settings={settings}
          active={active && !isListOpen}
          isSpeaking={isSpeaking}
          speak={speak}
          onForget={unremembered.markUnremembered}
          onRecall={unremembered.markKnown}
        />
      ) : (
        <QuizPractice
          deck={deck}
          session={session}
          unremembered={unremembered}
          settings={settings}
          active={active && !isListOpen}
          isSpeaking={isSpeaking}
          speak={speak}
          onSelectBatch={selectBatch}
        />
      )}

      <p className="hint">
        {mode === "flashcard" ? (
          <>
            Phím tắt: <kbd>Space</kbd>/<kbd>Enter</kbd> lật thẻ · <kbd>1</kbd> Quên · <kbd>2</kbd> Khó · <kbd>3</kbd> Nhớ ·{" "}
            <kbd>4</kbd> Dễ · <kbd>M</kbd> bật/tắt loa
          </>
        ) : (
          <>
            Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>C</kbd> chưa nhớ / <kbd>D</kbd> đã nhớ ·{" "}
            <kbd>Space</kbd>/<kbd>Enter</kbd> câu tiếp theo · <kbd>M</kbd> bật/tắt loa
          </>
        )}
        <br />
        Nguồn từ vựng: {deck.source}
      </p>

      {isListOpen && (
        <UnrememberedModal
          words={unremembered.words}
          known={unremembered.known}
          onClose={() => setIsListOpen(false)}
          onReview={reviewUnremembered}
          onSpeak={(item) => speak(item.hiragana, true)}
          companionsOf={deck.companionsOf}
          onMarkRemembered={unremembered.markRemembered}
          onMarkUnremembered={unremembered.markUnremembered}
        />
      )}
    </>
  );
}
