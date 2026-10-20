import type { ReactNode, Ref } from "react";
import type { Tone } from "./helpers";

export interface Metric {
  label: string;
  value: ReactNode;
  tone: Tone;
}

interface ResultPanelProps {
  icon: string;
  title: string;
  /** Colors the title; defaults to the celebratory gradient. */
  tone?: Tone;
  description?: ReactNode;
  metrics?: Metric[];
  actions?: ReactNode;
  children?: ReactNode;
  panelRef?: Ref<HTMLElement>;
}

/** Summary card for finished rounds, finished exams and empty states. */
export default function ResultPanel({ icon, title, tone, description, metrics, actions, children, panelRef }: ResultPanelProps) {
  return (
    <section className="card result-panel" ref={panelRef}>
      <div className="result-icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className={`result-title ${tone ? `tone-${tone}` : ""}`}>{title}</h2>
      {description && <p className="result-description">{description}</p>}
      {metrics && metrics.length > 0 && (
        <div className="metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={`metric tone-${metric.tone}`}>
              <span className="metric-value">{metric.value}</span>
              <span className="metric-label">{metric.label}</span>
            </div>
          ))}
        </div>
      )}
      {children}
      {actions && <div className="result-actions">{actions}</div>}
    </section>
  );
}
