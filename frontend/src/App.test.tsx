import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import App from "./App";
import { N2_DECK, N3_DECK, N4_DECK, N5_DECK, getItemKey } from "./data/vocabDecks";
import { serveFakeApi } from "./test/fakeApi";
import type { DeckId, DeckProgress, WordStatus } from "./types/progress";
import type { VocabItem } from "./types/quiz";
import { progressStorageKey } from "./utils/progressStore";

const USER = "tester";

const vocabPanel = () => document.getElementById("panel-n3-vocab")!;
const optionButtons = () => Array.from(vocabPanel().querySelectorAll<HTMLElement>(".option"));
const questionCard = () => vocabPanel().querySelector<HTMLElement>(".question-card")!;
const progressCount = () => vocabPanel().querySelector(".progress-count")!.textContent;
// Every vocabulary panel stays mounted, so queries that also see hidden elements are scoped to the N3 panel.
const batchSelect = () => within(vocabPanel()).getByLabelText<HTMLSelectElement>("Chọn bài");
const listButton = () => within(vocabPanel()).getByRole("button", { name: /Xem danh sách từ chưa nhớ/i });
const levelTab = (level: string) => screen.getByRole("tab", { name: new RegExp(`^${level} `) });
const shownPanels = () => screen.getAllByRole("tabpanel").map((panel) => panel.id);
const n3Word = (word: string) => N3_DECK.items.find((i) => (i.kanji || i.hiragana) === word)!;

/** The item asked in the N3 question card, looked up from the vocabulary data. */
const currentItem = () => {
  const word = questionCard().querySelector(".word-main")!.textContent;
  const lesson = questionCard().querySelector(".badge.tone-success")?.textContent;
  return N3_DECK.items.find((i) => (i.kanji || i.hiragana) === word && (!lesson || i.lesson === lesson))!;
};

const answer = (correct: boolean) => {
  const { meaning } = currentItem();
  const button = optionButtons().find((b) => (b.querySelector(".option-text")!.textContent === meaning) === correct);
  fireEvent.click(button!);
};

/** Progress of a learner in a deck, as cached on this device. */
const progressOf = (deck: DeckId, user = USER): DeckProgress =>
  JSON.parse(localStorage.getItem(progressStorageKey(user)) ?? "{}").decks?.[deck] ?? { words: {}, cards: {} };

const wordsWith = (status: WordStatus, deck: DeckId, user = USER) =>
  Object.entries(progressOf(deck, user).words)
    .filter(([, entry]) => entry.s === status)
    .map(([key]) => key);

/** Logs USER in, with these words to review in a deck saved on this device. */
const loginWithUnremembered = (deck: DeckId, items: VocabItem[]) => {
  localStorage.setItem("mimikara_user", USER);
  const words = Object.fromEntries(items.map((item, i) => [getItemKey(item), { s: "u", t: i + 1 }]));
  localStorage.setItem(progressStorageKey(USER), JSON.stringify({ decks: { [deck]: { words, cards: {} } }, dirty: {} }));
};

const PASSWORD = "mat-khau-1";

const submitAccount = (button: "Đăng nhập" | "Đăng ký", username: string, password = PASSWORD) => {
  fireEvent.change(screen.getByLabelText("Tên đăng nhập"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: button }));
};
const login = (username: string, password?: string) => submitAccount("Đăng nhập", username, password);
const register = (username: string, password?: string) => submitAccount("Đăng ký", username, password);

/** Logging out saves the last changes first, then shows the login. */
const logout = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  // A role query over every mounted level is too slow to poll.
  await screen.findByLabelText("Mật khẩu", {}, { timeout: 5_000 });
};

