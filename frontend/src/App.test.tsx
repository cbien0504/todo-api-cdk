import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import App from "./App";
import { N2_DECK, N3_DECK } from "./data/vocabBatches";

const vocabPanel = () => document.getElementById("panel-vocab")!;
const optionButtons = () => Array.from(vocabPanel().querySelectorAll<HTMLElement>(".option"));
const questionCard = () => vocabPanel().querySelector<HTMLElement>(".question-card")!;
const progressCount = () => vocabPanel().querySelector(".progress-count")!.textContent;
// Both vocabulary panels stay mounted, so queries that also see hidden elements are scoped to the N3 panel.
const batchSelect = () => within(vocabPanel()).getByLabelText<HTMLSelectElement>("Chọn bài");

/** Meaning of the word currently asked, looked up from the vocabulary data. */
const currentMeaning = () => {
  const word = questionCard().querySelector(".word-main")!.textContent;
  const lesson = questionCard().querySelector(".badge.tone-success")?.textContent;
  const item = N3_DECK.items.find((i) => (i.kanji || i.hiragana) === word && (!lesson || i.lesson === lesson));
  return item!.meaning;
};

const answer = (correct: boolean) => {
  const meaning = currentMeaning();
  const button = optionButtons().find((b) => (b.querySelector(".option-text")!.textContent === meaning) === correct);
  fireEvent.click(button!);
};

