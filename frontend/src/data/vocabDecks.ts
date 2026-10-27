import n3VocabData from "./mimikara_oboeru_vocab.json";
import n5VocabData from "./jtest_n5_vocab.json";
import n4VocabData from "./jtest_n4_vocab.json";
import n2VocabData from "./jtest_n2_vocab.json";
import companionsData from "./vocab_companions.json";
import type { DeckId } from "../types/progress";
import type { Companion, RawVocabItem, VocabItem } from "../types/quiz";
import { cleanVocabData } from "../utils/quizEngine";
import { getHanViet } from "../utils/hanViet";

export interface VocabBatch {
  key: string;
  /** Title shown while practicing the batch. */
  title: string;
  items: VocabItem[];
}

export interface UnitGroup extends VocabBatch {
  unit: string;
  name: string;
  lessons: VocabBatch[];
}

/** The vocabulary list of a JLPT level, with its batches. */
export interface VocabDeck {
  /** Also names the deck in the learner's progress. */
  id: DeckId;
  level: string;
  source: string;
  items: VocabItem[];
  /** The word of a progress key (`getItemKey`). */
  itemByKey: (key: string) => VocabItem | undefined;
  unitGroups: UnitGroup[];
  firstLesson: VocabBatch | undefined;
  firstLessonKey: string;
  getBatchTitle: (key: string) => string;
  /** Items to practice for a batch; the unremembered batch is a snapshot of the current list. */
  getBatchItems: (key: string, unremembered: VocabItem[]) => VocabItem[];
  /** Synonyms, antonyms or verb pair shown with a word (built by scripts/build_vocab_data.py). */
  companionsOf: (item: VocabItem) => Companion[];
}

export const UNREMEMBERED_BATCH_KEY = "unremembered";
export const ALL_BATCH_KEY = "all";

/** Key of a word in the progress of its deck: "stt_12". */
export const getItemKey = (item: { stt?: string | number; question_text?: string; meaning?: string }) => {
  if (item.stt !== undefined && item.stt !== null && String(item.stt).trim() !== "") {
    return `stt_${item.stt}`;
  }
  return `${item.question_text || ""}:::${item.meaning || ""}`;
};

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
  id: DeckId;
  level: string;
  source: string;
  items: VocabItem[];
  unitTitles: Record<string, string>;
  /** Companions keyed by `stt`. */
  companions: Record<string, Companion[]>;
}

const createVocabDeck = ({ items, unitTitles, companions, ...config }: DeckConfig): VocabDeck => {
  const lessons: VocabBatch[] = Array.from(groupBy(items, (item) => item.lesson || "Chưa phân loại").entries()).map(
    ([lessonName, lessonItems], index) => ({
      key: `lesson_${index + 1}`,
      title: lessonName,
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
      items: unitItems,
      lessons: unitLessons,
    };
  });

  const all: VocabBatch = {
    key: ALL_BATCH_KEY,
    title: `Tất cả (${items.length} từ vựng ${config.level})`,
    items,
  };
  const batches = new Map<string, VocabBatch>([all, ...unitGroups, ...lessons].map((batch) => [batch.key, batch]));
  const itemsByKey = new Map(items.map((item) => [getItemKey(item), item]));

  return {
    ...config,
    items,
    itemByKey: (key) => itemsByKey.get(key),
    unitGroups,
    firstLesson: lessons[0],
    firstLessonKey: lessons[0] ? lessons[0].key : ALL_BATCH_KEY,
    getBatchTitle: (key) => (key === UNREMEMBERED_BATCH_KEY ? "Từ chưa nhớ" : (batches.get(key)?.title ?? "Bài học")),
    getBatchItems: (key, unremembered) =>
      key === UNREMEMBERED_BATCH_KEY ? [...unremembered] : (batches.get(key)?.items ?? items),
    companionsOf: (item) => companions[String(item.stt)] ?? [],
  };
};

export const N3_DECK = createVocabDeck({
  id: "n3",
  level: "N3",
  source: "Mimikara Oboeru N3",
  items: cleanVocabData(n3VocabData as RawVocabItem[]),
  companions: companionsData.n3 as Record<string, Companion[]>,
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

/** A JLPT list of jtest.net, written by scripts/build_vocab_data.py. */
interface JtestVocabData {
  title: string;
  source: string;
  /** Chapter titles keyed by "Chapter 1", "Chapter 2"… */
  units: Record<string, string>;
  words: RawVocabItem[];
}

const createJtestDeck = (id: "n5" | "n4" | "n2", data: JtestVocabData): VocabDeck =>
  createVocabDeck({
    id,
    level: id.toUpperCase(),
    source: `${data.title} · ${data.source}`,
    companions: companionsData[id] as Record<string, Companion[]>,
    // The jtest lists have no Hán Việt of their own: it is derived from the kanji.
    items: cleanVocabData(data.words.map((word) => ({ ...word, han_viet: getHanViet(word.kanji ?? "") }))),
    unitTitles: Object.fromEntries(Object.entries(data.units).map(([unit, title]) => [unit, `${unit} – ${title}`])),
  });

export const N5_DECK = createJtestDeck("n5", n5VocabData);
export const N4_DECK = createJtestDeck("n4", n4VocabData);
export const N2_DECK = createJtestDeck("n2", n2VocabData);

export const isUnitBatch = (key: string): boolean => key.startsWith("unit_");
