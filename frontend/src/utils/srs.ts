/**
 * Spaced repetition (Leitner boxes) for the flashcard mode: every card a learner
 * remembers moves to a box reviewed less often, a forgotten card starts over.
 */

export type SrsGrade = "again" | "hard" | "good" | "easy";

export interface SrsCard {
  /** Leitner box; the review interval grows with the box. */
  box: number;
  /** Day number (see `dayNumber`) when the card is due again. */
  due: number;
  reviews: number;
  lapses: number;
}

export type SrsCards = Record<string, SrsCard>;

/** Days until the next review for each box. */
export const BOX_INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
/** Cards reviewed every two weeks or less often count as learned. */
export const MASTERED_BOX = 4;
export const NEW_CARDS_PER_SESSION = 20;

/** Local calendar day as a number, so "due today" changes at local midnight. */
export const dayNumber = (date: Date = new Date()): number =>
  Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);

const nextBox = (box: number, grade: SrsGrade): number => {
  const last = BOX_INTERVALS.length - 1;
  switch (grade) {
    case "again":
      return 0;
    case "hard":
      return Math.max(1, box - 1);
    case "good":
      return Math.min(last, box + 1);
    case "easy":
      return Math.min(last, box + 2);
  }
};

export const gradeCard = (card: SrsCard | undefined, grade: SrsGrade, today: number): SrsCard => {
  const box = nextBox(card?.box ?? 0, grade);
  return {
    box,
    due: today + BOX_INTERVALS[box],
    reviews: (card?.reviews ?? 0) + 1,
    lapses: (card?.lapses ?? 0) + (grade === "again" ? 1 : 0),
  };
};

/** When a grade brings the card back, shown under the grade buttons. */
export const intervalLabel = (card: SrsCard | undefined, grade: SrsGrade): string => {
  const days = BOX_INTERVALS[nextBox(card?.box ?? 0, grade)];
  return days === 0 ? "ôn lại ngay" : `${days} ngày`;
};

/** Today's cards: due reviews (most overdue first), then up to `newLimit` unseen items in list order. */
export const buildStudyQueue = <T>(
  items: T[],
  cards: SrsCards,
  keyOf: (item: T) => string,
  today: number,
  newLimit: number
): T[] => {
  const due = items
    .filter((item) => (cards[keyOf(item)]?.due ?? Infinity) <= today)
    .sort((a, b) => cards[keyOf(a)].due - cards[keyOf(b)].due);
  const unseen = items.filter((item) => !cards[keyOf(item)]).slice(0, newLimit);
  return [...due, ...unseen];
};

export interface SrsStats {
  total: number;
  unseen: number;
  /** Seen cards due today or earlier. */
  due: number;
  /** Seen cards not learned yet. */
  learning: number;
  mastered: number;
  /** Cards due tomorrow. */
  dueTomorrow: number;
}

export const srsStats = <T>(items: T[], cards: SrsCards, keyOf: (item: T) => string, today: number): SrsStats => {
  const stats: SrsStats = { total: items.length, unseen: 0, due: 0, learning: 0, mastered: 0, dueTomorrow: 0 };
  for (const item of items) {
    const card = cards[keyOf(item)];
    if (!card) {
      stats.unseen++;
      continue;
    }
    if (card.due <= today) stats.due++;
    if (card.due === today + 1) stats.dueTomorrow++;
    if (card.box >= MASTERED_BOX) stats.mastered++;
    else stats.learning++;
  }
  return stats;
};
