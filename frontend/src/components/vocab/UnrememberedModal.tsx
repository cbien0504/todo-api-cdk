import { useMemo, useState } from "react";
import type { Companion, VocabItem } from "../../types/quiz";
import { trackEvent } from "../../utils/gtm";
import Modal from "../ui/Modal";
import VocabTable from "../ui/VocabTable";

const LISTS = {
  unremembered: {
    label: "📌 Chưa nhớ",
    title: "📋 Bảng từ chưa nhớ",
    search: "Tìm từ chưa nhớ",
    empty: "🎉 Danh sách Chưa nhớ hiện đang trống!",
    tone: "tone-warning",
  },
  known: {
    label: "✅ Đã nhớ",
    title: "✅ Bảng từ đã nhớ",
    search: "Tìm từ đã nhớ",
    empty: "Chưa có từ nào: bấm “Đã nhớ” (phím D) sau khi trả lời hoặc lật thẻ để thêm từ vào đây.",
    tone: "tone-success",
  },
} as const;

type ListId = keyof typeof LISTS;

interface UnrememberedModalProps {
  /** Words to review (chưa nhớ). */
  words: VocabItem[];
  /** Remembered words (đã nhớ). */
  known: VocabItem[];
  onClose: () => void;
  onReview: () => void;
  onSpeak: (item: VocabItem) => void;
  companionsOf: (item: VocabItem) => Companion[];
  onMarkRemembered: (item: VocabItem) => void;
  onMarkUnremembered: (item: VocabItem) => void;
}

const matchesQuery = (item: VocabItem, q: string) =>
  [item.question_text, item.kanji, item.hiragana, item.han_viet, item.meaning, item.lesson, String(item.stt)].some(
    (field) => field?.toLowerCase().includes(q)
  );

const formatForClipboard = (words: VocabItem[]) =>
  words
    .map((item, index) => {
      const stt = item.stt ? `[#${item.stt}] ` : "";
      const hanViet = item.han_viet ? ` [Hán Việt: ${item.han_viet}]` : "";
      return `${index + 1}. ${stt}${item.question_text}${hanViet} : ${item.meaning}`;
    })
    .join("\n");

/** The learner's words to review and remembered words of a deck: search, copy, review, move between lists. */
export default function UnrememberedModal({
  words,
  known,
  onClose,
  onReview,
  onSpeak,
  companionsOf,
  onMarkRemembered,
  onMarkUnremembered,
}: UnrememberedModalProps) {
  const [list, setList] = useState<ListId>("unremembered");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const shown = list === "unremembered" ? words : known;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? shown.filter((item) => matchesQuery(item, q)) : shown;
  }, [shown, query]);

  const copyList = () => {
    navigator.clipboard
      ?.writeText(formatForClipboard(shown))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((e) => console.error("Failed to copy the word list", e));
    trackEvent(list === "unremembered" ? "copy_unremembered_text" : "copy_known_text", { count: shown.length });
  };

  return (
    <Modal
      title={`${LISTS[list].title} (${shown.length} từ)`}
      subtitle="Xem bảng từ vựng, tìm kiếm, sao chép và ôn tập lại"
      onClose={onClose}
      toolbar={
        <>
          <div className="list-switch" role="group" aria-label="Danh sách từ">
            {(Object.keys(LISTS) as ListId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`btn btn--sm btn--secondary ${LISTS[id].tone} ${list === id ? "is-active" : ""}`}
                aria-pressed={list === id}
                onClick={() => setList(id)}
              >
                {LISTS[id].label} <span className="count-pill">{(id === "unremembered" ? words : known).length}</span>
              </button>
            ))}
          </div>
          <input
            type="search"
            className="input"
            placeholder="🔍 Tìm theo Kanji, Hiragana, Hán Việt hoặc nghĩa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={LISTS[list].search}
          />
          <button type="button" className="btn btn--sm btn--secondary" onClick={copyList} disabled={shown.length === 0}>
            {copied ? "✅ Đã sao chép!" : "📋 Sao chép danh sách"}
          </button>
        </>
      }
      footer={
        <>
          <span className="muted">
            Hiển thị: <strong>{filtered.length}</strong> / {shown.length} từ
          </span>
          <div className="modal-footer-actions">
            {list === "unremembered" && words.length > 0 && (
              <button type="button" className="btn btn--sm btn--secondary tone-warning" onClick={onReview}>
                📌 Ôn tập các từ này
              </button>
            )}
            <button type="button" className="btn btn--sm btn--primary" onClick={onClose}>
              Đóng
            </button>
          </div>
        </>
      }
    >
      {shown.length === 0 ? (
        <p className="empty-state">{LISTS[list].empty}</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Không tìm thấy từ vựng nào khớp với từ khóa "{query}".</p>
      ) : (
        <VocabTable
          items={filtered}
          onSpeak={onSpeak}
          companionsOf={companionsOf}
          renderAction={(item) =>
            list === "unremembered" ? (
              <button
                type="button"
                className="btn btn--xs btn--secondary tone-success"
                onClick={() => onMarkRemembered(item)}
                title="Đánh dấu đã nhớ (gỡ khỏi danh sách chưa nhớ)"
              >
                ✨ Đã nhớ
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--xs btn--secondary tone-warning"
                onClick={() => onMarkUnremembered(item)}
                title="Chuyển lại vào danh sách chưa nhớ để ôn tập"
              >
                📌 Chưa nhớ
              </button>
            )
          }
        />
      )}
    </Modal>
  );
}
