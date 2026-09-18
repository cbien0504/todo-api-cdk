import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "./App";

describe("Mimikara Oboeru N3 Quiz App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the header and quiz statistics", () => {
    render(<App />);

    expect(screen.getByText("Mimikara Oboeru")).toBeInTheDocument();
    expect(screen.getByText("N3 VOCAB")).toBeInTheDocument();
    expect(screen.getByText(/Chọn nghĩa tiếng Việt đúng/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Chưa làm/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cần làm lại/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 4 multiple choice options", () => {
    render(<App />);

    const optionButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.className.includes("option-button"));

    expect(optionButtons).toHaveLength(4);
  });

  it("selects an option and displays feedback with next question button", () => {
    render(<App />);

    const optionButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.className.includes("option-button"));

    expect(optionButtons.length).toBeGreaterThan(0);

    // Click first option
    fireEvent.click(optionButtons[0]);

    // Next button should now be visible
    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();
  });

  it("toggles dark and light mode", () => {
    render(<App />);

    const themeBtn = screen.getByRole("button", { name: /Toggle Theme/i });
    expect(themeBtn).toBeInTheDocument();

    fireEvent.click(themeBtn);
    expect(localStorage.getItem("mimikara_theme")).toBe("light");

    fireEvent.click(themeBtn);
    expect(localStorage.getItem("mimikara_theme")).toBe("dark");
  });

  it("toggles hide Han Viet and saves to localStorage", () => {
    render(<App />);

    const hvBtn = screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i });
    expect(hvBtn).toBeInTheDocument();
    expect(hvBtn).toHaveTextContent(/Hán Việt/i);

    fireEvent.click(hvBtn);
    expect(localStorage.getItem("mimikara_hide_han_viet")).toBe("true");
    expect(hvBtn).toHaveTextContent(/Ẩn Hán Việt/i);

    fireEvent.click(hvBtn);
    expect(localStorage.getItem("mimikara_hide_han_viet")).toBe("false");
  });

  it("toggles hide Hiragana and saves to localStorage", () => {
    render(<App />);

    const hiraBtn = screen.getByRole("button", { name: /Toggle Ẩn Hiragana/i });
    expect(hiraBtn).toBeInTheDocument();

    fireEvent.click(hiraBtn);
    expect(localStorage.getItem("mimikara_hide_hiragana")).toBe("true");
    expect(hiraBtn).toHaveTextContent(/Ẩn Hiragana/i);

    fireEvent.click(hiraBtn);
    expect(localStorage.getItem("mimikara_hide_hiragana")).toBe("false");
  });

  it("resets the batch immediately when batch is reselected or reset button clicked", () => {
    render(<App />);

    // Answer first question
    const optionButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.className.includes("option-button"));
    fireEvent.click(optionButtons[0]);
    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();

    // Click reset batch button
    const resetBtn = screen.getByRole("button", { name: /Reset bài này ngay lập tức/i });
    fireEvent.click(resetBtn);

    // After reset, the answer state should be cleared immediately
    expect(screen.queryByRole("button", { name: /Câu tiếp theo/i })).not.toBeInTheDocument();
  });

  it("toggles mute speaker via button and persists in localStorage", () => {
    render(<App />);

    const muteToggleBtn = screen.getAllByRole("button", { name: /Toggle Loa/i })[0];
    expect(muteToggleBtn).toBeInTheDocument();
    expect(muteToggleBtn).toHaveTextContent("🔊");

    // Click to mute
    fireEvent.click(muteToggleBtn);
    expect(localStorage.getItem("mimikara_is_muted")).toBe("true");
    expect(muteToggleBtn).toHaveTextContent("🔇");

    // Click to unmute
    fireEvent.click(muteToggleBtn);
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
    expect(muteToggleBtn).toHaveTextContent("🔊");
  });

  it("toggles mute speaker via 'm' keyboard shortcut", () => {
    render(<App />);

    const muteToggleBtn = screen.getAllByRole("button", { name: /Toggle Loa/i })[0];
    expect(muteToggleBtn).toHaveTextContent("🔊");

    // Press 'm'
    fireEvent.keyDown(window, { key: "m" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("true");
    expect(muteToggleBtn).toHaveTextContent("🔇");

    // Press 'M'
    fireEvent.keyDown(window, { key: "M" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
    expect(muteToggleBtn).toHaveTextContent("🔊");
  });
});

