import type { DeckId, DeckProgress, Progress } from "../types/progress";

/** Entries changed on this device, merged into the saved deck by the server. */
export type ProgressPatch = Partial<DeckProgress>;

export interface ProgressApi {
  load(username: string): Promise<{ username: string; progress: Progress }>;
  patchDeck(username: string, deck: DeckId, patch: ProgressPatch, options?: { keepalive?: boolean }): Promise<unknown>;
}

/** An answer of the API other than success; a fetch that fails without answer means offline. */
export class ApiError extends Error {
  readonly status: number;
  /** Error code of backend/handler.py: "unknown_user", "wrong_password", "unauthenticated"… */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** Sending the same request again cannot succeed (invalid or too large). */
  get isPermanent(): boolean {
    return this.status === 400 || this.status === 413;
  }
}

// keepalive requests (sent while the page is hidden or closed) are limited to 64 KB.
const KEEPALIVE_MAX_BYTES = 60_000;
// A request still waiting after this long fails like an offline one.
const TIMEOUT_MS = 10_000;

const request = async <T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> => {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const response = await fetch(`/api${path}`, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload,
    keepalive: keepalive && (payload?.length ?? 0) < KEEPALIVE_MAX_BYTES,
    signal: AbortSignal.timeout?.(TIMEOUT_MS),
  });
  // When the API is unreachable, CloudFront answers with the page of the app instead of JSON.
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    throw new ApiError(response.status, data?.error ?? "unavailable", data?.message ?? `Máy chủ trả lời ${response.status}`);
  }
  return data as T;
};

/** The progress of the logged-in learner; the session cookie must belong to `username`. */
export const progressApi: ProgressApi = {
  load: (username) => request("GET", `/users/${encodeURIComponent(username)}/progress`),
  patchDeck: (username, deck, patch, { keepalive = false } = {}) =>
    request("PATCH", `/users/${encodeURIComponent(username)}/progress/${deck}`, patch, keepalive),
};

/** Accounts: a successful login or registration sets the session, an HttpOnly cookie sent to /api. */
export const authApi = {
  register: (username: string, password: string) =>
    request<{ username: string }>("POST", "/register", { username, password }),
  login: (username: string, password: string) => request<{ username: string }>("POST", "/login", { username, password }),
  logout: () => request<object>("POST", "/logout", {}),
};