describe("Mimikara Oboeru N3 – vocabulary practice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("mimikara_user", USER);
  });

  it("renders the header and quiz statistics", () => {
    render(<App />);

    expect(screen.getByText("Mimikara Oboeru")).toBeInTheDocument();
    expect(screen.getByText("N5 – N2")).toBeInTheDocument();
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
    expect(wordsWith("u", "n3")).toHaveLength(1);
    expect(screen.getByText(/tự động thêm vào danh sách Chưa nhớ/i)).toBeInTheDocument();
  });

  it("counts a word as remembered only once the learner marks it, in the level tab and the word lists", () => {
    render(<App />);
    const word = currentItem();
    expect(levelTab("N3")).toHaveTextContent(`0/${N3_DECK.items.length}`);

    answer(true);
    expect(progressOf("n3").words).toEqual({});
    expect(within(questionCard()).getByRole("button", { name: /Đã nhớ \(D\)/ })).toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(window, { key: "d" });
    expect(wordsWith("k", "n3")).toEqual([getItemKey(word)]);
    expect(levelTab("N3")).toHaveTextContent(`1/${N3_DECK.items.length}`);

    fireEvent.click(listButton());
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /✅ Đã nhớ/ }));
    expect(within(dialog).getByText(/Bảng từ đã nhớ \(1 từ\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(word.question_text)).toBeInTheDocument();

    // Back to the words to review.
    fireEvent.click(within(dialog).getByRole("button", { name: "📌 Chưa nhớ" }));
    expect(wordsWith("u", "n3")).toEqual([getItemKey(word)]);
    expect(levelTab("N3")).toHaveTextContent(`0/${N3_DECK.items.length}`);
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

  it("marks word as unremembered and remembered after answering", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);

    fireEvent.click(screen.getByRole("button", { name: /Chưa nhớ \(C\)/i }));
    expect(wordsWith("u", "n3")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Đã nhớ \(D\)/i }));
    expect(wordsWith("u", "n3")).toHaveLength(0);
    expect(wordsWith("k", "n3")).toHaveLength(1);
  });

  it("marks word as unremembered via 'c' and remembered via 'd' keyboard shortcuts", () => {
    render(<App />);

    fireEvent.click(optionButtons()[0]);

    fireEvent.keyDown(window, { key: "c" });
    expect(wordsWith("u", "n3")).toHaveLength(1);

    fireEvent.keyDown(window, { key: "d" });
    expect(wordsWith("u", "n3")).toHaveLength(0);
  });

  it("starts reviewing unremembered words from the list modal and displays the review mode tag", () => {
    loginWithUnremembered("n3", [n3Word("家庭")]);
    render(<App />);

    fireEvent.click(listButton());
    fireEvent.click(screen.getByRole("button", { name: /Ôn tập các từ này/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Đang ôn từ chưa nhớ/i)).toBeInTheDocument();
    expect(batchSelect().value).toBe("unremembered");
  });

  it("finishes a review round and continues it with Enter", () => {
    loginWithUnremembered("n3", [n3Word("家庭")]);
    render(<App />);
    fireEvent.change(batchSelect(), { target: { value: "unremembered" } });

    fireEvent.click(optionButtons().find((b) => b.querySelector(".option-text")!.textContent === "gia đình")!);
    fireEvent.keyDown(window, { key: "Enter" });

    // A correct answer does not take a word out of the list: "Đã nhớ" does.
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
    loginWithUnremembered("n3", [n3Word("家庭")]);
    render(<App />);

    fireEvent.click(listButton());

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
    loginWithUnremembered("n3", [n3Word("家庭"), n3Word("コンテスト")]);
    render(<App />);
    fireEvent.click(listButton());

    const search = screen.getByRole("searchbox", { name: /Tìm từ chưa nhớ/i });
    fireEvent.change(search, { target: { value: "thi" } });
    fireEvent.keyDown(search, { key: "m" });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("コンテスト")).toBeInTheDocument();
    expect(within(dialog).queryByText("家庭 (かてい)")).not.toBeInTheDocument();
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");

    fireEvent.click(within(dialog).getByRole("button", { name: "✨ Đã nhớ" }));
    expect(wordsWith("u", "n3")).toEqual([getItemKey(n3Word("家庭"))]);

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

  it("shows how many words of each batch are remembered and ticks a learned lesson", () => {
    const lesson = N3_DECK.firstLesson!;
    const [first, ...rest] = lesson.items;
    localStorage.setItem(
      progressStorageKey(USER),
      JSON.stringify({
        decks: { n3: { words: Object.fromEntries(rest.map((item, i) => [getItemKey(item), { s: "k", t: i + 1 }])), cards: {} } },
        dirty: {},
      })
    );
    render(<App />);

    const option = (key: string) => batchSelect().querySelector(`option[value="${key}"]`)!.textContent;
    const ratio = `${rest.length}/${lesson.items.length} đã nhớ`;
    expect(option(lesson.key)).toBe(`${lesson.title} (${ratio})`);
    expect(option("unit_1")).toMatch(new RegExp(`\\(${rest.length}/120 đã nhớ\\)$`));
    expect(option("all")).toBe(`📚 Tất cả từ vựng N3 (${rest.length}/${N3_DECK.items.length} đã nhớ)`);

    // A correct answer leaves the word as it is: the learner marks it Đã nhớ, which ticks the lesson.
    while (getItemKey(currentItem()) !== getItemKey(first)) {
      answer(true);
      fireEvent.keyDown(window, { key: "Enter" });
    }
    answer(true);
    expect(option(lesson.key)).toBe(`${lesson.title} (${ratio})`);
    fireEvent.keyDown(window, { key: "d" });
    expect(option(lesson.key)).toBe(`✅ ${lesson.title} (${lesson.items.length}/${lesson.items.length} đã nhớ)`);

    fireEvent.keyDown(window, { key: "c" });
    expect(option(lesson.key)).toBe(`${lesson.title} (${ratio})`);
  });

  it("practices only the words not marked Đã nhớ yet, new words included, until all are marked", () => {
    const lesson = N3_DECK.firstLesson!;
    const [newWord, reviewWord, ...rest] = lesson.items;
    const words = {
      [getItemKey(reviewWord)]: { s: "u", t: 1 },
      ...Object.fromEntries(rest.map((item, i) => [getItemKey(item), { s: "k", t: i + 2 }])),
    };
    localStorage.setItem(progressStorageKey(USER), JSON.stringify({ decks: { n3: { words, cards: {} } }, dirty: {} }));
    render(<App />);

    const filter = within(vocabPanel()).getByRole("button", { name: /Chỉ từ chưa thuộc/ });
    fireEvent.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("mimikara_only_unlearned_n3")).toBe("true");
    expect(progressCount()).toMatch(/\/ 2 từ/);

    const asked = [];
    for (let i = 0; i < 2; i++) {
      asked.push(getItemKey(currentItem()));
      answer(true);
      fireEvent.keyDown(window, { key: "d" });
      fireEvent.keyDown(window, { key: "Enter" });
    }
    expect(asked.sort()).toEqual([getItemKey(newWord), getItemKey(reviewWord)].sort());

    // The next round has no word left to learn.
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByText("Bạn đã nhớ hết các từ ở đây!")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Luyện lại cả phần/ }));
    expect(filter).toHaveAttribute("aria-pressed", "false");
    expect(progressCount()).toMatch(new RegExp(`/ ${lesson.items.length} từ`));
  });

  it("marks a flashcard remembered only with the Đã nhớ button, not with its grade", () => {
    render(<App />);
    fireEvent.click(within(vocabPanel()).getByRole("button", { name: /Thẻ ghi nhớ/ }));

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "4" });
    expect(progressOf("n3").words).toEqual({});

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "d" });
    expect(wordsWith("k", "n3")).toHaveLength(1);
    expect(within(vocabPanel()).getByRole("button", { name: /Đã nhớ \(D\)/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(window, { key: "1" });
    expect(wordsWith("k", "n3")).toHaveLength(0);
    expect(wordsWith("u", "n3")).toHaveLength(1);
  });

  it("allows practicing an entire unit, updating batch count to total words in that unit", () => {
    render(<App />);

    const select = batchSelect();
    fireEvent.change(select, { target: { value: "unit_1" } });
    expect(select.value).toBe("unit_1");

    expect(screen.getAllByText(/Cả Unit 1 – Con người & cuộc sống/i).length).toBeGreaterThanOrEqual(1);
    expect(within(select).getByText("🎯 Cả Unit 1 – Con người & cuộc sống (0/120 đã nhớ)")).toBeInTheDocument();
    expect(progressCount()).toMatch(/\/ 120 từ/);
    expect(within(questionCard()).getByText(/Luyện cả Unit/)).toBeInTheDocument();
  });
});