describe("Mimikara Oboeru N3 – vocabulary practice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the header and quiz statistics", () => {
    render(<App />);

    expect(screen.getByText("Mimikara Oboeru")).toBeInTheDocument();
    expect(screen.getByText("N3 · N2")).toBeInTheDocument();
    expect(within(vocabPanel()).getByText(/Chọn nghĩa tiếng Việt đúng/i)).toBeInTheDocument();
    expect(within(vocabPanel()).getAllByText(/Chưa làm/i).length).toBeGreaterThanOrEqual(1);
    expect(within(vocabPanel()).getAllByText(/Cần làm lại/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 4 multiple choice options", () => {
    render(<App />);
    expect(optionButtons()).toHaveLength(4);
  });

  it("selects an option and displays feedback with next question button", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);

    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();
    optionButtons().forEach((b) => expect(b).toHaveAttribute("aria-disabled", "true"));
  });

  it("counts the current question as pending until it is answered correctly", () => {
    render(<App />);
    expect(progressCount()).toMatch(/^0 \//);

    answer(true);
    expect(progressCount()).toMatch(/^1 \//);
  });

  it("puts a wrongly answered word back in the retry queue and the unremembered list", () => {
    render(<App />);

    answer(false);

    const legend = vocabPanel().querySelector<HTMLElement>(".progress-legend")!;
    expect(within(legend).getByText(/Cần làm lại/).querySelector("strong")!.textContent).toBe("1");
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]")).toHaveLength(1);
    expect(screen.getByText(/tự động thêm vào danh sách Chưa nhớ/i)).toBeInTheDocument();
  });

  it("toggles dark and light mode", () => {
    render(<App />);

    const themeBtn = screen.getByRole("button", { name: /Toggle Theme/i });
    fireEvent.click(themeBtn);
    expect(localStorage.getItem("mimikara_theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(themeBtn);
    expect(localStorage.getItem("mimikara_theme")).toBe("dark");
  });

  it("toggles hide Han Viet and saves to localStorage", () => {
    render(<App />);

    const hvBtn = screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i });
    expect(hvBtn).toHaveTextContent(/Hán Việt: Hiện/i);

    fireEvent.click(hvBtn);
    expect(localStorage.getItem("mimikara_hide_han_viet")).toBe("true");
    expect(hvBtn).toHaveTextContent(/Hán Việt: Ẩn/i);

    // While hidden, the current word reveals its Hán Việt on demand.
    const revealBtn = within(questionCard()).getByRole("button", { name: /Xem âm Hán Việt/ });
    expect(revealBtn).toHaveTextContent("Hán Việt");
    fireEvent.click(revealBtn);
    const word = questionCard().querySelector(".word-main")!.textContent;
    const item = N3_DECK.items.find((i) => (i.kanji || i.hiragana) === word)!;
    expect(revealBtn).toHaveTextContent(item.han_viet);

    fireEvent.click(hvBtn);
    expect(localStorage.getItem("mimikara_hide_han_viet")).toBe("false");
  });

  it("toggles hide Hiragana and saves to localStorage", () => {
    render(<App />);

    const hiraBtn = screen.getByRole("button", { name: /Toggle Ẩn Hiragana/i });

    fireEvent.click(hiraBtn);
    expect(localStorage.getItem("mimikara_hide_hiragana")).toBe("true");
    expect(hiraBtn).toHaveTextContent(/Hiragana: Ẩn/i);

    fireEvent.click(hiraBtn);
    expect(localStorage.getItem("mimikara_hide_hiragana")).toBe("false");
  });

  it("resets the batch immediately when the reset button is clicked", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);
    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reset bài này ngay lập tức/i }));

    expect(screen.queryByRole("button", { name: /Câu tiếp theo/i })).not.toBeInTheDocument();
  });

  it("toggles mute speaker via button and persists in localStorage", () => {
    render(<App />);

    const muteBtn = screen.getByRole("button", { name: /Toggle Loa/i });
    expect(muteBtn).toHaveTextContent("🔊");

    fireEvent.click(muteBtn);
    expect(localStorage.getItem("mimikara_is_muted")).toBe("true");
    expect(muteBtn).toHaveTextContent("🔇");

    fireEvent.click(muteBtn);
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
    expect(muteBtn).toHaveTextContent("🔊");
  });

  it("toggles mute speaker via 'm' keyboard shortcut", () => {
    render(<App />);

    const muteBtn = screen.getByRole("button", { name: /Toggle Loa/i });

    fireEvent.keyDown(window, { key: "m" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("true");
    expect(muteBtn).toHaveTextContent("🔇");

    fireEvent.keyDown(window, { key: "M" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
    expect(muteBtn).toHaveTextContent("🔊");
  });

  it("answers with number keys", () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "2" });

    expect(optionButtons()[1].className).toMatch(/option--(correct|wrong)/);
    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();
  });

  it("marks word as unremembered and remembered after answering, with localStorage persistence", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);

    fireEvent.click(screen.getByRole("button", { name: /Chưa nhớ \(C\)/i }));
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ \(D\)/i }));
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]")).toHaveLength(0);
  });

  it("marks word as unremembered via 'c' and remembered via 'd' keyboard shortcuts", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);

    fireEvent.keyDown(window, { key: "c" });
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]").length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: "d" });
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]")).toHaveLength(0);
  });

  it("starts reviewing unremembered words from the list modal and displays the review mode tag", () => {
    const testVocab = [
      { stt: 999, kanji: "試験", han_viet: "THÍ NGHIỆM", hiragana: "しけん", meaning: "kỳ thi", question_text: "試験 (しけん)" },
    ];
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify(testVocab));

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Xem danh sách từ chưa nhớ/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ôn tập các từ này/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Đang ôn từ chưa nhớ/i)).toBeInTheDocument();
    expect(batchSelect().value).toBe("unremembered");
  });

  it("finishes a review round and continues it with Enter", () => {
    const testVocab = [
      { stt: 999, kanji: "試験", han_viet: "THÍ NGHIỆM", hiragana: "しけん", meaning: "kỳ thi", question_text: "試験 (しけん)" },
    ];
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify(testVocab));

    render(<App />);
    fireEvent.change(batchSelect(), { target: { value: "unremembered" } });

    const correct = optionButtons().find((b) => b.textContent?.includes("kỳ thi"))!;
    fireEvent.click(correct);
    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.getByText(/Hoàn thành 1 lượt ôn tập! Hiện còn 1 từ chưa nhớ/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tiếp tục ôn tập \(1 từ còn lại\)/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText(/Lượt 2/)).toBeInTheDocument();
    expect(optionButtons()).toHaveLength(4);
  });

  it("shows an empty state when reviewing an empty unremembered list", () => {
    render(<App />);

    fireEvent.change(batchSelect(), { target: { value: "unremembered" } });
    expect(screen.getByText(/Danh sách Chưa nhớ hiện đang trống!/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Luyện tập Bài 1/i }));
    expect(optionButtons()).toHaveLength(4);
  });

  it("opens unremembered words modal, displays words list and closes modal", () => {
    const testVocab = [
      { stt: 312, kanji: "家庭", han_viet: "GIA ĐÌNH", hiragana: "かてい", meaning: "gia đình", question_text: "家庭 (かてい)" },
    ];
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify(testVocab));

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Xem danh sách từ chưa nhớ/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Bảng từ chưa nhớ \(1 từ\)/i)).toBeInTheDocument();
    expect(within(dialog).getByText("家庭 (かてい)")).toBeInTheDocument();
    expect(within(dialog).getByText("gia đình")).toBeInTheDocument();
    expect(within(dialog).getByText("GIA ĐÌNH")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Sao chép danh sách/i })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters the modal list, ignores shortcuts while typing and closes with Escape", () => {
    const testVocab = [
      { stt: 312, kanji: "家庭", han_viet: "GIA ĐÌNH", hiragana: "かてい", meaning: "gia đình", question_text: "家庭 (かてい)" },
      { stt: 999, kanji: "試験", han_viet: "THÍ NGHIỆM", hiragana: "しけん", meaning: "kỳ thi", question_text: "試験 (しけん)" },
    ];
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify(testVocab));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Xem danh sách từ chưa nhớ/i }));

    const search = screen.getByRole("searchbox", { name: /Tìm từ chưa nhớ/i });
    fireEvent.change(search, { target: { value: "thi" } });
    fireEvent.keyDown(search, { key: "m" });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("試験 (しけん)")).toBeInTheDocument();
    expect(within(dialog).queryByText("家庭 (かてい)")).not.toBeInTheDocument();
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");

    fireEvent.click(within(dialog).getAllByRole("button", { name: /Đã nhớ/i })[0]);
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]")).toHaveLength(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("divides batches by lesson, renders Unit optgroups and displays lesson tag on question card", () => {
    render(<App />);

    const select = batchSelect();
    expect(select.querySelectorAll("optgroup").length).toBeGreaterThanOrEqual(11);

    // Initial batch is Lesson 1 (progress title, select option and question tag)
    expect(screen.getAllByText(/Unit 1 - Lesson 1: Con người & quan hệ/i).length).toBeGreaterThanOrEqual(2);
    expect(within(questionCard()).getByText(/Unit 1 - Lesson 1/)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "lesson_2" } });
    expect(select.value).toBe("lesson_2");
    expect(screen.getAllByText(/Unit 1 - Lesson 2: Sinh ra, học hành, công việc/i).length).toBeGreaterThanOrEqual(1);
  });

  it("allows practicing an entire unit, updating batch count to total words in that unit", () => {
    render(<App />);

    const select = batchSelect();
    fireEvent.change(select, { target: { value: "unit_1" } });
    expect(select.value).toBe("unit_1");

    expect(screen.getAllByText(/Cả Unit 1 – Con người & cuộc sống/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/\(120 từ\)/i).length).toBeGreaterThanOrEqual(1);
    expect(progressCount()).toMatch(/\/ 120 từ/);
    expect(within(questionCard()).getByText(/Luyện cả Unit/)).toBeInTheDocument();
  });
});

