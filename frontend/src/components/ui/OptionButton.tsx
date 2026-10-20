import type { OptionState } from "./helpers";

interface OptionButtonProps {
  index: number;
  label: string;
  state: OptionState;
  disabled?: boolean;
  lang?: string;
  onSelect: () => void;
}

/** Numbered multiple-choice option shared by the vocabulary quiz and the exam papers. */
export default function OptionButton({ index, label, state, disabled, lang, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      className={`option option--${state}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={state === "selected" || state === "wrong" || undefined}
    >
      <span className="option-key">{index + 1}</span>
      <span className="option-text" lang={lang}>
        {label}
      </span>
      {state === "correct" && <span aria-hidden="true">✅</span>}
      {state === "wrong" && <span aria-hidden="true">❌</span>}
    </button>
  );
}
