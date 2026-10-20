import type { ReactNode } from "react";
import type { VocabItem } from "../../types/quiz";

interface VocabTableProps {
  items: VocabItem[];
  showHanViet?: boolean;
  onSpeak?: (item: VocabItem) => void;
  renderAction?: (item: VocabItem) => ReactNode;
}

/** Vocabulary list used by the round summary and the unremembered-words modal. */
export default function VocabTable({ items, showHanViet = true, onSpeak, renderAction }: VocabTableProps) {
  return (
    <div className="table-wrap">
      <table className="vocab-table">
        <thead>
          <tr>
            <th className="col-stt">STT</th>
            <th>Từ vựng</th>
            {showHanViet && <th>Hán Việt</th>}
            <th>Nghĩa tiếng Việt</th>
            {renderAction && <th className="col-action">Hành động</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.stt}-${item.question_text}`}>
              <td className="col-stt">{item.stt ? `#${item.stt}` : idx + 1}</td>
              <td>
                <div className="vocab-word">
                  <span className="vocab-jp" lang="ja">
                    {item.question_text}
                  </span>
                  {onSpeak && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon btn--xs"
                      onClick={() => onSpeak(item)}
                      title="Nghe phát âm"
                      aria-label={`Nghe phát âm ${item.hiragana}`}
                    >
                      🔊
                    </button>
                  )}
                </div>
                {item.lesson && <div className="vocab-lesson">📖 {item.lesson}</div>}
              </td>
              {showHanViet && (
                <td>{item.han_viet ? <span className="badge tone-warning">{item.han_viet}</span> : <span className="muted">-</span>}</td>
              )}
              <td className="vocab-meaning">{item.meaning}</td>
              {renderAction && <td className="col-action">{renderAction(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