describe("App tabs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("switches to the exam tab, keeps it in localStorage and disables vocab shortcuts", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: /Luyện đề N3/i }));

    expect(localStorage.getItem("mimikara_active_tab")).toBe("exam");
    expect(document.getElementById("panel-vocab")).not.toBeVisible();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-exam");
    expect(screen.getByText("漢字読み", { selector: "h2 span" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "m" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
  });

  it("keeps the vocab session when switching tabs back and forth", () => {
    render(<App />);
    fireEvent.click(optionButtons()[0]);

    fireEvent.click(screen.getByRole("tab", { name: /Luyện đề N3/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Từ vựng N3/i }));

    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();
  });
});

describe("N2 vocabulary tab", () => {
  const n2Panel = () => document.getElementById("panel-vocab-n2")!;
  const n2Card = () => n2Panel().querySelector<HTMLElement>(".question-card")!;

  beforeEach(() => {
    localStorage.clear();
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /Từ vựng N2/i }));
  });

  it("practices the N2 list by chapter and lesson with Hán Việt derived from the kanji", () => {
    expect(localStorage.getItem("mimikara_active_tab")).toBe("vocab-n2");

    const select = within(n2Panel()).getByLabelText<HTMLSelectElement>("Chọn bài");
    expect(select.querySelectorAll("optgroup")).toHaveLength(12);
    expect(within(select).getByText(`📚 Tất cả (${N2_DECK.items.length} từ vựng N2)`)).toBeInTheDocument();
    expect(within(n2Card()).getByText("Chapter 1 - Bài 1: Gia đình")).toBeInTheDocument();
    expect(n2Panel().querySelectorAll(".option")).toHaveLength(4);

    const word = n2Card().querySelector(".word-main")!.textContent;
    const item = N2_DECK.items.find((i) => (i.kanji || i.hiragana) === word)!;
    expect(n2Card().querySelector(".badge--lg")?.textContent ?? "").toBe(item.han_viet ? `Hán Việt: ${item.han_viet}` : "");

    fireEvent.change(select, { target: { value: "unit_12" } });
    expect(within(n2Panel()).getByText("Cả Chapter 12 – Cách nói dễ nhầm lẫn")).toBeInTheDocument();
  });

  it("keeps its own unremembered list and shortcuts", () => {
    fireEvent.click(n2Panel().querySelector<HTMLElement>(".option")!);
    fireEvent.keyDown(window, { key: "c" });

    expect(JSON.parse(localStorage.getItem("mimikara_n2_unremembered_words") || "[]")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("mimikara_unremembered_words") || "[]")).toHaveLength(0);
    // The hidden N3 session did not react to the click or the shortcut.
    expect(within(vocabPanel()).queryByText(/Câu tiếp theo/)).not.toBeInTheDocument();
  });

  it("shares display settings with the N3 tab", () => {
    fireEvent.click(screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Từ vựng N3/i }));

    expect(screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i })).toHaveTextContent(/Hán Việt: Ẩn/i);
  });
});
