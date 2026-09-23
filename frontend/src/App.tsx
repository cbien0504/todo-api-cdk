import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import rawVocabData from "./data/mimikara_oboeru_vocab.json";
import type { RawVocabItem, VocabItem, Question } from "./types/quiz";
import {
  cleanVocabData,
  QuizBuffer,
  buildQuestion,
} from "./utils/quizEngine";
import { trackEvent } from "./utils/gtm";

const ALL_ITEMS: VocabItem[] = cleanVocabData(rawVocabData as RawVocabItem[]);
const BATCH_SIZE = 50;
const STORAGE_UNREMEMBERED_KEY = "mimikara_unremembered_words";

export const getItemKey = (item: { stt?: string | number; question_text?: string; meaning?: string }) => {
  if (item.stt !== undefined && item.stt !== null && String(item.stt).trim() !== "") {
    return `stt_${item.stt}`;
  }
  return `${item.question_text || ""}:::${item.meaning || ""}`;
};

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("mimikara_theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("mimikara_theme", next);
    document.documentElement.setAttribute("data-theme", next);
    trackEvent("theme_toggle", { theme: next });
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Unremembered words state (persisted to localStorage)
  const [unrememberedWords, setUnrememberedWords] = useState<VocabItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_UNREMEMBERED_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to load unremembered words from localStorage", e);
    }
    return [];
  });

  const saveUnrememberedWords = useCallback((words: VocabItem[]) => {
    setUnrememberedWords(words);
    try {
      localStorage.setItem(STORAGE_UNREMEMBERED_KEY, JSON.stringify(words));
    } catch (e) {
      console.error("Failed to save unremembered words", e);
    }
  }, []);

  const isWordUnremembered = useCallback(
    (item: VocabItem | null | undefined): boolean => {
      if (!item) return false;
      const targetKey = getItemKey(item);
      return unrememberedWords.some((w) => getItemKey(w) === targetKey);
    },
    [unrememberedWords]
  );

  const markAsUnremembered = useCallback(
    (item: VocabItem | null | undefined) => {
      if (!item) return;
      const targetKey = getItemKey(item);
      if (!unrememberedWords.some((w) => getItemKey(w) === targetKey)) {
        const updated = [...unrememberedWords, item];
        saveUnrememberedWords(updated);
        trackEvent("vocab_mark_unremembered", { word: item.question_text });
      }
    },
    [unrememberedWords, saveUnrememberedWords]
  );

  const markAsRemembered = useCallback(
    (item: VocabItem | null | undefined) => {
      if (!item) return;
      const targetKey = getItemKey(item);
      const updated = unrememberedWords.filter((w) => getItemKey(w) !== targetKey);
      saveUnrememberedWords(updated);
      trackEvent("vocab_mark_remembered", { word: item.question_text });
    },
    [unrememberedWords, saveUnrememberedWords]
  );

  // Copy text to clipboard
  const [copySuccess, setCopySuccess] = useState(false);
  const copyUnrememberedText = () => {
    if (unrememberedWords.length === 0) {
      alert("Danh sách từ chưa nhớ đang trống!");
      return;
    }
    const lines = unrememberedWords.map((item, index) => {
      const sttStr = item.stt ? `[#${item.stt}] ` : "";
      const hvStr = item.han_viet ? ` [Hán Việt: ${item.han_viet}]` : "";
      return `${index + 1}. ${sttStr}${item.question_text}${hvStr} : ${item.meaning}`;
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
    trackEvent("copy_unremembered_text", { count: unrememberedWords.length });
  };

  // Modal View State
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");

  const filteredModalWords = useMemo(() => {
    if (!listSearchQuery.trim()) return unrememberedWords;
    const q = listSearchQuery.toLowerCase().trim();
    return unrememberedWords.filter(
      (item) =>
        item.question_text.toLowerCase().includes(q) ||
        (item.kanji && item.kanji.toLowerCase().includes(q)) ||
        (item.hiragana && item.hiragana.toLowerCase().includes(q)) ||
        (item.han_viet && item.han_viet.toLowerCase().includes(q)) ||
        item.meaning.toLowerCase().includes(q) ||
        String(item.stt).includes(q)
    );
  }, [unrememberedWords, listSearchQuery]);

  // Batch Range State (defaults to first 50 items like quiz_mimikara_n3.py)
  const [batchKey, setBatchKey] = useState<string>("batch_0_50");
  // Stable snapshot for review mode to avoid mid-round buffer index shifts
  const [unrememberedSnapshot, setUnrememberedSnapshot] = useState<VocabItem[]>([]);

  const batchOptions = useMemo(() => {
    const options: { key: string; label: string; start: number; end: number }[] = [];
    const total = ALL_ITEMS.length;
    let batchIndex = 1;

    for (let start = 0; start < total; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, total);
      options.push({
        key: `batch_${start}_${end}`,
        label: `Bài ${batchIndex} (Từ ${start + 1} - ${end})`,
        start,
        end,
      });
      batchIndex++;
    }

    options.push({
      key: "all",
      label: `Tất cả (${total} từ vựng N3)`,
      start: 0,
      end: total,
    });

    options.unshift({
      key: "unremembered",
      label: `📌 Ôn tập từ CHƯA NHỚ (${unrememberedWords.length} từ)`,
      start: 0,
      end: 0,
    });

    return options;
  }, [unrememberedWords.length]);

  // Filtered Items based on selected batch
  const currentBatchItems = useMemo(() => {
    if (batchKey === "unremembered") {
      return unrememberedSnapshot;
    }
    const opt = batchOptions.find((b) => b.key === batchKey);
    if (!opt || opt.key === "all") {
      return ALL_ITEMS;
    }
    return ALL_ITEMS.slice(opt.start, opt.end);
  }, [batchKey, batchOptions, unrememberedSnapshot]);

  // Quiz State
  const [buffer, setBuffer] = useState<QuizBuffer>(() => {
    const initialItems = ALL_ITEMS.slice(0, Math.min(BATCH_SIZE, ALL_ITEMS.length));
    return new QuizBuffer(initialItems.map((_, i) => i));
  });

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Statistics
  const [round, setRound] = useState<number>(1);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [isRoundComplete, setIsRoundComplete] = useState<boolean>(false);
  const [wrongWords, setWrongWords] = useState<VocabItem[]>([]);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Remaining and retry counts for reactive display
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [pendingNewCount, setPendingNewCount] = useState<number>(0);

  // Current vocab item being questioned
  const currentVocabItem = useMemo(() => {
    if (!currentQuestion) return null;
    return currentBatchItems[currentQuestion.vocabIndex] ?? null;
  }, [currentQuestion, currentBatchItems]);

  // Ref to track latest state in key listener
  const stateRef = useRef({
    isAnswered,
    currentQuestion,
    currentVocabItem,
    selectedOption,
    isRoundComplete,
    markAsUnremembered,
    markAsRemembered,
  });
  stateRef.current = {
    isAnswered,
    currentQuestion,
    currentVocabItem,
    selectedOption,
    isRoundComplete,
    markAsUnremembered,
    markAsRemembered,
  };

  // Sync buffer counts to React state
  const syncBufferCounts = useCallback((buf: QuizBuffer) => {
    setRemainingCount(buf.remainingCount());
    setRetryCount(buf.getPendingRetryCount());
    setPendingNewCount(buf.getPendingNewCount());
  }, []);

  // Visibility Toggles (Hán Việt, Hiragana)
  const [hideHanViet, setHideHanViet] = useState<boolean>(() => {
    return localStorage.getItem("mimikara_hide_han_viet") === "true";
  });

  const [hideHiragana, setHideHiragana] = useState<boolean>(() => {
    return localStorage.getItem("mimikara_hide_hiragana") === "true";
  });

  // Mute / Speaker State
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem("mimikara_is_muted") === "true";
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem("mimikara_is_muted", String(next));
      if (next && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      }
      trackEvent("toggle_mute", { muted: next });
      return next;
    });
  }, []);

  // Pronounce Japanese word via SpeechSynthesis API
  const playPronunciation = useCallback((textToSpeak: string, force = false) => {
    if (!("speechSynthesis" in window)) return;
    if (isMuted && !force) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "ja-JP";
      utterance.rate = 0.9;
      utterance.onstart = () => setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsPlayingAudio(false);
    }
  }, [isMuted]);

  const toggleHideHanViet = () => {
    setHideHanViet((prev) => {
      const next = !prev;
      localStorage.setItem("mimikara_hide_han_viet", String(next));
      trackEvent("toggle_hide_han_viet", { hide: next });
      return next;
    });
  };

  const toggleHideHiragana = () => {
    setHideHiragana((prev) => {
      const next = !prev;
      localStorage.setItem("mimikara_hide_hiragana", String(next));
      trackEvent("toggle_hide_hiragana", { hide: next });
      return next;
    });
  };

  // Pick Next Question
  const advanceToNextQuestion = useCallback(
    (buf: QuizBuffer, items = currentBatchItems) => {
      if (buf.isRoundComplete() || items.length === 0) {
        setIsRoundComplete(true);
        setCurrentQuestion(null);
        setSelectedOption(null);
        setIsAnswered(false);
        setIsCorrect(null);
        syncBufferCounts(buf);

        trackEvent("quiz_completed", {
          round,
          correct: correctCount,
          wrong: wrongCount,
          batch: batchKey,
        });
        return;
      }

      const nextIdx = buf.nextIndex();
      if (nextIdx !== null && items[nextIdx]) {
        // If reviewing unremembered items and count is small, use ALL_ITEMS for distractors
        const distractorPool = batchKey === "unremembered" ? ALL_ITEMS : undefined;
        const q = buildQuestion(items, nextIdx, distractorPool);
        setCurrentQuestion(q);
        setSelectedOption(null);
        setIsAnswered(false);
        setIsCorrect(null);
        syncBufferCounts(buf);
      }
    },
    [currentBatchItems, round, correctCount, wrongCount, batchKey, syncBufferCounts]
  );

  // Reset or Switch Batch immediately
  const resetBatch = useCallback(
    (key: string = batchKey) => {
      setBatchKey(key);
      let items: VocabItem[] = [];

      if (key === "unremembered") {
        items = [...unrememberedWords];
        setUnrememberedSnapshot(items);
      } else {
        const opt = batchOptions.find((b) => b.key === key);
        items = !opt || opt.key === "all" ? ALL_ITEMS : ALL_ITEMS.slice(opt.start, opt.end);
      }

      setRound(1);
      setStreak(0);
      setBestStreak(0);
      const newBuf = new QuizBuffer(items.map((_, i) => i));
      setBuffer(newBuf);
      setCorrectCount(0);
      setWrongCount(0);
      setWrongWords([]);
      setIsRoundComplete(false);
      syncBufferCounts(newBuf);
      advanceToNextQuestion(newBuf, items);
      trackEvent("batch_reset", { batchKey: key, totalItems: items.length });
    },
    [batchKey, batchOptions, unrememberedWords, syncBufferCounts, advanceToNextQuestion]
  );

  // Initialize or Reset Round (keep current batch)
  const startNewRound = useCallback(
    (items = currentBatchItems) => {
      let roundItems = items;
      if (batchKey === "unremembered") {
        roundItems = [...unrememberedWords];
        setUnrememberedSnapshot(roundItems);
      }

      const newBuf = new QuizBuffer(roundItems.map((_, i) => i));
      setBuffer(newBuf);
      setCorrectCount(0);
      setWrongCount(0);
      setWrongWords([]);
      setIsRoundComplete(false);
      syncBufferCounts(newBuf);
      advanceToNextQuestion(newBuf, roundItems);
      trackEvent("quiz_start_round", { round: round + 1, totalItems: roundItems.length });
    },
    [currentBatchItems, batchKey, unrememberedWords, round, syncBufferCounts, advanceToNextQuestion]
  );

  // Initial mount: load first question
  useEffect(() => {
    const initialBuf = new QuizBuffer(currentBatchItems.map((_, i) => i));
    setBuffer(initialBuf);
    syncBufferCounts(initialBuf);
    advanceToNextQuestion(initialBuf, currentBatchItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User selects an option
  const handleSelectOption = useCallback(
    (chosen: string) => {
      if (isAnswered || !currentQuestion) return;

      const correct = chosen === currentQuestion.answer;
      setSelectedOption(chosen);
      setIsAnswered(true);
      setIsCorrect(correct);

      // Auto pronounce word on answer
      playPronunciation(currentQuestion.hiragana);

      const vocabItem = currentBatchItems[currentQuestion.vocabIndex];

      if (correct) {
        setCorrectCount((prev) => prev + 1);
        setStreak((prev) => {
          const nextStreak = prev + 1;
          setBestStreak((b) => Math.max(b, nextStreak));
          return nextStreak;
        });

        trackEvent("quiz_answer", {
          result: "correct",
          word: currentQuestion.question_text,
          stt: currentQuestion.stt,
        });
      } else {
        setWrongCount((prev) => prev + 1);
        setStreak(0);

        // Put failed question in pendingRetry queue (exact Python quiz logic)
        buffer.markWrong(currentQuestion.vocabIndex);

        // Automatically mark as unremembered when wrong
        if (vocabItem) {
          markAsUnremembered(vocabItem);

          setWrongWords((prev) => {
            if (prev.some((w) => w.question_text === vocabItem.question_text)) {
              return prev;
            }
            return [...prev, vocabItem];
          });
        }

        trackEvent("quiz_answer", {
          result: "wrong",
          word: currentQuestion.question_text,
          correctAnswer: currentQuestion.answer,
          stt: currentQuestion.stt,
        });
      }

      syncBufferCounts(buffer);
    },
    [isAnswered, currentQuestion, playPronunciation, currentBatchItems, buffer, markAsUnremembered, syncBufferCounts]
  );

  // Next question button handler
  const handleNext = useCallback(() => {
    advanceToNextQuestion(buffer);
  }, [advanceToNextQuestion, buffer]);

  // Keyboard Shortcuts: 1, 2, 3, 4 to choose; Space or Enter to next; C mark unremembered; D mark remembered
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        isAnswered: answered,
        currentQuestion: q,
        currentVocabItem: item,
        isRoundComplete: complete,
        markAsUnremembered: markUnrem,
        markAsRemembered: markRem,
      } = stateRef.current;

      if (complete) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startNewRound();
        }
        return;
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (!answered && q) {
        if (["1", "2", "3", "4"].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (q.options[idx]) {
            e.preventDefault();
            handleSelectOption(q.options[idx]);
          }
        }
      } else if (answered) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNext();
        } else if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          if (item) markUnrem(item);
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          if (item) markRem(item);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectOption, handleNext, startNewRound, toggleMute]);

  // Mastered progress calculation
  const totalInBatch = currentBatchItems.length;
  const masteredCount = Math.max(0, totalInBatch - remainingCount);
  const masteredPercent = totalInBatch > 0 ? (masteredCount / totalInBatch) * 100 : 0;
  const retryPercent = totalInBatch > 0 ? (retryCount / totalInBatch) * 100 : 0;
  const pendingNewPercent = totalInBatch > 0 ? (pendingNewCount / totalInBatch) * 100 : 0;
  const accuracyPercent =
    correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
      : 0;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-badge">N3 VOCAB</span>
          <div>
            <h1 className="brand-title">Mimikara Oboeru</h1>
            <p className="brand-sub">Quiz trắc nghiệm từ vựng tiếng Nhật N3 thông minh</p>
          </div>
        </div>

        <div className="header-actions">
          {/* List View Action */}
          <button
            className="btn-icon"
            onClick={() => setIsListModalOpen(true)}
            title={`Xem bảng từ chưa nhớ (${unrememberedWords.length} từ)`}
            aria-label="Xem danh sách từ chưa nhớ"
          >
            📋
          </button>
          <button
            className={`btn-icon ${isMuted ? "muted" : ""}`}
            onClick={toggleMute}
            title={isMuted ? "Bật loa phát âm (Phím M)" : "Tắt loa phát âm (Phím M)"}
            aria-label="Toggle Loa"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            className="btn-icon"
            onClick={toggleTheme}
            title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              setRound((r) => r + 1);
              startNewRound();
            }}
            title="Reset lượt chơi hiện tại"
            aria-label="Reset Quiz"
          >
            🔄
          </button>
        </div>
      </header>

      {/* Batch Selector Bar */}
      <div className="batch-selector-bar">
        <div className="batch-info">
          <span>Đang ôn:</span>
          <strong>{batchOptions.find((b) => b.key === batchKey)?.label}</strong>
          <span>({totalInBatch} từ)</span>
        </div>
        <div className="batch-controls">
          {/* Quick Review Button */}
          <button
            type="button"
            className={`btn-review-badge ${batchKey === "unremembered" ? "active" : ""}`}
            onClick={() => resetBatch("unremembered")}
            title="Ôn tập lại các từ chưa nhớ"
          >
            📌 Ôn từ chưa nhớ ({unrememberedWords.length})
          </button>

          {/* Quick List View Button */}
          <button
            type="button"
            className="btn-list-badge"
            onClick={() => setIsListModalOpen(true)}
            title="Xem bảng danh sách các từ chưa nhớ"
          >
            📋 Bảng từ chưa nhớ ({unrememberedWords.length})
          </button>

          <label htmlFor="batch-select" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Chọn bài:
          </label>
          <select
            id="batch-select"
            className="batch-select"
            value={batchKey}
            onChange={(e) => resetBatch(e.target.value)}
          >
            {batchOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-icon btn-reset-batch"
            onClick={() => resetBatch(batchKey)}
            title="Reset bài này ngay lập tức"
            aria-label="Reset bài này ngay lập tức"
          >
            🔄
          </button>

          <div className="visibility-toggles">
            <button
              type="button"
              className={`btn-toggle ${isMuted ? "active" : ""}`}
              onClick={toggleMute}
              title={isMuted ? "Nhấn để bật loa phát âm (Phím M)" : "Nhấn để tắt loa phát âm (Phím M)"}
              aria-label="Toggle Loa"
            >
              {isMuted ? "🔇 Loa: Tắt" : "🔊 Loa: Bật"}
            </button>
            <button
              type="button"
              className={`btn-toggle ${hideHanViet ? "active" : ""}`}
              onClick={toggleHideHanViet}
              title={hideHanViet ? "Nhấn để hiện Hán Việt" : "Nhấn để ẩn Hán Việt"}
              aria-label="Toggle Ẩn Hán Việt"
            >
              {hideHanViet ? "🙈 Ẩn Hán Việt" : "👁️ Hán Việt"}
            </button>
            <button
              type="button"
              className={`btn-toggle ${hideHiragana ? "active" : ""}`}
              onClick={toggleHideHiragana}
              title={hideHiragana ? "Nhấn để hiện Hiragana" : "Nhấn để ẩn Hiragana trong câu hỏi"}
              aria-label="Toggle Ẩn Hiragana"
            >
              {hideHiragana ? "🙈 Ẩn Hiragana" : "👁️ Hiragana"}
            </button>
          </div>
        </div>
      </div>

      {/* Realtime Stats Grid */}
      <div className="stats-grid">
        <div className="stat-pill">
          <div className="stat-icon-box stat-icon-mastered">✓</div>
          <div className="stat-meta">
            <span className="stat-val">{masteredCount}</span>
            <span className="stat-lbl">Đã nhớ ({Math.round(masteredPercent)}%)</span>
          </div>
        </div>

        <div className="stat-pill">
          <div className="stat-icon-box stat-icon-pending">⏳</div>
          <div className="stat-meta">
            <span className="stat-val">{pendingNewCount}</span>
            <span className="stat-lbl">Chưa làm</span>
          </div>
        </div>

        <div className="stat-pill">
          <div className="stat-icon-box stat-icon-retry">↩</div>
          <div className="stat-meta">
            <span className="stat-val">{retryCount}</span>
            <span className="stat-lbl">Cần làm lại</span>
          </div>
        </div>

        <div className="stat-pill">
          <div className="stat-icon-box stat-icon-streak">🔥</div>
          <div className="stat-meta">
            <span className="stat-val">{streak}</span>
            <span className="stat-lbl">Chuỗi đúng (Kỉ lục: {bestStreak})</span>
          </div>
        </div>
      </div>

      {/* Multi-Segmented Progress Bar */}
      <div className="progress-card">
        <div className="progress-header">
          <span>Tiến độ lượt {round}</span>
          <span>
            {masteredCount} / {totalInBatch} từ hoàn thành ({Math.round(masteredPercent)}%)
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className="prog-seg prog-seg-mastered"
            style={{ width: `${masteredPercent}%` }}
            title={`Đã thuộc: ${masteredCount} từ`}
          />
          <div
            className="prog-seg prog-seg-retry"
            style={{ width: `${retryPercent}%` }}
            title={`Làm sai cần hỏi lại: ${retryCount} từ`}
          />
          <div
            className="prog-seg prog-seg-new"
            style={{ width: `${pendingNewPercent}%` }}
            title={`Chưa hỏi: ${pendingNewCount} từ`}
          />
        </div>
        <div className="progress-legend">
          <div className="legend-item">
            <div className="legend-dot" style={{ background: "var(--success)" }}></div>
            <span>Đã làm đúng ({masteredCount})</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: "var(--warning)" }}></div>
            <span>Hỏi lại sau ({retryCount})</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ background: "var(--primary)" }}></div>
            <span>Chưa làm ({pendingNewCount})</span>
          </div>
        </div>
      </div>

      {/* Main Content: Quiz Card OR Round Complete View OR Empty Unremembered State */}
      {batchKey === "unremembered" && currentBatchItems.length === 0 ? (
        <div className="round-complete-card">
          <div className="celebrate-icon">🎉</div>
          <h2 className="round-complete-title">Danh sách Chưa nhớ hiện đang trống!</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "520px" }}>
            Tuyệt vời! Bạn không có từ vựng nào trong danh sách chưa nhớ. Hãy chọn bài học để luyện tập tiếp nhé!
          </p>
          <div className="round-actions">
            <button className="btn-primary" onClick={() => resetBatch("batch_0_50")}>
              📖 Luyện tập Bài 1 (Từ 1 - 50)
            </button>
          </div>
        </div>
      ) : isRoundComplete ? (
        <div className="round-complete-card">
          <div className="celebrate-icon">🎉</div>
          <h2 className="round-complete-title">
            {batchKey === "unremembered"
              ? unrememberedWords.length === 0
                ? "Xuất sắc! Bạn đã thuộc hết tất cả các từ trong danh sách Chưa nhớ!"
                : `Hoàn thành 1 lượt ôn tập! Hiện còn ${unrememberedWords.length} từ chưa nhớ.`
              : "Xuất sắc! Bạn đã nhớ hết tất cả từ vựng!"}
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "520px" }}>
            {batchKey === "unremembered"
              ? "Tất cả các từ trong lượt ôn tập này đã được bạn kiểm tra lại."
              : "Tất cả các câu hỏi trong lượt này (bao gồm cả các từ từng làm sai) đều đã được bạn trả lời chính xác."}
          </p>

          <div className="round-stats-summary">
            <div className="summary-metric">
              <span className="val" style={{ color: "var(--success)" }}>
                {correctCount}
              </span>
              <span className="lbl">Lượt trả lời đúng</span>
            </div>
            <div className="summary-metric">
              <span className="val" style={{ color: "var(--danger)" }}>
                {wrongCount}
              </span>
              <span className="lbl">Lượt trả lời sai</span>
            </div>
            <div className="summary-metric">
              <span className="val" style={{ color: "var(--primary)" }}>
                {accuracyPercent}%
              </span>
              <span className="lbl">Tỉ lệ chính xác</span>
            </div>
          </div>

          {wrongWords.length > 0 && (
            <div className="review-section">
              <div className="review-heading">
                <span>📝 Các từ bạn đã từng làm sai trong lượt này ({wrongWords.length} từ):</span>
              </div>
              <div className="review-list">
                {wrongWords.map((item, idx) => (
                  <div key={idx} className="review-item">
                    <div className="review-item-jp">
                      <span>{item.question_text}</span>
                      {!hideHanViet && item.han_viet && (
                        <span className="han-viet-badge" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
                          {item.han_viet}
                        </span>
                      )}
                    </div>
                    <div className="review-item-vn">{item.meaning}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="round-actions">
            {batchKey === "unremembered" && unrememberedWords.length > 0 ? (
              <button
                className="btn-primary"
                onClick={() => {
                  setRound((r) => r + 1);
                  startNewRound();
                }}
              >
                🔄 Tiếp tục ôn tập ({unrememberedWords.length} từ còn lại)
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => {
                  if (batchKey === "unremembered") {
                    resetBatch("batch_0_50");
                  } else {
                    setRound((r) => r + 1);
                    startNewRound();
                  }
                }}
              >
                {batchKey === "unremembered"
                  ? "📖 Quay lại Luyện tập Bài 1"
                  : "🔄 Bắt đầu lượt mới (Shuffle lại)"}
              </button>
            )}
          </div>
        </div>
      ) : currentQuestion ? (
        <main className="quiz-card">
          {/* Top meta tags */}
          <div className="question-top-bar">
            <div className="question-tags">
              {currentQuestion.stt && (
                <span className="tag-stt">#{currentQuestion.stt}</span>
              )}
              {batchKey === "unremembered" && (
                <span className="tag-review-mode">📌 Đang ôn từ chưa nhớ</span>
              )}
              {retryCount > 0 && pendingNewCount === 0 && (
                <span className="tag-retry">↩ Câu hỏi ôn tập lại</span>
              )}
            </div>
            <span className="question-prompt-text">Chọn nghĩa tiếng Việt đúng</span>
          </div>

          {/* Word Display Hero */}
          <div className="word-hero-display">
            <button
              className={`audio-btn ${isPlayingAudio ? "playing" : ""} ${isMuted ? "muted" : ""}`}
              onClick={() => playPronunciation(currentQuestion.hiragana, true)}
              title={isMuted ? "Loa đang tắt (Nhấn để nghe từ này)" : "Nghe phát âm tiếng Nhật"}
              aria-label="Phát âm tiếng Nhật"
            >
              {isMuted ? "🔇" : "🔊"}
            </button>

            {currentQuestion.kanji ? (
              <>
                <div className="kanji-text">{currentQuestion.kanji}</div>
                {!hideHiragana || isAnswered ? (
                  <div className={`hiragana-subtext ${hideHiragana && isAnswered ? "revealed" : ""}`}>
                    {currentQuestion.hiragana}
                  </div>
                ) : (
                  <div className="hiragana-subtext hiragana-hidden" title="Hiragana đang ẩn (sẽ hiện khi trả lời)">
                    ••••
                  </div>
                )}
              </>
            ) : (
              <div className="kanji-text">{currentQuestion.hiragana}</div>
            )}

            {!hideHanViet && currentQuestion.han_viet && (
              <div className="han-viet-badge">
                <span>Hán Việt:</span> {currentQuestion.han_viet}
              </div>
            )}
          </div>

          {/* 4 Options Grid */}
          <div className="options-grid">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectAnswer = option === currentQuestion.answer;

              let btnClass = "option-button";
              if (isAnswered) {
                if (isCorrectAnswer) {
                  btnClass += " correct";
                } else if (isSelected && !isCorrect) {
                  btnClass += " wrong";
                } else {
                  btnClass += " dimmed";
                }
              }

              return (
                <button
                  key={idx}
                  className={btnClass}
                  onClick={() => handleSelectOption(option)}
                  disabled={isAnswered}
                >
                  <span className="option-key-badge">{idx + 1}</span>
                  <span className="option-text">{option}</span>
                  {isAnswered && isCorrectAnswer && <span>✅</span>}
                  {isAnswered && isSelected && !isCorrect && <span>❌</span>}
                </button>
              );
            })}
          </div>

          {/* Feedback & Mark Row & Next Button */}
          {isAnswered && (
            <div className={`feedback-box ${isCorrect ? "correct" : "wrong"}`}>
              <div className="feedback-details">
                <div className="feedback-title">
                  <span>{isCorrect ? "✅ Chính xác!" : "❌ Chưa chính xác!"}</span>
                  {currentVocabItem && (
                    <span
                      className={`status-badge ${
                        isWordUnremembered(currentVocabItem)
                          ? "status-unrem"
                          : "status-rem"
                      }`}
                    >
                      {isWordUnremembered(currentVocabItem)
                        ? "📌 Chưa nhớ"
                        : "✨ Đã nhớ"}
                    </span>
                  )}
                </div>
                <div className="feedback-explanation">
                  <strong>{currentQuestion.question_text}</strong>
                  {currentQuestion.han_viet ? ` [Hán Việt: ${currentQuestion.han_viet}]` : ""} ={" "}
                  <strong>{currentQuestion.answer}</strong>
                  {!isCorrect && " (tự động thêm vào danh sách Chưa nhớ)"}
                </div>

                {/* Quick Marking Buttons */}
                {currentVocabItem && (
                  <div className="feedback-mark-row">
                    <span className="mark-label">Đánh dấu:</span>
                    <button
                      type="button"
                      className={`btn-mark ${
                        isWordUnremembered(currentVocabItem) ? "active-unrem" : ""
                      }`}
                      onClick={() => markAsUnremembered(currentVocabItem)}
                      title="Đánh dấu từ là chưa nhớ (Phím C)"
                    >
                      📌 Chưa nhớ (C)
                    </button>
                    <button
                      type="button"
                      className={`btn-mark ${
                        !isWordUnremembered(currentVocabItem) ? "active-rem" : ""
                      }`}
                      onClick={() => markAsRemembered(currentVocabItem)}
                      title="Đánh dấu từ là đã nhớ (Phím D)"
                    >
                      ✨ Đã nhớ (D)
                    </button>
                  </div>
                )}
              </div>

              <button className="btn-next" onClick={handleNext}>
                <span>Câu tiếp theo</span>
                <span className="keyboard-hint">Space / Enter ↵</span>
              </button>
            </div>
          )}
        </main>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
          Đang chuẩn bị câu hỏi...
        </div>
      )}

      {/* Modal: View & Export Unremembered Words */}
      {isListModalOpen && (
        <div className="modal-overlay" onClick={() => setIsListModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">📋 Bảng từ chưa nhớ ({unrememberedWords.length} từ)</h3>
                <p className="modal-sub">Xem bảng từ vựng, tìm kiếm và sao chép để ôn tập</p>
              </div>
              <button
                className="btn-close-modal"
                onClick={() => setIsListModalOpen(false)}
                title="Đóng cửa sổ"
                aria-label="Đóng cửa sổ"
              >
                ✕
              </button>
            </div>

            <div className="modal-toolbar">
              <input
                type="text"
                className="modal-search-input"
                placeholder="🔍 Tìm theo Kanji, Hiragana, Hán Việt hoặc nghĩa..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className="btn-action-copy"
                onClick={copyUnrememberedText}
                title="Sao chép toàn bộ danh sách vào bộ nhớ tạm"
              >
                {copySuccess ? "✅ Đã sao chép!" : "📋 Sao chép danh sách"}
              </button>
            </div>

            <div className="modal-list-body">
              {unrememberedWords.length === 0 ? (
                <div className="modal-empty-state">
                  <span style={{ fontSize: "2.5rem" }}>🎉</span>
                  <p>Danh sách Chưa nhớ hiện đang trống!</p>
                </div>
              ) : filteredModalWords.length === 0 ? (
                <div className="modal-empty-state">
                  <p>Không tìm thấy từ vựng nào khớp với từ khóa "{listSearchQuery}".</p>
                </div>
              ) : (
                <div className="unrem-table-container">
                  <table className="unrem-table">
                    <thead>
                      <tr>
                        <th style={{ width: "50px" }}>STT</th>
                        <th>Từ vựng (Kanji / Kana)</th>
                        <th>Hán Việt</th>
                        <th>Nghĩa tiếng Việt</th>
                        <th style={{ width: "100px", textAlign: "center" }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredModalWords.map((item, idx) => (
                        <tr key={idx}>
                          <td className="col-stt">{item.stt ? `#${item.stt}` : idx + 1}</td>
                          <td className="col-vocab">
                            <span className="vocab-jp">{item.question_text}</span>
                            <button
                              type="button"
                              className="btn-mini-audio"
                              onClick={() => playPronunciation(item.hiragana, true)}
                              title="Nghe phát âm"
                            >
                              🔊
                            </button>
                          </td>
                          <td className="col-hv">
                            {item.han_viet ? (
                              <span className="badge-hv">{item.han_viet}</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>-</span>
                            )}
                          </td>
                          <td className="col-meaning">{item.meaning}</td>
                          <td className="col-action">
                            <button
                              type="button"
                              className="btn-mark-learned-table"
                              onClick={() => markAsRemembered(item)}
                              title="Đánh dấu đã nhớ (gỡ khỏi danh sách chưa nhớ)"
                            >
                              ✨ Đã nhớ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <span>Hiển thị: <strong>{filteredModalWords.length}</strong> / {unrememberedWords.length} từ</span>
              <button className="btn-primary" onClick={() => setIsListModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Phím tắt: Bấm <strong>1, 2, 3, 4</strong> chọn đáp án &bull; Bấm <strong>C</strong> (Chưa nhớ) / <strong>D</strong> (Đã nhớ) &bull; Bấm <strong>Space / Enter</strong> câu tiếp theo &bull; Bấm <strong>M</strong> bật/tắt loa
        </p>
      </footer>
    </div>
  );
}
