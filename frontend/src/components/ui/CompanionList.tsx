import type { Companion } from "../../types/quiz";
import { getHanViet } from "../../utils/hanViet";
import { COMPANION_TYPES } from "./helpers";

interface CompanionListProps {
  companions: Companion[];
  onSpeak?: (reading: string) => void;
}

/** Words learned together with the current one ("học 1 được 2"): its verb pair, synonyms or antonyms. */
export default function CompanionList({ companions, onSpeak }: CompanionListProps) {
  if (companions.length === 0) return null;

  return (
    <div className="companions">
      <p className="companions-title">🔗 Học 1 được 2</p>
      <ul className="companion-list">
        {companions.map((companion) => {
          const { label, tone } = COMPANION_TYPES[companion.type];
          const hanViet = getHanViet(companion.word);
          return (
            <li key={`${companion.type}-${companion.word}`} className="companion">
              <span className={`badge tone-${tone}`}>{label}</span>
              <span className="companion-word" lang="ja">
                {companion.word}
              </span>
              {companion.reading && (
                <span className="companion-reading" lang="ja">
                  {companion.reading}
                </span>
              )}
              {hanViet && <span className="companion-hanviet">{hanViet}</span>}
              <span className="companion-meaning">{companion.meaning}</span>
              {onSpeak && (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--xs"
                  onClick={() => onSpeak(companion.reading ?? companion.word)}
                  title="Nghe phát âm"
                  aria-label={`Nghe phát âm ${companion.word}`}
                >
                  🔊
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
