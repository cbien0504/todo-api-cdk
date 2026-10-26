import n3VocabData from "./mimikara_oboeru_vocab.json";
import n2VocabData from "./jtest_n2_vocab.json";
import type { RawVocabItem, VocabItem } from "../types/quiz";
import { cleanVocabData } from "../utils/quizEngine";
import { getHanViet } from "../utils/hanViet";

export interface VocabBatch {
  key: string;
  /** Title shown while practicing the batch. */
  title: string;
  /** Label shown in the batch selector. */
  label: string;
  items: VocabItem[];
}

export interface UnitGroup extends VocabBatch {
  unit: string;
  name: string;
  lessons: VocabBatch[];
}

/** A vocabulary list practiced in its own tab, with its batches and its own unremembered words. */
export interface VocabDeck {
  id: string;
  level: string;
  source: string;
  /** localStorage key of the deck's unremembered words. */
  unrememberedStorageKey: string;
  items: VocabItem[];
  unitGroups: UnitGroup[];
  firstLesson: VocabBatch | undefined;
  firstLessonKey: string;
  getBatchTitle: (key: string) => string;
  /** Items to practice for a batch; the unremembered batch is a snapshot of the current list. */
  getBatchItems: (key: string, unremembered: VocabItem[]) => VocabItem[];
}

export const UNREMEMBERED_BATCH_KEY = "unremembered";
export const ALL_BATCH_KEY = "all";

const groupBy = <T>(list: T[], keyOf: (item: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const key = keyOf(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
};

/** "Unit 1 - Lesson 1: …" → "Unit 1", "Chapter 2 - Bài 3: …" → "Chapter 2". */
const unitOf = (lesson: VocabBatch): string => lesson.title.match(/^((?:Unit|Chapter)\s+\d+)/i)?.[1] ?? "Khác";

interface DeckConfig {
  id: string;
  level: string;
  source: string;
  unrememberedStorageKey: string;
  items: VocabItem[];
  unitTitles: Record<string, string>;
}

const createVocabDeck = ({ items, unitTitles, ...config }: DeckConfig): VocabDeck => {
  const lessons: VocabBatch[] = Array.from(groupBy(items, (item) => item.lesson || "Chưa phân loại").entries()).map(
    ([lessonName, lessonItems], index) => ({
      key: `lesson_${index + 1}`,
      title: lessonName,
      label: `${lessonName} (${lessonItems.length} từ)`,
      items: lessonItems,
    })
  );

  const unitGroups: UnitGroup[] = Array.from(groupBy(lessons, unitOf).entries()).map(([unit, unitLessons], index) => {
    const name = unitTitles[unit] || unit;
    const unitItems = unitLessons.flatMap((lesson) => lesson.items);
    return {
      key: `unit_${index + 1}`,
      unit,
      name,
      title: `Cả ${name}`,
      label: `🎯 Cả ${name} (${unitItems.length} từ)`,
      items: unitItems,
      lessons: unitLessons,
    };
  });

  const all: VocabBatch = {
    key: ALL_BATCH_KEY,
    title: `Tất cả (${items.length} từ vựng ${config.level})`,
    label: `📚 Tất cả (${items.length} từ vựng ${config.level})`,
    items,
  };
  const batches = new Map<string, VocabBatch>([all, ...unitGroups, ...lessons].map((batch) => [batch.key, batch]));

  return {
    ...config,
    items,
    unitGroups,
    firstLesson: lessons[0],
    firstLessonKey: lessons[0] ? lessons[0].key : ALL_BATCH_KEY,
    getBatchTitle: (key) => (key === UNREMEMBERED_BATCH_KEY ? "Từ chưa nhớ" : (batches.get(key)?.title ?? "Bài học")),
    getBatchItems: (key, unremembered) =>
      key === UNREMEMBERED_BATCH_KEY ? [...unremembered] : (batches.get(key)?.items ?? items),
  };
};

export const N3_DECK = createVocabDeck({
  id: "n3",
  level: "N3",
  source: "Mimikara Oboeru N3",
  unrememberedStorageKey: "mimikara_unremembered_words",
  items: cleanVocabData(n3VocabData as RawVocabItem[]),
  unitTitles: {
    "Unit 1": "Unit 1 – Con người & cuộc sống",
    "Unit 2": "Unit 2 – Động từ (1)",
    "Unit 3": "Unit 3 – Danh từ hóa & tính từ",
    "Unit 4": "Unit 4 – Danh từ (2)",
    "Unit 5": "Unit 5 – Động từ (2)",
    "Unit 6": "Unit 6 – Katakana & tính từ",
    "Unit 7": "Unit 7 – Phó từ",
    "Unit 8": "Unit 8 – Danh từ (3)",
    "Unit 9": "Unit 9 – Động từ (3)",
    "Unit 10": "Unit 10 – Katakana (2)",
    "Unit 11": "Unit 11 – Nấu ăn, phó từ, liên từ",
  },
});

export const N2_DECK = createVocabDeck({
  id: "n2",
  level: "N2",
  source: `${n2VocabData.title} · ${n2VocabData.source}`,
  unrememberedStorageKey: "mimikara_n2_unremembered_words",
  // The N2 list has no Hán Việt of its own: it is derived from the kanji.
  items: cleanVocabData(n2VocabData.words.map((word) => ({ ...word, han_viet: getHanViet(word.kanji) }))),
  unitTitles: Object.fromEntries(Object.entries(n2VocabData.units).map(([unit, title]) => [unit, `${unit} – ${title}`])),
});

export const isUnitBatch = (key: string): boolean => key.startsWith("unit_");

export const getItemKey = (item: { stt?: string | number; question_text?: string; meaning?: string }) => {
  if (item.stt !== undefined && item.stt !== null && String(item.stt).trim() !== "") {
    return `stt_${item.stt}`;
  }
  return `${item.question_text || ""}:::${item.meaning || ""}`;
};
