import { useEffect, useState } from "react";
import { useProgressStore, useSyncStatus } from "../../hooks/useProgress";
import { trackEvent } from "../../utils/gtm";
import { clearLegacyProgress, readLegacyProgress } from "../../utils/legacyProgress";
import Modal from "../ui/Modal";

interface SessionNoticesProps {
  /** How the learner just entered (not when the app opens already logged in). */
  welcome: "login" | "register" | null;
  /** The server refused the session. */
  onExpired: () => void;
}

/**
 * Around the learner's session: a welcome after logging in or registering, the offer to move the
 * progress this browser saved before logins existed (once the saved progress was downloaded),
 * and going back to the login when the session expired.
 */
export default function SessionNotices({ welcome, onExpired }: SessionNoticesProps) {
  const store = useProgressStore();
  const status = useSyncStatus();
  const [showWelcome, setShowWelcome] = useState(welcome !== null);
  const [legacy, setLegacy] = useState(readLegacyProgress);

  useEffect(() => {
    if (status === "expired") onExpired();
  }, [status, onExpired]);

  const importLegacy = () => {
    if (!legacy) return;
    store.addMissing(legacy.progress);
    clearLegacyProgress();
    setLegacy(null);
    trackEvent("legacy_progress_import", { unremembered: legacy.unremembered, cards: legacy.cards });
  };

  return (
    <>
      {showWelcome && (
        <div className={`card notice ${welcome === "register" ? "tone-success" : "tone-info"}`} role="status">
          <p>
            {welcome === "register" ? (
              <>
                🎉 Đã tạo tài khoản <strong>{store.username}</strong>! Đăng nhập bằng tên và mật khẩu này trên thiết bị khác
                để học tiếp.
              </>
            ) : (
              <>
                👋 Chào mừng trở lại, <strong>{store.username}</strong>!
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--xs"
            onClick={() => setShowWelcome(false)}
            aria-label="Đóng lời chào"
          >
            ✕
          </button>
        </div>
      )}

      {legacy && store.isLoaded() && (
        <Modal
          title="📦 Tiến độ cũ trên trình duyệt này"
          subtitle="Được lưu trước khi có đăng nhập"
          onClose={() => setLegacy(null)}
          footer={
            <>
              <span className="muted">Các từ đã có trong tiến độ của bạn được giữ nguyên.</span>
              <div className="modal-footer-actions">
                <button type="button" className="btn btn--sm btn--secondary" onClick={() => setLegacy(null)}>
                  Để sau
                </button>
                <button type="button" className="btn btn--sm btn--primary" onClick={importLegacy}>
                  📥 Gộp vào tiến độ của {store.username}
                </button>
              </div>
            </>
          }
        >
          <div className="modal-text">
            <p>
              Trình duyệt này còn <strong>{legacy.unremembered} từ chưa nhớ</strong> và{" "}
              <strong>{legacy.cards} thẻ ghi nhớ</strong> từ trước khi có đăng nhập. Gộp chúng vào tiến độ của{" "}
              <strong>{store.username}</strong> để học tiếp?
            </p>
            <p className="muted">
              Sau khi gộp, bản cũ được xoá khỏi trình duyệt để không gộp nhầm vào tiến độ của người khác.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
