import { useMemo, useState } from "react";
import type { VocabItem } from "../../types/quiz";
import { trackEvent } from "../../utils/gtm";
import Modal from "../ui/Modal";
import VocabTable from "../ui/VocabTable";

interface UnrememberedModalProps {
  words: VocabItem[];
  onClose: () => void;
  onReview: () => void;
  onSpeak: (item: VocabItem) => void;
  onMarkRemembered: (item: VocabItem) => void;
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

export default function UnrememberedModal({ words, onClose, onReview, onSpeak, onMarkRemembered }: UnrememberedModalProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? words.filter((item) => matchesQuery(item, q)) : words;
  }, [words, query]);

  const copyList = () => {
    navigator.clipboard
      ?.writeText(formatForClipboard(words))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((e) => console.error("Failed to copy unremembered words", e));
    trackEvent("copy_unremembered_text", { count: words.length });
  };

  return (
    <Modal
      title={`📋 Bảng từ chưa nhớ (${words.length} từ)`}
      subtitle="Xem bảng từ vựng, tìm kiếm, sao chép và ôn tập lại"
      onClose={onClose}
      toolbar={
        <>
          <input
            type="search"
            className="input"
            placeholder="🔍 Tìm theo Kanji, Hiragana, Hán Việt hoặc nghĩa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm từ chưa nhớ"
          />
          <button type="button" className="btn btn--sm btn--secondary" onClick={copyList} disabled={words.length === 0}>
            {copied ? "✅ Đã sao chép!" : "📋 Sao chép danh sách"}
          </button>
        </>
      }
      footer={
        <>
          <span className="muted">
            Hiển thị: <strong>{filtered.length}</strong> / {words.length} từ
          </span>
          <div className="modal-footer-actions">
            {words.length > 0 && (
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
      {words.length === 0 ? (
        <p className="empty-state">🎉 Danh sách Chưa nhớ hiện đang trống!</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Không tìm thấy từ vựng nào khớp với từ khóa "{query}".</p>
      ) : (
        <VocabTable
          items={filtered}
          onSpeak={onSpeak}
          renderAction={(item) => (
            <button
              type="button"
              className="btn btn--xs btn--secondary tone-success"
              onClick={() => onMarkRemembered(item)}
              title="Đánh dấu đã nhớ (gỡ khỏi danh sách chưa nhớ)"
            >
              ✨ Đã nhớ
            </button>
          )}
        />
      )}
    </Modal>
  );
}
