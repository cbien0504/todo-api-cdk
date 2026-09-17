declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Get the configured Google Tag Manager Container ID from environment variables.
 * Checks VITE_GTM_ID followed by VITE_GTM_CONTAINER_ID.
 */
export const getGtmId = (): string => {
  return (
    import.meta.env.VITE_GTM_ID ||
    import.meta.env.VITE_GTM_CONTAINER_ID ||
    ""
  );
};

/**
 * Push an arbitrary payload object into the GTM dataLayer array.
 */
export const pushToDataLayer = (payload: Record<string, unknown>): void => {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
};

/**
 * Helper to push standard custom events with parameters to the GTM dataLayer.
 *
 * @param eventName Name of the custom event (e.g. 'todo_create', 'theme_change')
 * @param eventParams Optional dictionary of event parameters
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>
): void => {
  pushToDataLayer({
    event: eventName,
    ...eventParams,
  });
};

/**
 * Initialize Google Tag Manager dynamically at runtime if not already loaded by index.html.
 */
export const initGtm = (customId?: string): void => {
  if (typeof window === "undefined") return;

  const id = customId || getGtmId();
  if (!id || id.indexOf("%") !== -1) return;

  // Prevent duplicate script injection
  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtm.js?id="]`
  );
  if (existingScript) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
};
