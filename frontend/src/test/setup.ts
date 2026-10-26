import "@testing-library/jest-dom";
import { afterEach, beforeEach, vi } from "vitest";

// There is no server in the tests: the app works offline unless a test serves a fake API (test/fakeApi.ts).
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
});

afterEach(() => {
  vi.unstubAllGlobals();
});