describe("JLPT levels and their sections", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mimikara_user", USER);
  });

  it("lists the levels from N5 to N2 and opens the N3 vocabulary first", () => {
    render(<App />);

    const levels = within(screen.getByRole("tablist", { name: "Cấp độ JLPT" })).getAllByRole("tab");
    expect(levels.map((tab) => tab.querySelector(".level-name")!.textContent)).toEqual(["N5", "N4", "N3", "N2"]);
    expect(levelTab("N5")).toHaveTextContent(`0/${N5_DECK.items.length}`);
    expect(levelTab("N3")).toHaveAttribute("aria-selected", "true");
    expect(shownPanels()).toEqual(["level-n3", "panel-n3-vocab"]);
  });

  it("switches to the N3 exam papers, keeps them in localStorage and disables vocab shortcuts", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: /Luyện đề/i }));

    expect(localStorage.getItem("mimikara_section")).toBe("exam");
    expect(vocabPanel()).not.toBeVisible();
    expect(shownPanels()).toEqual(["level-n3", "panel-n3-exam"]);
    expect(screen.getByText("漢字読み", { selector: "h2 span" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "m" });
    expect(localStorage.getItem("mimikara_is_muted")).toBe("false");
  });

  it("keeps the vocab session when switching sections and levels back and forth", () => {
    render(<App />);
    fireEvent.click(optionButtons()[0]);

    fireEvent.click(screen.getByRole("tab", { name: /Luyện đề/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Từ vựng/i }));
    fireEvent.click(levelTab("N2"));
    fireEvent.click(levelTab("N3"));

    expect(screen.getByRole("button", { name: /Câu tiếp theo/i })).toBeInTheDocument();
  });

  it("shows the vocabulary of a level without exam papers, then the N3 papers again", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /Luyện đề/i }));

    fireEvent.click(levelTab("N5"));
    expect(localStorage.getItem("mimikara_level")).toBe("n5");
    expect(shownPanels()).toEqual(["level-n5", "panel-n5-vocab"]);
    const sections = within(screen.getByRole("tablist", { name: "Mục học N5" })).getAllByRole("tab");
    expect(sections.map((tab) => tab.textContent)).toEqual(["📖 Từ vựng"]);

    fireEvent.click(levelTab("N3"));
    expect(shownPanels()).toEqual(["level-n3", "panel-n3-exam"]);
  });

  it("opens the level saved in localStorage", () => {
    localStorage.setItem("mimikara_level", "n4");
    render(<App />);

    expect(levelTab("N4")).toHaveAttribute("aria-selected", "true");
    expect(shownPanels()).toEqual(["level-n4", "panel-n4-vocab"]);
  });
});

