import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeckId, DeckProgress, Progress } from "../types/progress";
import { EMPTY_DECK, mergeDeck } from "./progress";
import { ApiError, type ProgressApi, type ProgressPatch } from "./progressApi";
import { ProgressStore, SYNC_DELAY_MS, progressStorageKey } from "./progressStore";

const CARD = { box: 1, due: 20_000, reviews: 1, lapses: 0 };

/** The progress API with the server's progress of each user in `server`. */
const fakeApi = (server: Record<string, Progress> = {}) => {
  const api = {
    load: vi.fn(async (username: string) => ({ username, progress: server[username] ?? {} })),
    patchDeck: vi.fn(async (username: string, deck: DeckId, patch: ProgressPatch) => {
      const progress = (server[username] ??= {});
      progress[deck] = mergeDeck(progress[deck] ?? EMPTY_DECK, patch);
      return {};
    }),
  } satisfies ProgressApi;
  return { api, server };
};

const cache = (username = "bien") => JSON.parse(localStorage.getItem(progressStorageKey(username)) ?? "null");

describe("ProgressStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records changes with their time, caches them and tells its listeners", () => {
    const store = new ProgressStore("bien", fakeApi().api);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.setWordStatus("n3", "stt_1", "u")).toBe(true);
    expect(store.setWordStatus("n3", "stt_1", "u")).toBe(false);
    store.setWordStatus("n3", "stt_2", "k");
    store.setCard("n5", "stt_9", CARD);

    const n3 = store.getDeck("n3");
    expect(n3.words.stt_1.s).toBe("u");
    expect(n3.words.stt_2.s).toBe("k");
    expect(n3.words.stt_2.t).toBeGreaterThan(n3.words.stt_1.t);
    expect(store.getDeck("n5").cards.stt_9).toMatchObject(CARD);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(cache().decks.n3).toEqual(n3);
    expect(cache().dirty.n3.words).toEqual(["stt_1", "stt_2"]);
    expect(store.hasUnsavedChanges()).toBe(true);
  });

  it("restores the cached progress and its unsaved changes", async () => {
    const first = new ProgressStore("bien", fakeApi().api);
    first.setWordStatus("n2", "stt_4", "u");

    const { api, server } = fakeApi();
    const store = new ProgressStore("bien", api);
    expect(store.getDeck("n2").words.stt_4.s).toBe("u");
    expect(new ProgressStore("binh", api).getDeck("n2")).toEqual(EMPTY_DECK);

    await store.sync();
    expect(server.bien.n2!.words.stt_4.s).toBe("u");
  });

  it("sends only the unsaved entries of each deck, then reports everything saved", async () => {
    const { api, server } = fakeApi();
    const store = new ProgressStore("bien", api);
    store.setWordStatus("n3", "stt_1", "u");
    store.setCard("n4", "stt_2", CARD);

    await store.sync();
    expect(api.patchDeck).toHaveBeenCalledTimes(2);
    expect(server.bien).toEqual({ n4: store.getDeck("n4"), n3: store.getDeck("n3") });
    expect(store.getStatus()).toBe("synced");
    expect(store.hasUnsavedChanges()).toBe(false);

    store.setWordStatus("n3", "stt_3", "k");
    expect(store.getStatus()).toBe("pending");
    await store.sync();
    expect(api.patchDeck).toHaveBeenLastCalledWith("bien", "n3", { words: { stt_3: store.getDeck("n3").words.stt_3 }, cards: {} }, { keepalive: false });
  });

  it("sends again a change made while its previous value was on the way", async () => {
    const { api } = fakeApi();
    let release = () => {};
    api.patchDeck.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({}))));
    const store = new ProgressStore("bien", api);

    store.setWordStatus("n3", "stt_1", "u");
    const sending = store.sync();
    store.setWordStatus("n3", "stt_1", "k");
    release();
    await sending;

    expect(store.getStatus()).toBe("pending");
    await store.sync();
    expect(api.patchDeck.mock.calls[1][2].words).toEqual({ stt_1: store.getDeck("n3").words.stt_1 });
    expect(store.hasUnsavedChanges()).toBe(false);
  });

  it("keeps the changes while offline and retries later", async () => {
    vi.useFakeTimers();
    const { api, server } = fakeApi({ bien: {} });
    api.patchDeck.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const store = new ProgressStore("bien", api);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getStatus()).toBe("synced");

    store.setWordStatus("n5", "stt_1", "u");
    await vi.advanceTimersByTimeAsync(SYNC_DELAY_MS);
    expect(store.getStatus()).toBe("offline");
    expect(store.hasUnsavedChanges()).toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(store.getStatus()).toBe("synced");
    expect(server.bien.n5!.words.stt_1.s).toBe("u");
    store.dispose();
  });

  it("downloads the saved progress again when the first download failed", async () => {
    vi.useFakeTimers();
    const { api } = fakeApi({ bien: { n3: { words: { stt_7: { s: "k", t: 1 } }, cards: {} } } });
    api.load.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const store = new ProgressStore("bien", api);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getStatus()).toBe("offline");
    expect(store.isLoaded()).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(store.isLoaded()).toBe(true);
    expect(store.getDeck("n3").words.stt_7.s).toBe("k");
    store.dispose();
  });

  it("waits for a new login when the server refuses the session", async () => {
    vi.useFakeTimers();
    const { api } = fakeApi({ bien: {} });
    api.patchDeck.mockRejectedValue(new ApiError(401, "unauthenticated", "Hãy đăng nhập lại"));
    const store = new ProgressStore("bien", api);
    store.start();
    await vi.advanceTimersByTimeAsync(0);

    store.setWordStatus("n3", "stt_1", "u");
    await vi.advanceTimersByTimeAsync(SYNC_DELAY_MS);
    expect(store.getStatus()).toBe("expired");
    store.setWordStatus("n3", "stt_2", "u");
    await vi.advanceTimersByTimeAsync(120_000);

    // No retry: the changes stay cached for the next login.
    expect(api.patchDeck).toHaveBeenCalledTimes(1);
    expect(cache().dirty.n3.words).toEqual(["stt_1", "stt_2"]);
    store.dispose();
  });

  it("stops sending entries the server refuses", async () => {
    const { api } = fakeApi();
    api.patchDeck.mockRejectedValueOnce(new ApiError(400, "invalid_input", "invalid"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = new ProgressStore("bien", api);
    store.setWordStatus("n3", "stt_1", "u");

    await store.sync();
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.getStatus()).toBe("synced");
  });

  it("merges the saved progress entry by entry: the latest change wins", async () => {
    const remote: DeckProgress = {
      words: { stt_1: { s: "k", t: 1 }, stt_2: { s: "k", t: Date.now() + 60_000 } },
      cards: { stt_3: { ...CARD, t: 1 } },
    };
    const { api } = fakeApi({ bien: { n2: remote } });
    const store = new ProgressStore("bien", api);
    store.setWordStatus("n2", "stt_1", "u");
    store.setWordStatus("n2", "stt_2", "u");

    await store.refresh();
    expect(store.isLoaded()).toBe(true);
    expect(store.getDeck("n2").words.stt_1.s).toBe("u");
    expect(store.getDeck("n2").words.stt_2.s).toBe("k");
    expect(store.getDeck("n2").cards.stt_3).toMatchObject(CARD);
  });

  it("adds the progress of earlier entries only where the learner has none", () => {
    const store = new ProgressStore("bien", fakeApi().api);
    store.setWordStatus("n3", "stt_1", "k");

    store.addMissing({ n3: { words: { stt_1: { s: "u", t: 5 }, stt_2: { s: "u", t: 5 } }, cards: { stt_1: { ...CARD, t: 5 } } } });
    expect(store.getDeck("n3").words.stt_1.s).toBe("k");
    expect(store.getDeck("n3").words.stt_2).toEqual({ s: "u", t: 5 });
    expect(store.getDeck("n3").cards.stt_1).toEqual({ ...CARD, t: 5 });
    expect(cache().dirty.n3).toEqual({ words: ["stt_1", "stt_2"], cards: ["stt_1"] });
  });

  it("neither saves nor notifies once disposed", async () => {
    const { api } = fakeApi();
    const store = new ProgressStore("bien", api);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setWordStatus("n3", "stt_1", "u");
    const sending = store.sync();
    store.dispose();
    localStorage.clear();
    await sending;

    expect(localStorage.length).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
