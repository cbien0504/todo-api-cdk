import { toPercent } from "../../utils/quizEngine";

interface ProgressPanelProps {
  title: string;
  round: number;
  total: number;
  mastered: number;
  retry: number;
  pendingNew: number;
  streak: number;
  bestStreak: number;
}

export default function ProgressPanel({ title, round, total, mastered, retry, pendingNew, streak, bestStreak }: ProgressPanelProps) {
  const width = (value: number) => `${total > 0 ? (value / total) * 100 : 0}%`;
  const segments = [
    { tone: "success", label: "Đã nhớ", value: mastered },
    { tone: "warning", label: "Cần làm lại", value: retry },
    { tone: "primary", label: "Chưa làm", value: pendingNew },
  ];

  return (
    <section className="card progress-panel">
      <div className="progress-head">
        <div>
          <span className="eyebrow">Lượt {round} · Đang ôn</span>
          <h2 className="progress-title">{title}</h2>
        </div>
        <span className="progress-count">
          <strong>{mastered}</strong> / {total} từ ({toPercent(mastered, total)}%)
        </span>
      </div>

      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={mastered}>
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
          🔥 Chuỗi đúng <strong>{streak}</strong> <span className="muted">(kỷ lục {bestStreak})</span>
        </li>
      </ul>
    </section>
  );
}
