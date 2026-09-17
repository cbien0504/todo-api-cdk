import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getGtmId, pushToDataLayer, trackEvent, initGtm } from "./gtm";

describe("Google Tag Manager utility (gtm.ts)", () => {
  beforeEach(() => {
    window.dataLayer = [];
    document.querySelectorAll('script[src*="googletagmanager.com"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("pushToDataLayer", () => {
    it("initializes window.dataLayer and pushes the payload", () => {
      delete window.dataLayer;
      expect(window.dataLayer).toBeUndefined();

      pushToDataLayer({ testKey: "testValue" });

      expect(window.dataLayer).toBeDefined();
      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer?.[0]).toEqual({ testKey: "testValue" });
    });

    it("appends to existing dataLayer array", () => {
      window.dataLayer = [{ initial: true }];
      pushToDataLayer({ action: "click" });

      expect(window.dataLayer).toHaveLength(2);
      expect(window.dataLayer?.[1]).toEqual({ action: "click" });
    });
  });

  describe("trackEvent", () => {
    it("pushes custom event with given name and parameters", () => {
      trackEvent("todo_created", { id: "123", title: "Test task" });

      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer?.[0]).toEqual({
        event: "todo_created",
        id: "123",
        title: "Test task",
      });
    });

    it("works without extra parameters", () => {
      trackEvent("app_loaded");

      expect(window.dataLayer).toHaveLength(1);
      expect(window.dataLayer?.[0]).toEqual({
        event: "app_loaded",
      });
    });
  });

  describe("initGtm", () => {
    it("does not inject script when no GTM ID is provided", () => {
      initGtm("");
      const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
      expect(scripts.length).toBe(0);
    });

    it("does not inject script when GTM ID is placeholder '%VITE_GTM_ID%'", () => {
      initGtm("%VITE_GTM_ID%");
      const scripts = document.querySelectorAll('script[src*="googletagmanager.com"]');
      expect(scripts.length).toBe(0);
    });

    it("injects script tag and initializes dataLayer when valid ID is provided", () => {
      initGtm("GTM-TEST123");

      const scripts = document.querySelectorAll<HTMLScriptElement>(
        'script[src*="googletagmanager.com/gtm.js?id=GTM-TEST123"]'
      );
      expect(scripts.length).toBe(1);
      expect(scripts[0].async).toBe(true);

      // Check gtm.start event in dataLayer
      expect(window.dataLayer?.some((entry) => entry.event === "gtm.js")).toBe(true);
    });

    it("does not inject duplicate script tag if already present", () => {
      initGtm("GTM-TEST123");
      initGtm("GTM-TEST123");

      const scripts = document.querySelectorAll(
        'script[src*="googletagmanager.com/gtm.js?id=GTM-TEST123"]'
      );
      expect(scripts.length).toBe(1);
    });
  });

  describe("getGtmId", () => {
    it("returns a string", () => {
      const id = getGtmId();
      expect(typeof id).toBe("string");
    });
  });
});
