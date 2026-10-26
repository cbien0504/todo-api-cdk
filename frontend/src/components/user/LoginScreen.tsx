import { useState, type FormEvent } from "react";
import { PASSWORD_RULE, USERNAME_RULE, isValidPassword, normalizeUsername } from "../../utils/progress";
import { ApiError, authApi } from "../../utils/progressApi";

type Mode = "login" | "register";

interface LoginScreenProps {
  onLogin: (username: string, mode: Mode) => void;
  /** Why the learner has to log in again, e.g. an expired session. */
  message?: string | null;
}

/**
 * Logging in with a username and password, or registering them: registering checks the username
 * is free, logging in checks the password. Either way the server opens a session (cookie).
 */
export default function LoginScreen({ onLogin, message }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (mode: Mode) => {
    const name = normalizeUsername(username);
    if (!name) return setError(`Tên đăng nhập chưa hợp lệ: ${USERNAME_RULE}`);
    if (!isValidPassword(password)) return setError(`Mật khẩu chưa hợp lệ: ${PASSWORD_RULE}`);
    setError(null);
    setPending(mode);
    try {
      const account = await (mode === "login" ? authApi.login(name, password) : authApi.register(name, password));
      onLogin(account.username, mode);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không kết nối được máy chủ: hãy kiểm tra mạng rồi thử lại");
      setPending(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit("login");
  };

  return (
    <main className="login">
      <form className="card login-card" onSubmit={onSubmit} noValidate>
        <h2 className="login-title">👋 Đăng nhập để học</h2>
        <p className="login-lead">
          Mỗi tài khoản có tiến độ riêng ở từng cấp độ: từ chưa nhớ, từ đã nhớ và thẻ ghi nhớ, trên mọi thiết bị.
        </p>
        {message && (
          <p className="login-message" role="status">
            {message}
          </p>
        )}

        <label htmlFor="login-username" className="field-label">
          Tên đăng nhập
        </label>
        <input
          id="login-username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="vd: bien.nguyen"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
        <p className="login-rule">{USERNAME_RULE}</p>

        <label htmlFor="login-password" className="field-label">
          Mật khẩu
        </label>
        <div className="password-row">
          <input
            id="login-password"
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? "🙈 Ẩn" : "👁️ Hiện"}
          </button>
        </div>
        <p className="login-rule">{PASSWORD_RULE}</p>

        {error && (
          <p className="login-error" role="alert">
            ⚠️ {error}
          </p>
        )}

        <div className="login-actions">
          <button type="submit" className="btn btn--primary" disabled={pending !== null}>
            {pending === "login" ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void submit("register")}
            disabled={pending !== null}
          >
            {pending === "register" ? "Đang tạo tài khoản…" : "Đăng ký"}
          </button>
        </div>
        <p className="login-note">
          Chưa có tài khoản? Nhập tên và mật khẩu bạn muốn rồi bấm <strong>Đăng ký</strong>. Quên mật khẩu: nhờ người
          quản lý ứng dụng đặt lại.
        </p>
      </form>
    </main>
  );
}
