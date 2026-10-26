import { useState } from "react";
import { getItemKey, type VocabDeck } from "../../data/vocabBatches";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useSrsProgress } from "../../hooks/useSrsProgress";
import type { VocabItem } from "../../types/quiz";
import { trackEvent } from "../../utils/gtm";
import {
  NEW_CARDS_PER_SESSION,
  buildStudyQueue,
  dayNumber,
  intervalLabel,
  srsStats,
  type SrsGrade,
} from "../../utils/srs";
import CompanionList from "../ui/CompanionList";
import ResultPanel from "../ui/ResultPanel";
import type { Tone } from "../ui/helpers";
import WordHero from "./WordHero";

const GRADES: { grade: SrsGrade; label: string; key: string; tone: Tone }[] = [
  { grade: "again", label: "😵 Quên", key: "1", tone: "danger" },
  { grade: "hard", label: "🤔 Khó", key: "2", tone: "warning" },
  { grade: "good", label: "🙂 Nhớ", key: "3", tone: "success" },
  { grade: "easy", label: "🚀 Dễ", key: "4", tone: "info" },
];

/** A forgotten card comes back after this many other cards. */
const RELEARN_GAP = 3;

interface FlashcardPracticeProps {
  deck: VocabDeck;
  title: string;
  /** Words of the selected batch. */
  items: VocabItem[];
  /** Keyboard shortcuts are listened to. */
  active: boolean;
  hideHanViet: boolean;
  hideHiragana: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  speak: (text: string, force?: boolean) => void;
  onForget: (item: VocabItem) => void;
}

/**
 * Flashcards with spaced repetition: recall the meaning, flip the card, then grade how well
 * it was remembered. Remembered words come back after longer and longer intervals.
 */
