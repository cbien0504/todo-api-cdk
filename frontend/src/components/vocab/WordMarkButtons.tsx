import type { WordStatus } from "../../types/progress";

interface WordMarkButtonsProps {
  status: WordStatus | undefined;
  onMarkUnremembered: () => void;
  onMarkRemembered: () => void;
}

/** Chưa nhớ / Đã nhớ buttons (keys C / D) of an answered word: only the learner marks a word remembered. */
export default function WordMarkButtons({ status, onMarkUnremembered, onMarkRemembered }: WordMarkButtonsProps) {
  return (
    <div className="feedback-actions">
      <span className="muted">Đánh dấu:</span>
      <button
        type="button"
        className={`btn btn--xs btn--secondary tone-danger ${status === "u" ? "is-active" : ""}`}
        aria-pressed={status === "u"}
        onClick={onMarkUnremembered}
        title="Đánh dấu từ là chưa nhớ (Phím C)"
      >
        📌 Chưa nhớ (C)
      </button>
      <button
        type="button"
        className={`btn btn--xs btn--secondary tone-success ${status === "k" ? "is-active" : ""}`}
        aria-pressed={status === "k"}
        onClick={onMarkRemembered}
        title="Đánh dấu từ là đã nhớ (Phím D)"
      >
        ✨ Đã nhớ (D)
      </button>
    </div>
  );
}
