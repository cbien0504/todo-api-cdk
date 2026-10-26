import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import OptionButton from "./OptionButton";

const renderOption = (props: { disabled?: boolean } = {}) => {
  const onSelect = vi.fn();
  render(<OptionButton index={0} label="つつんで" state="idle" onSelect={onSelect} {...props} />);
  return { onSelect, option: screen.getByRole("button", { name: /つつんで/ }) };
};

describe("OptionButton", () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  it("is chosen by click, Enter or Space", () => {
    const { onSelect, option } = renderOption();

    fireEvent.click(option);
    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyDown(option, { key: " " });
    fireEvent.keyDown(option, { key: "a" });

    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(option).toHaveAttribute("tabindex", "0");
  });

  it("keeps its text copyable: selecting the text does not choose the option", () => {
    const { onSelect, option } = renderOption();

    const range = document.createRange();
    range.selectNodeContents(screen.getByText("つつんで"));
    window.getSelection()!.addRange(range);
    fireEvent.click(option);

    expect(window.getSelection()!.toString()).toBe("つつんで");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores clicks and keys while disabled", () => {
    const { onSelect, option } = renderOption({ disabled: true });

    fireEvent.click(option);
    fireEvent.keyDown(option, { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveAttribute("tabindex", "-1");
  });
});
