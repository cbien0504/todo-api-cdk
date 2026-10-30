import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ExamPractice from "./ExamPractice";
import { N2_EXAM, N3_EXAM } from "../../data/examBanks";

const EXAM_QUESTIONS = N3_EXAM.questions;

const selectPaper = (key: string) => fireEvent.change(screen.getByLabelText("Chọn đề"), { target: { value: key } });
const questionItems = () => screen.getAllByRole("listitem");
const optionsOf = (item: HTMLElement) => Array.from(item.querySelectorAll<HTMLElement>(".option"));
const optionTexts = (item: HTMLElement) => optionsOf(item).map((b) => b.querySelector(".option-text")!.textContent);
// Options are shuffled, so tests pick them by text.
const optionOf = (item: HTMLElement, text: string) => optionsOf(item)[optionTexts(item).indexOf(text)];
const optionOrders = () => questionItems().map((item) => optionTexts(item).join("|"));

describe("ExamPractice (N3)", () => {
  it("renders a mock paper grouped into the 4 parts of the real N3 exam", () => {
    render(<ExamPractice bank={N3_EXAM} />);

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
    render(<ExamPractice bank={N3_EXAM} />);
    selectPaper("lesson-1");

    expect(questionItems()).toHaveLength(60);
    expect(screen.getAllByText(/のことばの読み方として最もよいものを/)).toHaveLength(1);
    expect(screen.getAllByText(/のことばを漢字で書くとき/)).toHaveLength(1);

    const first = questionItems()[0];
    expect(first.querySelector("u")!.textContent).toBe("包ん");
    expect(optionsOf(first).map((b) => b.querySelector(".option-key")!.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(optionTexts(first).sort()).toEqual(["つうつんで", "つうづんで", "つつんで", "つづんで"]);
  });

  it("lets the user change an answer before submitting and scores per section", () => {
    render(<ExamPractice bank={N3_EXAM} />);
    selectPaper("lesson-1");

    const [q1, q2] = questionItems();
    fireEvent.click(optionOf(q1, "つうつんで"));
    fireEvent.click(optionOf(q1, "つつんで")); // change mind: つつんで is correct
    fireEvent.click(optionOf(q2, "どおくい")); // wrong (answer: とくい)

    expect(optionOf(q1, "つつんで")).toHaveAttribute("aria-pressed", "true");
    expect(optionOf(q1, "つうつんで")).not.toHaveAttribute("aria-pressed");
    expect(screen.getByText(/Đã làm/).textContent).toContain("2 / 60");

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));

    expect(screen.getByText("Bạn làm đúng 1/60 câu (2%)")).toBeInTheDocument();
    expect(screen.getByText("1/30 đúng")).toBeInTheDocument();
    expect(screen.getByText("0/30 đúng")).toBeInTheDocument();
    expect(questionItems()[0]).toHaveClass("is-correct");
    expect(questionItems()[1]).toHaveClass("is-wrong");
    expect(optionOf(questionItems()[1], "とくい").className).toContain("option--correct");
    expect(screen.queryByRole("button", { name: /Nộp bài/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Chỉ xem câu sai/i }));
    expect(questionItems()).toHaveLength(59);

    fireEvent.click(screen.getByRole("button", { name: /Làm lại đề này/i }));
    expect(questionItems()).toHaveLength(60);
    expect(questionItems()[0]).not.toHaveClass("is-correct");
    expect(screen.getByText(/Đã làm/).textContent).toContain("0 / 60");
  });

  it("shuffles the options of every new attempt and keeps the right answer", () => {
    render(<ExamPractice bank={N3_EXAM} />);
    selectPaper("lesson-1");
    const first = optionOrders();

    fireEvent.click(screen.getByRole("button", { name: "Làm lại đề" }));
    const second = optionOrders();
    // 60 questions of 4 options: the chance that no order changes is negligible.
    expect(second).not.toEqual(first);
    second.forEach((order, idx) => expect(order.split("|").sort()).toEqual(first[idx].split("|").sort()));

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));
    const correct = questionItems().map((item) => item.querySelector(".option--correct .option-text")!.textContent);
    expect(correct).toEqual(EXAM_QUESTIONS.filter((q) => q.lesson === 1).map((q) => q.options[q.answer]));
  });

  it("retries a mock paper with the same questions and options in a new order", () => {
    render(<ExamPractice bank={N3_EXAM} />);
    const sentences = () => questionItems().map((item) => item.querySelector(".exam-sentence")!.textContent);
    const questions = sentences();
    const orders = optionOrders();

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));
    fireEvent.click(screen.getByRole("button", { name: /Làm lại đề này/i }));

    expect(sentences()).toEqual(questions);
    expect(optionOrders()).not.toEqual(orders);
  });

  it("renders blanks for context questions and fills them with the answer after submit", () => {
    render(<ExamPractice bank={N3_EXAM} />);
    selectPaper("lesson-5");

    const first = questionItems()[0];
    expect(first.querySelector("u")).toBeNull();
    expect(first.querySelector(".exam-blank")!.textContent).toBe("　　");

    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));
    expect(questionItems()[0].querySelector(".exam-blank")!.textContent).toBe("カタログ");
    expect(within(questionItems()[0]).getByText("Chưa trả lời")).toBeInTheDocument();
  });

  it("shows the Hán Việt of a word when its button is clicked", () => {
    render(<ExamPractice bank={N3_EXAM} />);
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

    // A new attempt hides the readings again.
    fireEvent.click(screen.getByRole("button", { name: "Làm lại đề" }));
    expect(screen.queryByRole("button", { name: /của 正常: / })).not.toBeInTheDocument();
  });

  it("offers papers by part with every question of that part", () => {
    render(<ExamPractice bank={N3_EXAM} />);
    selectPaper("part-paraphrase");

    expect(questionItems()).toHaveLength(EXAM_QUESTIONS.filter((q) => q.part === "paraphrase").length);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });
});

