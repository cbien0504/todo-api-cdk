import { vi } from "vitest";
import type { DeckId, Progress } from "../types/progress";
import { EMPTY_DECK, mergeDeck } from "../utils/progress";

interface Account {
  password: string;
  progress: Progress;
}

/**
 * Serves the API of backend/handler.py from memory through a stubbed `fetch`: `accounts` holds the
 * password and saved progress of each username, `session` the username of the session cookie.
 */
export function serveFakeApi(accounts: Record<string, Account> = {}, session: string | null = null) {
  const server = { accounts, session };
  const answer = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/register") {
      if (body.username in server.accounts) {
        return answer(409, { error: "username_taken", message: "Tên đăng nhập này đã có người dùng" });
      }
      server.accounts[body.username] = { password: body.password, progress: {} };
      server.session = body.username;
      return answer(200, { username: body.username });
    }
    if (url === "/api/login") {
      const account = server.accounts[body.username];
      if (!account) return answer(401, { error: "unknown_user", message: "Chưa có tài khoản tên này: bấm Đăng ký để tạo mới" });
      if (account.password !== body.password) return answer(401, { error: "wrong_password", message: "Sai mật khẩu (còn 4 lần thử)" });
      server.session = body.username;
      return answer(200, { username: body.username });
    }
    if (url === "/api/logout") {
      server.session = null;
      return answer(200, {});
    }
    const [, username, deck] = url.match(/^\/api\/users\/([^/]+)\/progress(?:\/([^/]+))?$/)!;
    if (server.session !== username) return answer(401, { error: "unauthenticated", message: "Hãy đăng nhập lại" });
    const { progress } = server.accounts[username];
    if (!deck) return answer(200, { username, progress });
    progress[deck as DeckId] = mergeDeck(progress[deck as DeckId] ?? EMPTY_DECK, body);
    return answer(200, { deck, summary: {} });
  });

  vi.stubGlobal("fetch", fetchMock);
  return Object.assign(server, { fetch: fetchMock });
}
