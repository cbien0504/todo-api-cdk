import type { DeckId, DeckProgress, Progress, WordStatus } from "../types/progress";
import { DECK_IDS, EMPTY_DECK, mergeDeck } from "./progress";
import { ApiError, progressApi, type ProgressApi } from "./progressApi";
import type { SrsCard } from "./srs";

/**
 * loading: downloading the saved progress after login; synced: every change is saved on the server;
 * pending: changes wait to be sent; offline: the server cannot be reached, changes stay on this device;
 * expired: the server refused the session, the learner has to log in again (changes stay on this device).
 */
export type SyncStatus = "loading" | "synced" | "pending" | "offline" | "expired";

type Section = keyof DeckProgress;

const SECTIONS: readonly Section[] = ["words", "cards"];

export const progressStorageKey = (username: string) => `mimikara_progress_${username}`;
/** Changes are sent together, this long after the last one. */
export const SYNC_DELAY_MS = 3_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000];
/** Coming back to the page downloads the changes made on other devices, at most this often. */
const REFRESH_INTERVAL_MS = 60_000;

interface Cache {
  decks: Progress;
  /** Keys changed on this device and not saved on the server yet. */
  dirty: Partial<Record<DeckId, Record<Section, string[]>>>;
}

const pick = <E>(entries: Record<string, E>, keys: Set<string>): Record<string, E> =>
  Object.fromEntries([...keys].filter((key) => key in entries).map((key) => [key, entries[key]]));

/**
 * The progress of one learner: kept in memory, cached in localStorage so the app works offline,
 * and synced with the server (backend/handler.py). Every change records when it was made, so the
 * copies of several devices merge entry by entry (mergeDeck).
 */
export class ProgressStore {
  readonly username: string;
  private readonly api: ProgressApi;
  private readonly storage: Storage;
  private decks: Record<DeckId, DeckProgress>;
  private dirty: Record<DeckId, Record<Section, Set<string>>>;
  private status: SyncStatus = "loading";
  private state: "idle" | "running" | "disposed" = "idle";
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private syncing: Promise<void> | null = null;
  private failures = 0;
  private lastChange = 0;
  private lastRefresh = 0;
  /** The saved progress was downloaded once. */
  private loaded = false;

  constructor(username: string, api: ProgressApi = progressApi, storage: Storage = localStorage) {
    this.username = username;
    this.api = api;
    this.storage = storage;
    const cache = this.readCache();
    this.decks = Object.fromEntries(DECK_IDS.map((deck) => [deck, cache.decks[deck] ?? EMPTY_DECK])) as Record<
      DeckId,
      DeckProgress
    >;
    this.dirty = Object.fromEntries(
      DECK_IDS.map((deck) => [deck, { words: new Set(cache.dirty[deck]?.words), cards: new Set(cache.dirty[deck]?.cards) }])
    ) as Record<DeckId, Record<Section, Set<string>>>;
  }

  /** Downloads the saved progress, then keeps sending the changes of this device. */
  start(): void {
    this.state = "running";
    void this.refresh();
  }

