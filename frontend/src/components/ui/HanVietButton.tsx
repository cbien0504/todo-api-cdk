import { useState } from "react";
import { getHanViet } from "../../utils/hanViet";
import { trackEvent } from "../../utils/gtm";

interface HanVietButtonProps {
  word: string;
  /** Known reading of the word; looked up from its kanji when omitted. */
  hanViet?: string;
}

/** Chip that shows the Hán Việt reading of a word when clicked; renders nothing for kana-only words. */
export default function HanVietButton({ word, hanViet = getHanViet(word) }: HanVietButtonProps) {
  const [shown, setShown] = useState(false);
  if (!hanViet) return null;

  const toggle = () => {
    setShown(!shown);
    if (!shown) trackEvent("han_viet_reveal", { word });
  };

  return (
    <button
      type="button"
      className={`btn btn--xs btn--secondary tone-warning hanviet-btn ${shown ? "is-active" : ""}`}
      onClick={toggle}
      aria-pressed={shown}
      aria-label={shown ? `Âm Hán Việt của ${word}: ${hanViet}` : `Xem âm Hán Việt của ${word}`}
      title={shown ? "Ẩn âm Hán Việt" : "Xem âm Hán Việt"}
      lang="vi"
    >
      {shown ? hanViet : "Hán Việt"}
    </button>
  );
}
