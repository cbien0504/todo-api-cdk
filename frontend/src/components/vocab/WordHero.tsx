import HanVietButton from "../ui/HanVietButton";

interface WordHeroProps {
  word: { kanji: string; hiragana: string; han_viet: string; question_text: string };
  /** The answer is shown: hidden Hiragana and Hán Việt are revealed. */
  revealed: boolean;
  hideHanViet: boolean;
  hideHiragana: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
}

/** Big word of the quiz question and of the flashcard, with its reading, Hán Việt and speaker. */
export default function WordHero({ word, revealed, hideHanViet, hideHiragana, isMuted, isSpeaking, onSpeak }: WordHeroProps) {
  return (
    <div className="word-hero">
      <button
        type="button"
        className={`btn btn--secondary btn--icon btn--round word-audio ${isSpeaking ? "is-playing" : ""}`}
        onClick={onSpeak}
        title={isMuted ? "Loa đang tắt (Nhấn để nghe từ này)" : "Nghe phát âm tiếng Nhật"}
        aria-label="Phát âm tiếng Nhật"
      >
        {isMuted ? "🔇" : "🔊"}
      </button>

      <div className="word-main" lang="ja">
        {word.kanji || word.hiragana}
      </div>
      {word.kanji &&
        (hideHiragana && !revealed ? (
          <div className="word-reading is-hidden" title="Hiragana đang ẩn (sẽ hiện khi trả lời)">
            ••••
          </div>
        ) : (
          <div className={`word-reading ${hideHiragana ? "is-revealed" : ""}`} lang="ja">
            {word.hiragana}
          </div>
        ))}
      {word.han_viet &&
        (hideHanViet && !revealed ? (
          // Keyed by word so the reading is hidden again for the next word.
          <HanVietButton key={word.question_text} word={word.question_text} hanViet={word.han_viet} />
        ) : (
          <span className="badge tone-warning badge--lg">Hán Việt: {word.han_viet}</span>
        ))}
    </div>
  );
}