describe("ExamPractice (N2)", () => {
  it("renders a mock paper with the parts of the jtest.net quizzes", () => {
    render(<ExamPractice bank={N2_EXAM} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringContaining("問題1文脈規定"),
      expect.stringContaining("問題2言い換え類義"),
      expect.stringContaining("問題3用法"),
    ]);
    expect(questionItems()).toHaveLength(17);
    expect(screen.getByRole("option", { name: "Quiz 26 (10 câu)" })).toBeInTheDocument();
  });

  it("shows usage questions as the word with one sentence per option", () => {
    render(<ExamPractice bank={N2_EXAM} />);
    selectPaper("lesson-19");

    const first = questionItems()[0];
    expect(first.querySelector(".exam-sentence")!.textContent).toBe("違反Hán Việt");
    expect(first.querySelector(".options")).toHaveClass("options--stacked");
    expect(optionTexts(first)).toContain("ルールに違反して退場になった選手が３人もいる。");
    // Only the word has a Hán Việt button, not the sentences.
    expect(within(first).getAllByRole("button", { name: /Hán Việt/ })).toHaveLength(1);
  });

  it("explains every answer after submitting", () => {
    render(<ExamPractice bank={N2_EXAM} />);
    selectPaper("lesson-1");

    const first = questionItems()[0];
    expect(first.querySelector(".exam-explanation")).toBeNull();
    fireEvent.click(optionOf(first, "弱点"));
    fireEvent.click(screen.getByRole("button", { name: /Nộp bài/i }));

    const answered = questionItems()[0];
    expect(answered).toHaveClass("is-correct");
    expect(answered.querySelector(".exam-blank")!.textContent).toBe("弱点");
    expect(within(answered).getByText("弱点（じゃくてん）: điểm yếu")).toBeInTheDocument();
    expect(within(answered).getByText("Vị tổng thống trẻ tuổi có điểm yếu là thiếu kinh nghiệm.")).toBeInTheDocument();
    expect(within(answered).getByText("Nguồn: Quiz 1 – câu 1")).toBeInTheDocument();
    expect(within(questionItems()[2]).getByText("象牙（ぞうげ）: ngà voi · 密猟（みつりょう）: săn trộm")).toBeInTheDocument();
  });
});
