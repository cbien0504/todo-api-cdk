import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { enumCodec, usePersistentState, type StorageCodec } from "./hooks/usePersistentState";
import { trackEvent } from "./utils/gtm";
import { normalizeUsername } from "./utils/progress";
import { authApi } from "./utils/progressApi";
import { ProgressStore } from "./utils/progressStore";
import StudyLevels from "./components/StudyLevels";
import LoginScreen from "./components/user/LoginScreen";
import ProgressProvider from "./components/user/ProgressProvider";
import SessionNotices from "./components/user/SessionNotices";
import UserBar from "./components/user/UserBar";

const THEMES = ["dark", "light"] as const;
type Theme = (typeof THEMES)[number];

const themeCodec = enumCodec(THEMES);
// The learner logged in on this device, "" when nobody is; the session itself is an HttpOnly cookie.
const usernameCodec: StorageCodec<string> = {
  parse: (raw) => normalizeUsername(raw) ?? undefined,
  serialize: (value) => value,
};

interface AppHeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  children?: ReactNode;
}

function AppHeader({ theme, onToggleTheme, children }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-badge">N5 – N2</span>
        <div>
          <h1 className="brand-title">Mimikara Oboeru</h1>
          <p className="brand-sub">
            Học từ vựng JLPT N5 → N2 & luyện đề{" "}
            <span className="nowrap" lang="ja">
              文字・語彙
            </span>{" "}
            N3
          </p>
        </div>
      </div>
      <div className="header-actions">
        {children}
        <button
          type="button"
          className="btn btn--secondary btn--icon"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [theme, setTheme] = usePersistentState<Theme>("mimikara_theme", "dark", themeCodec);
  const [username, setUsername] = usePersistentState("mimikara_user", "", usernameCodec);
  // Greets the learner after logging in or registering, not when the app opens already logged in.
  const [welcome, setWelcome] = useState<"login" | "register" | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const store = useMemo(() => (username ? new ProgressStore(username) : null), [username]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    trackEvent("theme_toggle", { theme: next });
  };

  const login = (name: string, mode: "login" | "register") => {
    setUsername(name);
    setWelcome(mode);
    setLoginMessage(null);
    trackEvent(mode === "register" ? "sign_up" : "login");
  };

  const logout = async () => {
    // Saves the last changes with the session, then closes it; the login only shows afterwards, so a
    // new login cannot get its session closed. Changes that could not be saved stay on this device.
    await store?.sync();
    await authApi.logout().catch(() => {});
    setUsername("");
    setWelcome(null);
    trackEvent("logout");
  };

  const expire = useCallback(() => {
    setUsername("");
    setWelcome(null);
    setLoginMessage("Phiên đăng nhập đã hết hạn: hãy đăng nhập lại, tiến độ trên máy này sẽ được lưu tiếp.");
  }, [setUsername]);

  if (!store) {
    return (
      <div className="app">
        <AppHeader theme={theme} onToggleTheme={toggleTheme} />
        <LoginScreen onLogin={login} message={loginMessage} />
      </div>
    );
  }

  return (
    <ProgressProvider store={store}>
      <div className="app">
        <AppHeader theme={theme} onToggleTheme={toggleTheme}>
          <UserBar username={username} onLogout={logout} />
        </AppHeader>
        {/* A new learner starts new study sessions. */}
        <Fragment key={username}>
          <SessionNotices welcome={welcome} onExpired={expire} />
          <StudyLevels />
        </Fragment>
      </div>
    </ProgressProvider>
  );
}