describe("N5 and N4 vocabulary", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mimikara_user", USER);
    render(<App />);
  });

  it.each([
    { level: "N5", deck: N5_DECK, chapters: 10, firstLesson: "Chapter 1 - Bài 1: Là" },
    { level: "N4", deck: N4_DECK, chapters: 7, firstLesson: "Chapter 1 - Bài 1: Thời gian" },
  ])("practices the $level list of jtest.net by chapter and lesson", ({ level, deck, chapters, firstLesson }) => {
    fireEvent.click(levelTab(level));

    const panel = document.getElementById(`panel-${deck.id}-vocab`)!;
    const select = within(panel).getByLabelText<HTMLSelectElement>("Chọn bài");
    expect(select.querySelectorAll("optgroup")).toHaveLength(chapters);
    expect(within(select).getByText(`📚 Tất cả từ vựng ${level} (0/${deck.items.length} đã nhớ)`)).toBeInTheDocument();
    expect(within(panel.querySelector<HTMLElement>(".question-card")!).getByText(firstLesson)).toBeInTheDocument();
    expect(panel.querySelectorAll(".option")).toHaveLength(4);
    expect(panel.querySelector(".hint")).toHaveTextContent(`Nguồn từ vựng: ${deck.source}`);
  });

  it("keeps its own unremembered list and flashcard progress", () => {
    fireEvent.click(levelTab("N5"));
    const panel = document.getElementById("panel-n5-vocab")!;

    fireEvent.click(panel.querySelector<HTMLElement>(".option")!);
    fireEvent.keyDown(window, { key: "c" });
    expect(wordsWith("u", "n5")).toHaveLength(1);
    expect(wordsWith("u", "n3")).toHaveLength(0);
    // The hidden N3 session did not react to the click or the shortcut.
    expect(within(vocabPanel()).queryByText(/Câu tiếp theo/)).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: /Thẻ ghi nhớ/ }));
    expect(localStorage.getItem("mimikara_vocab_mode_n5")).toBe("flashcard");
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "3" });
    expect(Object.values(progressOf("n5").cards)).toEqual([expect.objectContaining({ box: 1, reviews: 1 })]);
    expect(progressOf("n3").cards).toEqual({});
  });
});

