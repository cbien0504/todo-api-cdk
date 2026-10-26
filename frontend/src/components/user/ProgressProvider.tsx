import { useEffect, type ReactNode } from "react";
import { ProgressContext } from "../../hooks/useProgress";
import type { ProgressStore } from "../../utils/progressStore";

interface ProgressProviderProps {
  store: ProgressStore;
  children: ReactNode;
}

/**
 * Gives the learner's progress to the app and syncs it while mounted: changes are sent when the
 * page is hidden (closing the tab, switching apps) and the saved progress is downloaded again when
 * the page comes back or the device is back online.
 */
export default function ProgressProvider({ store, children }: ProgressProviderProps) {
  useEffect(() => {
    store.start();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void store.sync({ keepalive: true });
      else store.refreshIfStale();
    };
    const onOnline = () => void store.refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      store.dispose();
    };
  }, [store]);

  return <ProgressContext.Provider value={store}>{children}</ProgressContext.Provider>;
}