  /** Stops syncing and saving; a request on its way still reaches the server. */
  dispose(): void {
    this.state = "disposed";
    clearTimeout(this.timer);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getDeck = (deck: DeckId): DeckProgress => this.decks[deck];

  getStatus = (): SyncStatus => this.status;

  /** The progress saved on the server was downloaded. */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** Sets the status of a word; false when it already had it. */
  setWordStatus(deck: DeckId, key: string, status: WordStatus): boolean {
    if (this.decks[deck].words[key]?.s === status) return false;
    this.update(deck, { words: { [key]: { s: status, t: this.nextTime() } } });
    return true;
  }

  /** A correct answer or a remembered flashcard: the word is remembered, unless it waits for review. */
  markKnown(deck: DeckId, key: string): void {
    if (!this.decks[deck].words[key]) this.update(deck, { words: { [key]: { s: "k", t: this.nextTime() } } });
  }

  setCard(deck: DeckId, key: string, card: SrsCard): void {
    this.update(deck, { cards: { [key]: { ...card, t: this.nextTime() } } });
  }

  /** Adds the entries this learner has no progress for yet, e.g. progress saved before logins existed. */
  addMissing(progress: Progress): void {
    for (const deck of DECK_IDS) {
      const current = this.decks[deck];
      const missing = <S extends Section>(section: S) =>
        Object.fromEntries(
          Object.entries(progress[deck]?.[section] ?? {}).filter(([key]) => !current[section][key])
        ) as DeckProgress[S];
      this.update(deck, { words: missing("words"), cards: missing("cards") });
    }
  }

  /** Downloads the progress saved on the server (from other devices), merges it, then sends the local changes. */
  async refresh(): Promise<void> {
    this.lastRefresh = Date.now();
    try {
      const { progress } = await this.api.load(this.username);
      if (this.state === "disposed") return;
      this.loaded = true;
      this.mergeRemote(progress);
    } catch (error) {
      this.fail(error);
      return;
    }
    await this.sync();
  }

  refreshIfStale(): void {
    if (Date.now() - this.lastRefresh > REFRESH_INTERVAL_MS) void this.refresh();
  }

  /** Sends the changes not saved on the server yet; `keepalive` lets the request outlive the page. */
  sync({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> {
    this.syncing ??= this.push(keepalive).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  hasUnsavedChanges(): boolean {
    return DECK_IDS.some((deck) => SECTIONS.some((section) => this.dirty[deck][section].size > 0));
  }

  private async push(keepalive: boolean): Promise<void> {
    clearTimeout(this.timer);
    for (const deck of DECK_IDS) {
      const dirty = this.dirty[deck];
      if (!dirty.words.size && !dirty.cards.size) continue;
      const current = this.decks[deck];
      const patch: DeckProgress = { words: pick(current.words, dirty.words), cards: pick(current.cards, dirty.cards) };
      try {
        await this.api.patchDeck(this.username, deck, patch, { keepalive });
      } catch (error) {
        if (!(error instanceof ApiError && error.isPermanent)) return this.fail(error);
        // Sending them again would be refused again.
        console.error(`The server refused the progress of ${deck}`, error);
      }
      if (this.state === "disposed") return;
      this.clean(deck, patch);
    }
    this.failures = 0;
    this.setStatus(this.hasUnsavedChanges() ? "pending" : "synced");
    if (this.hasUnsavedChanges()) this.schedule(SYNC_DELAY_MS);
  }

  /** Forgets the entries saved by a request, unless they changed while it was on its way. */
  private clean(deck: DeckId, sent: DeckProgress): void {
    for (const section of SECTIONS) {
      for (const [key, entry] of Object.entries(sent[section])) {
        if (this.decks[deck][section][key] === entry) this.dirty[deck][section].delete(key);
      }
    }
    this.persist();
  }

  private fail(error: unknown): void {
    if (this.state === "disposed") return;
    if (error instanceof ApiError && error.status === 401) {
      // Retrying cannot help: the changes wait on this device for the next login.
      clearTimeout(this.timer);
      this.setStatus("expired");
      return;
    }
    if (error instanceof ApiError) console.error("Progress sync failed", error);
    this.failures++;
    this.setStatus("offline");
    this.schedule(RETRY_DELAYS_MS[Math.min(this.failures, RETRY_DELAYS_MS.length) - 1]);
  }

  private mergeRemote(progress: Progress): void {
    for (const deck of DECK_IDS) {
      const remote = progress[deck];
      if (remote) this.decks = { ...this.decks, [deck]: mergeDeck(this.decks[deck], remote) };
    }
    this.persist();
    this.emit();
  }

  private update(deck: DeckId, changes: Partial<DeckProgress>): void {
    const keys = SECTIONS.flatMap((section) => Object.keys(changes[section] ?? {}).map((key) => [section, key] as const));
    if (keys.length === 0) return;
    const current = this.decks[deck];
    this.decks = {
      ...this.decks,
      [deck]: { words: { ...current.words, ...changes.words }, cards: { ...current.cards, ...changes.cards } },
    };
    for (const [section, key] of keys) this.dirty[deck][section].add(key);
    this.persist();
    if (this.status === "synced") this.status = "pending";
    this.emit();
    // After a failure the retry waits for its own delay.
    if (this.failures === 0) this.schedule(SYNC_DELAY_MS);
  }

  /** Change times strictly increase, so two changes of the same entry never tie. */
  private nextTime(): number {
    this.lastChange = Math.max(Date.now(), this.lastChange + 1);
    return this.lastChange;
  }

  private schedule(delay: number): void {
    if (this.state !== "running" || this.status === "expired") return;
    clearTimeout(this.timer);
    // Until the saved progress was downloaded, retrying means downloading it first.
    this.timer = setTimeout(() => void (this.loaded ? this.sync() : this.refresh()), delay);
  }

  private setStatus(status: SyncStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.emit();
  }

  private emit(): void {
    if (this.state !== "disposed") this.listeners.forEach((listener) => listener());
  }

  private persist(): void {
    if (this.state === "disposed") return;
    const dirty = Object.fromEntries(
      DECK_IDS.map((deck) => [deck, { words: [...this.dirty[deck].words], cards: [...this.dirty[deck].cards] }])
    );
    try {
      this.storage.setItem(progressStorageKey(this.username), JSON.stringify({ decks: this.decks, dirty }));
    } catch (e) {
      console.error(`Failed to save the progress of ${this.username}`, e);
    }
  }

  private readCache(): Cache {
    try {
      const cache = JSON.parse(this.storage.getItem(progressStorageKey(this.username)) ?? "null");
      if (cache && typeof cache === "object") return { decks: cache.decks ?? {}, dirty: cache.dirty ?? {} };
    } catch (e) {
      console.error(`Failed to load the progress of ${this.username}`, e);
    }
    return { decks: {}, dirty: {} };
  }
}