describe("N2 vocabulary", () => {
  const n2Panel = () => document.getElementById("panel-n2-vocab")!;
  const n2Card = () => n2Panel().querySelector<HTMLElement>(".question-card")!;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mimikara_user", USER);
    render(<App />);
    fireEvent.click(levelTab("N2"));
  });

  it("practices the N2 list by chapter and lesson with Hán Việt derived from the kanji", () => {
    expect(localStorage.getItem("mimikara_level")).toBe("n2");

    const select = within(n2Panel()).getByLabelText<HTMLSelectElement>("Chọn bài");
    expect(select.querySelectorAll("optgroup")).toHaveLength(12);
    expect(within(select).getByText(`📚 Tất cả từ vựng N2 (0/${N2_DECK.items.length} đã nhớ)`)).toBeInTheDocument();
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

    expect(wordsWith("u", "n2")).toHaveLength(1);
    expect(wordsWith("u", "n3")).toHaveLength(0);
    // The hidden N3 session did not react to the click or the shortcut.
    expect(within(vocabPanel()).queryByText(/Câu tiếp theo/)).not.toBeInTheDocument();
  });

  it("shares display settings with the N3 vocabulary", () => {
    fireEvent.click(screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i }));
    fireEvent.click(levelTab("N3"));

    expect(screen.getByRole("button", { name: /Toggle Ẩn Hán Việt/i })).toHaveTextContent(/Hán Việt: Ẩn/i);
  });
});

