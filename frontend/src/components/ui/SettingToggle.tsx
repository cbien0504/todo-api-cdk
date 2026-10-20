interface SettingToggleProps {
  label: string;
  enabled: boolean;
  icons: [on: string, off: string];
  states: [on: string, off: string];
  ariaLabel: string;
  title: string;
  onToggle: () => void;
}

/** On/off chip for a display setting; highlighted while the setting is turned off. */
export default function SettingToggle({ label, enabled, icons, states, ariaLabel, title, onToggle }: SettingToggleProps) {
  return (
    <button
      type="button"
      className={`btn btn--sm btn--secondary ${enabled ? "" : "is-off"}`}
      onClick={onToggle}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={!enabled}
    >
      {enabled ? icons[0] : icons[1]} {label}: {enabled ? states[0] : states[1]}
    </button>
  );
}
