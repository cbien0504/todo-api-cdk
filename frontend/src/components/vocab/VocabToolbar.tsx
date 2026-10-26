import { ALL_BATCH_KEY, UNREMEMBERED_BATCH_KEY, type VocabDeck } from "../../data/vocabBatches";
import SettingToggle from "../ui/SettingToggle";

interface VocabToolbarProps {
  deck: VocabDeck;
  batchKey: string;
  unrememberedCount: number;
  isMuted: boolean;
  hideHanViet: boolean;
  hideHiragana: boolean;
  onSelectBatch: (key: string) => void;
  onToggleMute: () => void;
  onToggleHanViet: () => void;
  onToggleHiragana: () => void;
  onOpenList: () => void;
}

export default function VocabToolbar({
  deck,
  batchKey,
  unrememberedCount,
  isMuted,
  hideHanViet,
  hideHiragana,
  onSelectBatch,
  onToggleMute,
  onToggleHanViet,
  onToggleHiragana,
  onOpenList,
}: VocabToolbarProps) {
  const selectId = `batch-select-${deck.id}`;

  return (
    <section className="card toolbar">
      <div className="toolbar-row">
        <label htmlFor={selectId} className="field-label">
          Chọn bài
        </label>
        <select id={selectId} className="select" value={batchKey} onChange={(e) => onSelectBatch(e.target.value)}>
          <option value={UNREMEMBERED_BATCH_KEY}>📌 Ôn tập từ chưa nhớ ({unrememberedCount} từ)</option>
          <option value={ALL_BATCH_KEY}>
            📚 Tất cả ({deck.items.length} từ vựng {deck.level})
          </option>
          {deck.unitGroups.map((group) => (
            <optgroup key={group.key} label={group.name}>
              <option value={group.key}>{group.label}</option>
              {group.lessons.map((lesson) => (
                <option key={lesson.key} value={lesson.key}>
                  {lesson.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--secondary btn--icon"
          onClick={() => onSelectBatch(batchKey)}
          title="Làm lại bài này từ đầu"
          aria-label="Reset bài này ngay lập tức"
        >
          🔄
        </button>
      </div>

      <div className="toolbar-row">
        <SettingToggle
          label="Loa"
          enabled={!isMuted}
          icons={["🔊", "🔇"]}
          states={["Bật", "Tắt"]}
          ariaLabel="Toggle Loa"
          title={isMuted ? "Bật loa phát âm (Phím M)" : "Tắt loa phát âm (Phím M)"}
          onToggle={onToggleMute}
        />
        <SettingToggle
          label="Hán Việt"
          enabled={!hideHanViet}
          icons={["👁️", "🙈"]}
          states={["Hiện", "Ẩn"]}
          ariaLabel="Toggle Ẩn Hán Việt"
          title={hideHanViet ? "Hiện Hán Việt" : "Ẩn Hán Việt"}
          onToggle={onToggleHanViet}
        />
        <SettingToggle
          label="Hiragana"
          enabled={!hideHiragana}
          icons={["👁️", "🙈"]}
          states={["Hiện", "Ẩn"]}
          ariaLabel="Toggle Ẩn Hiragana"
          title={hideHiragana ? "Hiện Hiragana" : "Ẩn Hiragana trong câu hỏi (hiện lại sau khi trả lời)"}
          onToggle={onToggleHiragana}
        />
        <button
          type="button"
          className="btn btn--sm btn--secondary tone-warning toolbar-end"
          onClick={onOpenList}
          title="Xem, tìm kiếm và ôn tập các từ chưa nhớ"
          aria-label="Xem danh sách từ chưa nhớ"
        >
          📌 Từ chưa nhớ <span className="count-pill">{unrememberedCount}</span>
        </button>
      </div>
    </section>
  );
}
