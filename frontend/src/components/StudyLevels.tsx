import { useMemo } from "react";
import { N2_DECK, N3_DECK, N4_DECK, N5_DECK, type VocabDeck } from "../data/vocabDecks";
import { useDeckProgress } from "../hooks/useProgress";
import { enumCodec, usePersistentState } from "../hooks/usePersistentState";
import { useVocabSettings } from "../hooks/useVocabSettings";
import type { DeckId } from "../types/progress";
import { trackEvent } from "../utils/gtm";
import ExamPractice from "./exam/ExamPractice";
import VocabPractice from "./vocab/VocabPractice";

const SECTIONS = [
  { id: "vocab", label: "📖 Từ vựng" },
  { id: "exam", label: "📝 Luyện đề" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface Level {
  id: DeckId;
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

const levelCodec = enumCodec<DeckId>(LEVELS.map((l) => l.id));
const sectionCodec = enumCodec<SectionId>(SECTIONS.map((s) => s.id));

/** How many words of a level the learner remembered, shown in its tab. */
function LevelProgress({ deck }: { deck: VocabDeck }) {
  const { words } = useDeckProgress(deck.id);
  const known = useMemo(
    () => Object.entries(words).filter(([key, entry]) => entry.s === "k" && deck.itemByKey(key)).length,
    [deck, words]
  );
  const total = deck.items.length;

  return (
    <>
      <span className="level-meta" title={`Đã nhớ ${known} / ${total} từ ${deck.level}`}>
        ✅ {known}/{total}
      </span>
      <span className="level-bar" aria-hidden="true">
        <span style={{ width: `${(known / total) * 100}%` }} />
      </span>
    </>
  );
}

/** The JLPT levels N5 → N2 and the sections of each: vocabulary for every level, exam papers for N3. */
export default function StudyLevels() {
  const [levelId, setLevelId] = usePersistentState<DeckId>("mimikara_level", "n3", levelCodec);
  const [sectionId, setSectionId] = usePersistentState<SectionId>("mimikara_section", "vocab", sectionCodec);
  const vocabSettings = useVocabSettings();

  const selectLevel = (id: DeckId) => {
    setLevelId(id);
    trackEvent("level_change", { level: id });
  };

  const selectSection = (level: DeckId, id: SectionId) => {
    setSectionId(id);
    trackEvent("tab_change", { level, tab: id });
  };

  return (
    <>
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
            <span className="level-name">{level.deck.level}</span> <LevelProgress deck={level.deck} />
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
    </>
  );
}
