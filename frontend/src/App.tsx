import { useEffect } from "react";
import { N2_DECK, N3_DECK, N4_DECK, N5_DECK, type VocabDeck } from "./data/vocabDecks";
import { enumCodec, usePersistentState } from "./hooks/usePersistentState";
import { useVocabSettings } from "./hooks/useVocabSettings";
import { trackEvent } from "./utils/gtm";
import ExamPractice from "./components/exam/ExamPractice";
import VocabPractice from "./components/vocab/VocabPractice";

const THEMES = ["dark", "light"] as const;
const SECTIONS = [
  { id: "vocab", label: "📖 Từ vựng" },
  { id: "exam", label: "📝 Luyện đề" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];
type LevelId = "n5" | "n4" | "n3" | "n2";

interface Level {
  id: LevelId;
  deck: VocabDeck;
  sections: SectionId[];
}

// Every JLPT level has its own vocabulary deck; only N3 has exam papers so far.
const LEVELS: Level[] = [
  { id: "n5", deck: N5_DECK, sections: ["vocab"] },
  { id: "n4", deck: N4_DECK, sections: ["vocab"] },
  { id: "n3", deck: N3_DECK, sections: ["vocab", "exam"] },
  { id: "n2", deck: N2_DECK, sections: ["vocab"] },
];

const themeCodec = enumCodec(THEMES);
const levelCodec = enumCodec<LevelId>(LEVELS.map((l) => l.id));
const sectionCodec = enumCodec<SectionId>(SECTIONS.map((s) => s.id));

export default function App() {
  const [theme, setTheme] = usePersistentState<(typeof THEMES)[number]>("mimikara_theme", "dark", themeCodec);
  const [levelId, setLevelId] = usePersistentState<LevelId>("mimikara_level", "n3", levelCodec);
  const [sectionId, setSectionId] = usePersistentState<SectionId>("mimikara_section", "vocab", sectionCodec);
  const vocabSettings = useVocabSettings();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    trackEvent("theme_toggle", { theme: next });
  };

  const selectLevel = (id: LevelId) => {
    setLevelId(id);
    trackEvent("level_change", { level: id });
  };

  const selectSection = (level: LevelId, id: SectionId) => {
    setSectionId(id);
    trackEvent("tab_change", { level, tab: id });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-badge">N5 – N2</span>
          <div>
            <h1 className="brand-title">Mimikara Oboeru</h1>
            <p className="brand-sub">
              Học từ vựng JLPT N5 → N2 & luyện đề{" "}
              <span className="nowrap" lang="ja">
                文字・語彙
              </span>{" "}
              N3
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

      <nav className="tabs" role="tablist" aria-label="Cấp độ JLPT">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            role="tab"
            id={`level-tab-${level.id}`}
            aria-selected={levelId === level.id}
            aria-controls={`level-${level.id}`}
            className={`tab level-tab ${levelId === level.id ? "is-active" : ""}`}
            onClick={() => selectLevel(level.id)}
          >
            <span className="level-name">{level.deck.level}</span>{" "}
            <span className="level-meta">{level.deck.items.length} từ</span>
          </button>
        ))}
      </nav>

      {/* Every level and section stays mounted so switching keeps the current sessions. */}
      {LEVELS.map((level) => {
        const sections = SECTIONS.filter((s) => level.sections.includes(s.id));
        // A level without the chosen section (no exam papers) shows its first one.
        const shown = level.sections.includes(sectionId) ? sectionId : level.sections[0];
        return (
          <section
            key={level.id}
            id={`level-${level.id}`}
            role="tabpanel"
            aria-labelledby={`level-tab-${level.id}`}
            className="panel"
            hidden={levelId !== level.id}
          >
            <nav className="section-tabs" role="tablist" aria-label={`Mục học ${level.deck.level}`}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`tab-${level.id}-${s.id}`}
                  aria-selected={shown === s.id}
                  aria-controls={`panel-${level.id}-${s.id}`}
                  className={`section-tab ${shown === s.id ? "is-active" : ""}`}
                  onClick={() => selectSection(level.id, s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            {sections.map((s) => (
              <section
                key={s.id}
                id={`panel-${level.id}-${s.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${level.id}-${s.id}`}
                className="panel"
                hidden={shown !== s.id}
              >
                {s.id === "vocab" ? (
                  <VocabPractice deck={level.deck} active={levelId === level.id && shown === s.id} settings={vocabSettings} />
                ) : (
                  <ExamPractice />
                )}
              </section>
            ))}
          </section>
        );
      })}
    </div>
  );
}
