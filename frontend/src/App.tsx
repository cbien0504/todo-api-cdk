import { useEffect } from "react";
import { N2_DECK, N3_DECK } from "./data/vocabBatches";
import { enumCodec, usePersistentState } from "./hooks/usePersistentState";
import { useVocabSettings } from "./hooks/useVocabSettings";
import { trackEvent } from "./utils/gtm";
import ExamPractice from "./components/exam/ExamPractice";
import VocabPractice from "./components/vocab/VocabPractice";

const THEMES = ["dark", "light"] as const;
const TABS = [
  { id: "vocab", label: "📖 Từ vựng N3" },
  { id: "vocab-n2", label: "📗 Từ vựng N2" },
  { id: "exam", label: "📝 Luyện đề N3" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const themeCodec = enumCodec(THEMES);
const tabCodec = enumCodec<TabId>(TABS.map((t) => t.id));

export default function App() {
  const [theme, setTheme] = usePersistentState<(typeof THEMES)[number]>("mimikara_theme", "dark", themeCodec);
  const [tab, setTab] = usePersistentState<TabId>("mimikara_active_tab", "vocab", tabCodec);
  const vocabSettings = useVocabSettings();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    trackEvent("theme_toggle", { theme: next });
  };

  const selectTab = (id: TabId) => {
    setTab(id);
    trackEvent("tab_change", { tab: id });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-badge">N3 · N2</span>
          <div>
            <h1 className="brand-title">Mimikara Oboeru</h1>
            <p className="brand-sub">
              Học từ vựng N3 · N2 & luyện đề{" "}
              <span className="nowrap" lang="ja">
                文字・語彙
              </span>{" "}
              JLPT N3
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--icon"
          onClick={toggleTheme}
          title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <nav className="tabs" role="tablist" aria-label="Chế độ luyện tập">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Every panel stays mounted so switching tabs keeps the current session. */}
      <section id="panel-vocab" role="tabpanel" aria-labelledby="tab-vocab" className="panel" hidden={tab !== "vocab"}>
        <VocabPractice deck={N3_DECK} active={tab === "vocab"} settings={vocabSettings} />
      </section>
      <section
        id="panel-vocab-n2"
        role="tabpanel"
        aria-labelledby="tab-vocab-n2"
        className="panel"
        hidden={tab !== "vocab-n2"}
      >
        <VocabPractice deck={N2_DECK} active={tab === "vocab-n2"} settings={vocabSettings} />
      </section>
      <section id="panel-exam" role="tabpanel" aria-labelledby="tab-exam" className="panel" hidden={tab !== "exam"}>
        <ExamPractice />
      </section>
    </div>
  );
}
