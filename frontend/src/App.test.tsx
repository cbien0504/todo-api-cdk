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
});
