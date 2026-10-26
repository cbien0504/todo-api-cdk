import type { KeyboardEvent, MouseEvent } from "react";
import type { OptionState } from "./helpers";

interface OptionButtonProps {
  index: number;
  label: string;
  state: OptionState;
  disabled?: boolean;
  lang?: string;
  onSelect: () => void;
}

/** True when the user dragged across the option to select its text rather than to choose it. */
const hasSelectionIn = (element: HTMLElement) => {
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && element.contains(selection.anchorNode);
};

/**
 * Numbered multiple-choice option shared by the vocabulary quiz and the exam papers.
 * It is a `role="button"` element instead of a `<button>` so its text can be selected
 * and copied: browsers do not allow selecting text inside buttons.
 */
export default function OptionButton({ index, label, state, disabled, lang, onSelect }: OptionButtonProps) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!disabled && !hasSelectionIn(e.currentTarget)) onSelect();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
    // Activate like a native button without also firing the page's keyboard shortcuts.
    e.preventDefault();
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`option option--${state}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled || undefined}
      aria-pressed={state === "selected" || state === "wrong" || undefined}
    >
      <span className="option-key">{index + 1}</span>
      <span className="option-text" lang={lang}>
        {label}
      </span>
      {state === "correct" && <span aria-hidden="true">✅</span>}
      {state === "wrong" && <span aria-hidden="true">❌</span>}
    </div>
  );
}
