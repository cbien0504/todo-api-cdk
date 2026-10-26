import type { ReactNode } from "react";
import type { Tone } from "./helpers";

export interface ProgressSegment {
  tone: Tone;
  label: string;
  value: number;
}

interface ProgressCardProps {
  eyebrow: string;
  title: string;
  /** Summary shown next to the title. */
  count: ReactNode;
  /** Number of words the segments are drawn against. */
  total: number;
  /** Bar segments; the first one is the progress made. */
  segments: ProgressSegment[];
  /** Legend entry after the segments. */
  extra?: ReactNode;
}

/** Segmented progress bar with its legend, for quiz rounds and flashcard sessions. */
export default function ProgressCard({ eyebrow, title, count, total, segments, extra }: ProgressCardProps) {
  const width = (value: number) => `${total > 0 ? (value / total) * 100 : 0}%`;

  return (
    <section className="card progress-panel">
      <div className="progress-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="progress-title">{title}</h2>
        </div>
        <span className="progress-count">{count}</span>
      </div>

      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={segments[0]?.value ?? 0}>
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
        {extra && <li>{extra}</li>}
      </ul>
    </section>
  );
}
