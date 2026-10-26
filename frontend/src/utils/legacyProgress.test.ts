import { beforeEach, describe, expect, it } from "vitest";
import { clearLegacyProgress, readLegacyProgress } from "./legacyProgress";

const NOW = 1_800_000_000_000;

describe("progress saved before logins existed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is absent from a new browser", () => {
    expect(readLegacyProgress(NOW)).toBeNull();
  });

  it("becomes entries of the current format", () => {
    localStorage.setItem("mimikara_unremembered_words", JSON.stringify([{ stt: 12, kanji: "家庭" }, { stt: 3 }, { kanji: "?" }]));
    localStorage.setItem("mimikara_n2_unremembered_words", "not json");
    localStorage.setItem(
      "mimikara_srs_n5",
      JSON.stringify({
        stt_4: { box: 2, due: 20_000, reviews: 3, lapses: 1 },
        stt_5: { box: 0, due: 20_000, reviews: 1, lapses: 1 },
        broken: { box: 1, due: 1, reviews: 1, lapses: 0 },
        stt_6: { box: "1" },
      })
    );

    expect(readLegacyProgress(NOW)).toEqual({
      progress: {
        // In the order of the list.
        n3: { words: { stt_12: { s: "u", t: NOW - 2 }, stt_3: { s: "u", t: NOW - 1 } }, cards: {} },
        n5: {
          // Remembered once at least: remembered.
          words: { stt_4: { s: "k", t: NOW } },
          cards: {
            stt_4: { box: 2, due: 20_000, reviews: 3, lapses: 1, t: NOW },
            stt_5: { box: 0, due: 20_000, reviews: 1, lapses: 1, t: NOW },
          },
        },
      },
      unremembered: 2,
      cards: 2,
    });
  });

  it("is removed once moved into an account", () => {
    localStorage.setItem("mimikara_srs_n3", JSON.stringify({ stt_1: { box: 1, due: 1, reviews: 1, lapses: 0 } }));
    localStorage.setItem("mimikara_theme", "light");

    clearLegacyProgress();
    expect(readLegacyProgress(NOW)).toBeNull();
    expect(localStorage.getItem("mimikara_theme")).toBe("light");
  });
});