describe("Học 1 được 2 and flashcards", () => {
  const word = n3Word("倒れる");
  const srsCards = () => progressOf("n3").cards;

  beforeEach(() => {
    localStorage.clear();
    loginWithUnremembered("n3", [word]);
    render(<App />);
    fireEvent.change(batchSelect(), { target: { value: "unremembered" } });
  });

  it("shows the companion words with the answer of the quiz", () => {
    expect(questionCard().querySelector(".companions")).toBeNull();

    fireEvent.click(optionButtons().find((b) => b.textContent?.includes(word.meaning))!);

    const companions = within(questionCard()).getByText("🔗 Học 1 được 2").parentElement!;
    expect(within(companions).getByText("Tha động từ")).toBeInTheDocument();
    expect(within(companions).getByText("倒す")).toBeInTheDocument();
    expect(within(companions).getByText("たおす")).toBeInTheDocument();
  });

  it("studies words as flashcards graded with spaced repetition", () => {
    fireEvent.click(within(vocabPanel()).getByRole("button", { name: /Thẻ ghi nhớ/ }));
    expect(localStorage.getItem("mimikara_vocab_mode_n3")).toBe("flashcard");

    const card = () => vocabPanel().querySelector<HTMLElement>(".flashcard")!;
    expect(within(card()).getByText("🆕 Từ mới")).toBeInTheDocument();
    expect(within(card()).queryByText(word.meaning)).not.toBeInTheDocument();

    // Flip with Space: meaning and companions on the back.
    fireEvent.keyDown(window, { key: " " });
    expect(within(card()).getByText(word.meaning)).toBeInTheDocument();
    expect(within(card()).getByText("倒す")).toBeInTheDocument();

    // Forgotten: comes back in the same session and stays in the unremembered list.
    fireEvent.keyDown(window, { key: "1" });
    expect(srsCards()[getItemKey(word)]).toMatchObject({ box: 0, lapses: 1 });
    expect(within(card()).getByText("🔁 Ôn tập lần 2")).toBeInTheDocument();

    fireEvent.click(within(card()).getByRole("button", { name: /Lật thẻ/ }));
    fireEvent.click(within(card()).getByRole("button", { name: /Nhớ/ }));

    expect(srsCards()[getItemKey(word)]).toMatchObject({ box: 1, reviews: 2 });
    expect(within(vocabPanel()).getByText("Hoàn thành phiên ôn tập!")).toBeInTheDocument();
    expect(within(vocabPanel()).getByText(/Ngày mai có 1 thẻ đến hạn ôn/)).toBeInTheDocument();
    expect(wordsWith("u", "n3")).toEqual([getItemKey(word)]);
  });

  it("keeps the quiz shortcuts away from the flashcards", () => {
    fireEvent.click(within(vocabPanel()).getByRole("button", { name: /Thẻ ghi nhớ/ }));
    fireEvent.keyDown(window, { key: "2" });

    expect(srsCards()).toEqual({});
    expect(vocabPanel().querySelector(".question-card .options")).toBeNull();
  });
});

