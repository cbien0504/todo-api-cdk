import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ExamPractice from "./ExamPractice";
import { EXAM_QUESTIONS } from "../../utils/examEngine";

const selectPaper = (key: string) => fireEvent.change(screen.getByLabelText("Chọn đề"), { target: { value: key } });
const questionItems = () => screen.getAllByRole("listitem");
const optionsOf = (item: HTMLElement) => Array.from(item.querySelectorAll<HTMLButtonElement>("button.option"));

describe("ExamPractice", () => {
  it("renders a mock paper grouped into the 4 parts of the real N3 exam", () => {
    render(<ExamPractice />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringContaining("問題1漢字読み"),
      expect.stringContaining("問題2表記"),
      expect.stringContaining("問題3文脈規定"),
      expect.stringContaining("問題4言い換え類義"),
    ]);
    expect(questionItems()).toHaveLength(30);
    // Numbering continues across sections like the real paper.
    expect(within(questionItems()[29]).getByText("30")).toBeInTheDocument();
  });

  it("shows a lesson paper with the shared instruction once per section", () => {
    render(<ExamPractice />);
    selectPaper("lesson-1");

    expect(questionItems()).toHaveLength(60);
    expect(screen.getAllByText(/のことばの読み方として最もよいものを/)).toHaveLength(1);
    expect(screen.getAllByText(/のことばを漢字で書くとき/)).toHaveLength(1);

    const first = questionItems()[0];
    expect(first.querySelector("u")!.textContent).toBe("包ん");
    expect(optionsOf(first).map((b) => b.textContent)).toEqual(["1つつんで", "2つづんで", "3つうつんで", "4つうづんで"]);
  });

  it("lets the user change an answer before submitting and scores per section", () => {
    render(<ExamPractice />);
    selectPaper("lesson-1");

    const [q1, q2] = questionItems();
    fireEvent.click(optionsOf(q1)[2]);
    fireEvent.click(optionsOf(q1)[0]); // change mind: つつんで is correct
    fireEvent.click(optionsOf(q2)[0]); // どおくい is wrong (answer: とくい)

    expect(optionsOf(q1)[0]).toHaveAttribute("aria-pressed", "true");
    expect(optionsOf(q1)[2]).not.toHaveAttribute("aria-pressed");
    expect(screen.getByText(/Đã làm/).textContent).toContain("2 / 60");

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));

    expect(screen.getByText("Bạn làm đúng 1/60 câu (2%)")).toBeInTheDocument();
    expect(screen.getByText("1/30 đúng")).toBeInTheDocument();
    expect(screen.getByText("0/30 đúng")).toBeInTheDocument();
    expect(questionItems()[0]).toHaveClass("is-correct");
    expect(questionItems()[1]).toHaveClass("is-wrong");
    expect(optionsOf(questionItems()[1])[3].className).toContain("option--correct");
    expect(screen.queryByRole("button", { name: /Nộp bài/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chỉ xem câu sai/i }));
    expect(questionItems()).toHaveLength(59);

    fireEvent.click(screen.getByRole("button", { name: /Làm lại đề này/i }));
    expect(questionItems()).toHaveLength(60);
    expect(questionItems()[0]).not.toHaveClass("is-correct");
    expect(screen.getByText(/Đã làm/).textContent).toContain("0 / 60");
  });

  it("renders blanks for context questions and fills them with the answer after submit", () => {
    render(<ExamPractice />);
    selectPaper("lesson-5");

    const first = questionItems()[0];
    expect(first.querySelector("u")).toBeNull();
    expect(first.querySelector(".exam-blank")!.textContent).toBe("　　");

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));
    expect(questionItems()[0].querySelector(".exam-blank")!.textContent).toBe("カタログ");
    expect(within(questionItems()[0]).getByText("Chưa trả lời")).toBeInTheDocument();
  });

  it("shows the Hán Việt of a word when its button is clicked", () => {
    render(<ExamPractice />);
    selectPaper("lesson-1");

    // Kanji reading question: only the underlined word has kanji.
    const first = questionItems()[0];
    expect(within(first).getAllByRole("button", { name: /Hán Việt/ })).toHaveLength(1);
    const targetBtn = within(first).getByRole("button", { name: "Xem âm Hán Việt của 包ん" });
    expect(targetBtn).toHaveTextContent("Hán Việt");

    fireEvent.click(targetBtn);
    expect(targetBtn).toHaveTextContent("BAO");
    expect(targetBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(targetBtn);
    expect(targetBtn).toHaveTextContent("Hán Việt");

    // Orthography question: every option is written in kanji.
    const orthography = questionItems().find((item) => within(item).queryByText("正常"))!;
    fireEvent.click(within(orthography).getByRole("button", { name: "Xem âm Hán Việt của 正常" }));
    expect(within(orthography).getByRole("button", { name: /của 正常: CHÁNH THƯỜNG/ })).toBeInTheDocument();
    expect(optionsOf(orthography)).toHaveLength(4);
  });

  it("offers papers by part with every question of that part", () => {
    render(<ExamPractice />);
    selectPaper("part-paraphrase");

    expect(questionItems()).toHaveLength(EXAM_QUESTIONS.filter((q) => q.part === "paraphrase").length);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });
});