export default function FlashcardPractice({
  deck,
  title,
  items,
  active,
  hideHanViet,
  hideHiragana,
  isMuted,
  isSpeaking,
  speak,
  onForget,
}: FlashcardPracticeProps) {
  const { cards, grade } = useSrsProgress(deck.srsStorageKey);
  const [today] = useState(dayNumber);
  const [queue, setQueue] = useState(() => buildStudyQueue(items, cards, getItemKey, today, NEW_CARDS_PER_SESSION));
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<SrsGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });

  const current = queue[0];
  const card = current ? cards[getItemKey(current)] : undefined;
  const stats = srsStats(items, cards, getItemKey, today);
  const reviewed = results.again + results.hard + results.good + results.easy;
  const nextNewCount = Math.min(NEW_CARDS_PER_SESSION, stats.unseen);

  const flip = () => {
    if (!current || flipped) return;
    setFlipped(true);
    speak(current.hiragana);
  };

  const answer = (value: SrsGrade) => {
    if (!current || !flipped) return;
    grade(getItemKey(current), value, today);
    const rest = queue.slice(1);
    if (value === "again") {
      onForget(current);
      setQueue([...rest.slice(0, RELEARN_GAP), current, ...rest.slice(RELEARN_GAP)]);
    } else {
      setQueue(rest);
    }
    setFlipped(false);
    setResults({ ...results, [value]: results[value] + 1 });
    trackEvent("flashcard_grade", { level: deck.level, grade: value, word: current.question_text, isNew: !card });
  };

  const learnMore = () => {
    setQueue(buildStudyQueue(items, cards, getItemKey, today, NEW_CARDS_PER_SESSION));
    trackEvent("flashcard_learn_more", { level: deck.level, count: nextNewCount });
  };

  useKeyboardShortcuts(active, (e) => {
    const isConfirm = e.key === "Enter" || e.key === " ";
    if (!current) {
      if (isConfirm && nextNewCount > 0) {
        e.preventDefault();
        learnMore();
      }
      return;
    }
    if (!flipped) {
      if (isConfirm) {
        e.preventDefault();
        flip();
      }
      return;
    }
    const match = GRADES.find((g) => g.key === e.key);
    if (match) {
      e.preventDefault();
      answer(match.grade);
    }
  });

  const width = (value: number) => `${stats.total > 0 ? (value / stats.total) * 100 : 0}%`;
  const segments = [
    { tone: "success", label: "Đã thuộc", value: stats.mastered },
    { tone: "warning", label: "Đang học", value: stats.learning },
    { tone: "primary", label: "Chưa học", value: stats.unseen },
  ];

  return (
    <>
      <section className="card progress-panel">
        <div className="progress-head">
          <div>
            <span className="eyebrow">Thẻ ghi nhớ · Lặp lại ngắt quãng</span>
            <h2 className="progress-title">{title}</h2>
          </div>
          <span className="progress-count">
            Hôm nay đã ôn <strong>{reviewed}</strong> thẻ · còn {queue.length}
          </span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.mastered}>
          {segments.map((s) => (
            <span key={s.label} className={`progress-seg tone-${s.tone}`} style={{ width: width(s.value) }} title={`${s.label}: ${s.value} từ`} />
          ))}
        </div>
        <ul className="progress-legend">
          {segments.map((s) => (
            <li key={s.label}>
              <span className={`dot tone-${s.tone}`} />
              {s.label} <strong>{s.value}</strong>
            </li>
          ))}
          <li>
            ⏰ Đến hạn ôn <strong>{stats.due}</strong>
          </li>
        </ul>
      </section>

      {current ? (
        <section className="card question-card flashcard">
          <div className="question-head">
            <div className="badge-row">
              {current.stt && <span className="badge tone-primary">#{current.stt}</span>}
              {current.lesson && <span className="badge tone-success badge--truncate">{current.lesson}</span>}
              <span className={`badge ${card ? "tone-info" : "tone-warning"}`}>
                {card ? `🔁 Ôn tập lần ${card.reviews + 1}` : "🆕 Từ mới"}
              </span>
            </div>
            <span className="eyebrow">{flipped ? "Bạn nhớ từ này đến đâu?" : "Nhớ lại nghĩa rồi lật thẻ"}</span>
          </div>

          <WordHero
            word={current}
            revealed={flipped}
            hideHanViet={hideHanViet}
            hideHiragana={hideHiragana}
            isMuted={isMuted}
            isSpeaking={isSpeaking}
            onSpeak={() => speak(current.hiragana, true)}
          />

          {flipped ? (
            <>
              <div className="flashcard-back">
                <p className="flashcard-meaning">{current.meaning}</p>
                <CompanionList companions={deck.companionsOf(current)} onSpeak={(text) => speak(text, true)} />
              </div>
              <div className="grade-buttons" role="group" aria-label="Tự đánh giá mức độ nhớ">
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    className={`btn btn--secondary tone-${g.tone} grade-btn`}
                    onClick={() => answer(g.grade)}
                  >
                    <span>
                      {g.label} <kbd>{g.key}</kbd>
                    </span>
                    <small>{intervalLabel(card, g.grade)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className="btn btn--primary flashcard-flip" onClick={flip}>
              👀 Lật thẻ <kbd>Space / Enter ↵</kbd>
            </button>
          )}
        </section>
      ) : (
        <ResultPanel
          icon="🎉"
          title={reviewed > 0 ? "Hoàn thành phiên ôn tập!" : "Không có thẻ nào cần ôn lúc này"}
          description={
            stats.dueTomorrow > 0
              ? `Ngày mai có ${stats.dueTomorrow} thẻ đến hạn ôn – quay lại đúng hẹn để nhớ lâu.`
              : "Các từ đã học sẽ tự quay lại đúng lúc bạn sắp quên."
          }
          metrics={reviewed > 0 ? GRADES.map((g) => ({ label: g.label, value: results[g.grade], tone: g.tone })) : undefined}
          actions={
            nextNewCount > 0 && (
              <button type="button" className="btn btn--primary" onClick={learnMore}>
                ➕ Học thêm {nextNewCount} từ mới <kbd>Enter ↵</kbd>
              </button>
            )
          }
        />
      )}
    </>
  );
}