describe("Accounts and the progress of each learner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Back to the visibility of the document prototype.
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
  });

  it("registers a new account after checking the username and password", async () => {
    const api = serveFakeApi();
    const { unmount } = render(<App />);
    expect(screen.queryByRole("tablist", { name: "Cấp độ JLPT" })).not.toBeInTheDocument();

    register("bien nguyen");
    expect(screen.getByRole("alert")).toHaveTextContent(/Tên đăng nhập chưa hợp lệ/);
    register("Bien.Nguyen", "12345");
    expect(screen.getByRole("alert")).toHaveTextContent(/Mật khẩu chưa hợp lệ/);
    expect(api.fetch).not.toHaveBeenCalled();

    register(" Bien.Nguyen ");
    expect(await screen.findByText(/Đã tạo tài khoản/)).toBeInTheDocument();
    expect(screen.getByText("👤 bien.nguyen")).toBeInTheDocument();
    expect(api.accounts["bien.nguyen"].password).toBe(PASSWORD);
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument();

    // The next visit opens the levels directly.
    unmount();
    render(<App />);
    expect(screen.getByRole("tablist", { name: "Cấp độ JLPT" })).toBeInTheDocument();
  });

  it("logs in with the right password and downloads the progress saved from another device", async () => {
    const key = getItemKey(n3Word("家庭"));
    serveFakeApi({ "an.le": { password: PASSWORD, progress: { n3: { words: { [key]: { s: "u", t: 1 } }, cards: {} } } } });
    render(<App />);

    login("chua.co");
    expect(await screen.findByText(/Chưa có tài khoản tên này/)).toBeInTheDocument();
    login("an.le", "sai-mat-khau");
    expect(await screen.findByText(/Sai mật khẩu/)).toBeInTheDocument();
    register("an.le", "mat-khau-khac");
    expect(await screen.findByText(/đã có người dùng/)).toBeInTheDocument();

    login("An.Le");
    expect(await screen.findByText(/Chào mừng trở lại/)).toBeInTheDocument();
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument();
    expect(listButton()).toHaveTextContent("1");
  });

  it("explains that logging in needs the server", async () => {
    render(<App />);
    login(USER);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Không kết nối được máy chủ/);
  });

  it("keeps the progress of each learner apart and saves it before logging out", async () => {
    const api = serveFakeApi({ "an.le": { password: PASSWORD, progress: {} }, binh: { password: "mat-khau-2", progress: {} } });
    render(<App />);
    login("an.le");
    await screen.findByText("Đã lưu");
    answer(false);
    expect(listButton()).toHaveTextContent("1");

    await logout();
    const calls = api.fetch.mock.calls.map(([url, init]) => `${init?.method} ${url}`);
    expect(calls.slice(-2)).toEqual(["PATCH /api/users/an.le/progress/n3", "POST /api/logout"]);
    expect(Object.keys(api.accounts["an.le"].progress.n3!.words)).toHaveLength(1);

    login("binh", "mat-khau-2");
    await screen.findByText("Đã lưu");
    expect(listButton()).toHaveTextContent("0");

    await logout();
    login("an.le");
    await screen.findByText("Đã lưu");
    expect(listButton()).toHaveTextContent("1");
  });

  it("asks to log in again when the session expired, keeping the progress of this device", async () => {
    serveFakeApi({ [USER]: { password: PASSWORD, progress: {} } });
    loginWithUnremembered("n3", [n3Word("家庭")]);
    render(<App />);

    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeInTheDocument();
    expect(wordsWith("u", "n3")).toHaveLength(1);

    login(USER);
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument();
    expect(listButton()).toHaveTextContent("1");
  });

  it("saves the changes on the server when the page is hidden", async () => {
    const api = serveFakeApi({ [USER]: { password: PASSWORD, progress: {} } }, USER);
    localStorage.setItem("mimikara_user", USER);
    render(<App />);
    expect(await screen.findByText("Đã lưu")).toBeInTheDocument();

    answer(false);
    expect(screen.getByText("Đang lưu…")).toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText("Đã lưu")).toBeInTheDocument();
    await waitFor(() => expect(Object.keys(api.accounts[USER].progress.n3?.words ?? {})).toHaveLength(1));
    const [[, init]] = api.fetch.mock.calls.filter(([url]) => url === `/api/users/${USER}/progress/n3`);
    expect(init).toMatchObject({ method: "PATCH", keepalive: true });
  });

  it("moves the progress saved before logins existed into the learner's progress", async () => {
    serveFakeApi({ [USER]: { password: PASSWORD, progress: {} } }, USER);
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify([n3Word("家庭")]));
    localStorage.setItem("mimikara_srs_n2", JSON.stringify({ stt_5: { box: 2, due: 1, reviews: 2, lapses: 0 } }));
    localStorage.setItem("mimikara_user", USER);
    render(<App />);

    const dialog = await screen.findByRole("dialog", { name: /Tiến độ cũ/ });
    expect(dialog).toHaveTextContent("1 từ chưa nhớ và 1 thẻ ghi nhớ");
    fireEvent.click(within(dialog).getByRole("button", { name: /Gộp vào tiến độ của tester/ }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(wordsWith("u", "n3")).toEqual([getItemKey(n3Word("家庭"))]);
    // The flashcard comes along, the word is not marked remembered for the learner.
    expect(wordsWith("k", "n2")).toEqual([]);
    expect(progressOf("n2").cards.stt_5).toMatchObject({ box: 2, reviews: 2 });
    expect(localStorage.getItem("mimikara_unremembered_words")).toBeNull();
    expect(localStorage.getItem("mimikara_srs_n2")).toBeNull();
  });
});
