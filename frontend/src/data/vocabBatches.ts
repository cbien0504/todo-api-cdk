import rawVocabData from "./mimikara_oboeru_vocab.json";
import type { RawVocabItem, VocabItem } from "../types/quiz";
import { cleanVocabData } from "../utils/quizEngine";

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

export const ALL_ITEMS: VocabItem[] = cleanVocabData(rawVocabData as RawVocabItem[]);

export const UNREMEMBERED_BATCH_KEY = "unremembered";
export const ALL_BATCH_KEY = "all";

export const UNIT_TITLES: Record<string, string> = {
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

export const LESSON_BATCHES: VocabBatch[] = Array.from(
  groupBy(ALL_ITEMS, (item) => item.lesson || "Chưa phân loại").entries()
).map(([lessonName, items], index) => ({
  key: `lesson_${index + 1}`,
  title: lessonName,
  label: `${lessonName} (${items.length} từ)`,
  items,
}));

const unitOf = (lesson: VocabBatch): string => lesson.title.match(/^(Unit\s+\d+)/i)?.[1] ?? "Khác";

export const UNIT_GROUPS: UnitGroup[] = Array.from(groupBy(LESSON_BATCHES, unitOf).entries()).map(
  ([unit, lessons], index) => {
    const name = UNIT_TITLES[unit] || unit;
    const items = lessons.flatMap((lesson) => lesson.items);
    return {
      key: `unit_${index + 1}`,
      unit,
      name,
      title: `Cả ${name}`,
      label: `🎯 Cả ${name} (${items.length} từ)`,
      items,
      lessons,
    };
  }
);

export const FIRST_LESSON = LESSON_BATCHES[0];
export const FIRST_LESSON_KEY = FIRST_LESSON ? FIRST_LESSON.key : ALL_BATCH_KEY;

const ALL_BATCH: VocabBatch = {
  key: ALL_BATCH_KEY,
  title: `Tất cả (${ALL_ITEMS.length} từ vựng N3)`,
  label: `📚 Tất cả (${ALL_ITEMS.length} từ vựng N3)`,
  items: ALL_ITEMS,
};

const STATIC_BATCHES = new Map<string, VocabBatch>(
  [ALL_BATCH, ...UNIT_GROUPS, ...LESSON_BATCHES].map((batch) => [batch.key, batch])
);

export const isUnitBatch = (key: string): boolean => key.startsWith("unit_");

export const getBatchTitle = (key: string): string =>
  key === UNREMEMBERED_BATCH_KEY ? "Từ chưa nhớ" : (STATIC_BATCHES.get(key)?.title ?? "Bài học");

/** Items to practice for a batch; the unremembered batch is a snapshot of the current list. */
export const getBatchItems = (key: string, unremembered: VocabItem[]): VocabItem[] =>
  key === UNREMEMBERED_BATCH_KEY ? [...unremembered] : (STATIC_BATCHES.get(key)?.items ?? ALL_ITEMS);

export const getItemKey = (item: { stt?: string | number; question_text?: string; meaning?: string }) => {
  if (item.stt !== undefined && item.stt !== null && String(item.stt).trim() !== "") {
    return `stt_${item.stt}`;
  }
  return `${item.question_text || ""}:::${item.meaning || ""}`;
};
