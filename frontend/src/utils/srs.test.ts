import { describe, it, expect } from "vitest";
import { BOX_INTERVALS, buildStudyQueue, dayNumber, gradeCard, intervalLabel, srsStats, type SrsCards } from "./srs";

const TODAY = 20_000;
const keyOf = (word: string) => word;

describe("spaced repetition", () => {
  it("moves remembered cards to longer intervals and restarts forgotten ones", () => {
    const fresh = gradeCard(undefined, "good", TODAY);
    expect(fresh).toEqual({ box: 1, due: TODAY + 1, reviews: 1, lapses: 0 });

    const easy = gradeCard(fresh, "easy", TODAY + 1);
    expect(easy.box).toBe(3);
    expect(easy.due).toBe(TODAY + 1 + BOX_INTERVALS[3]);

    const hard = gradeCard(easy, "hard", TODAY + 8);
    expect(hard.box).toBe(2);

    const forgotten = gradeCard(hard, "again", TODAY + 11);
    expect(forgotten).toEqual({ box: 0, due: TODAY + 11, reviews: 4, lapses: 1 });
    expect(gradeCard(undefined, "hard", TODAY).box).toBe(1);
  });

  it("caps the box at the longest interval", () => {
    const last = BOX_INTERVALS.length - 1;
    expect(gradeCard({ box: last, due: TODAY, reviews: 9, lapses: 0 }, "easy", TODAY).box).toBe(last);
  });

  it("labels the interval each grade leads to", () => {
    expect(intervalLabel(undefined, "again")).toBe("ôn lại ngay");
    expect(intervalLabel(undefined, "good")).toBe("1 ngày");
    expect(intervalLabel({ box: 2, due: TODAY, reviews: 2, lapses: 0 }, "easy")).toBe("14 ngày");
  });

  it("queues overdue cards first, then a limited number of unseen words", () => {
    const cards: SrsCards = {
      a: { box: 1, due: TODAY, reviews: 1, lapses: 0 },
      b: { box: 2, due: TODAY - 3, reviews: 2, lapses: 0 },
      c: { box: 3, due: TODAY + 2, reviews: 3, lapses: 0 },
    };
    const queue = buildStudyQueue(["a", "b", "c", "d", "e", "f"], cards, keyOf, TODAY, 2);
    expect(queue).toEqual(["b", "a", "d", "e"]);
  });

  it("counts unseen, due, learning and learned words", () => {
    const cards: SrsCards = {
      a: { box: 1, due: TODAY + 1, reviews: 1, lapses: 0 },
      b: { box: 4, due: TODAY - 1, reviews: 5, lapses: 0 },
    };
    expect(srsStats(["a", "b", "c"], cards, keyOf, TODAY)).toEqual({
      total: 3,
      unseen: 1,
      due: 1,
      learning: 1,
      mastered: 1,
      dueTomorrow: 1,
    });
  });

  it("numbers local calendar days", () => {
    const morning = new Date(2026, 9, 26, 0, 5);
    const night = new Date(2026, 9, 26, 23, 55);
    expect(dayNumber(night)).toBe(dayNumber(morning));
    expect(dayNumber(new Date(2026, 9, 27, 0, 5))).toBe(dayNumber(morning) + 1);
  });
});
