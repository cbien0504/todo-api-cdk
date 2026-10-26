import { useState } from "react";
import { useSyncStatus } from "../../hooks/useProgress";
import type { SyncStatus } from "../../utils/progressStore";

const STATUS: Record<SyncStatus, { label: string; title: string }> = {
  loading: { label: "Đang tải…", title: "Đang tải tiến độ đã lưu" },
  synced: { label: "Đã lưu", title: "Tiến độ đã được lưu lên máy chủ" },
  pending: { label: "Đang lưu…", title: "Thay đổi sẽ được lưu lên máy chủ sau vài giây" },
  offline: {
    label: "Chưa lưu được",
    title: "Chưa kết nối được máy chủ: tiến độ vẫn được giữ trên máy này và sẽ được lưu khi có mạng",
  },
  expired: { label: "Hết phiên", title: "Phiên đăng nhập đã hết hạn: hãy đăng nhập lại" },
};

interface UserBarProps {
  username: string;
  /** Saves the last changes and closes the session; this bar is gone afterwards. */
  onLogout: () => Promise<void>;
}

/** The logged-in learner, whether their progress is saved on the server, and logging out. */
export default function UserBar({ username, onLogout }: UserBarProps) {
  const status = useSyncStatus();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = () => {
    setLoggingOut(true);
    void onLogout();
  };

  return (
    <div className="user-bar">
      <span className="user-chip" title={STATUS[status].title}>
        <span className={`sync-dot is-${status}`} aria-hidden="true" />
        <span className="user-name">👤 {username}</span>
        <span className="sync-label">{STATUS[status].label}</span>
      </span>
      <button
        type="button"
        className="btn btn--sm btn--secondary"
        onClick={logout}
        disabled={loggingOut}
        title="Đăng xuất để đổi người học"
      >
        {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
    </div>
  );
}
