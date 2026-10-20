export type Tone = "primary" | "success" | "warning" | "danger" | "info";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

interface OptionStateInput {
  isSelected: boolean;
  isAnswer: boolean;
  revealed: boolean;
}

export const getOptionState = ({ isSelected, isAnswer, revealed }: OptionStateInput): OptionState => {
  if (!revealed) return isSelected ? "selected" : "idle";
  if (isAnswer) return "correct";
  return isSelected ? "wrong" : "dimmed";
};

export const toneForPercent = (percent: number): "success" | "warning" | "danger" =>
  percent >= 80 ? "success" : percent >= 50 ? "warning" : "danger";
