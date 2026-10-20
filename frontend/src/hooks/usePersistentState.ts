import { useEffect, useState } from "react";

export interface StorageCodec<T> {
  /** Return `undefined` when the stored value is invalid so the fallback is used. */
  parse: (raw: string) => T | undefined;
  serialize: (value: T) => string;
}

export const booleanCodec: StorageCodec<boolean> = {
  parse: (raw) => raw === "true",
  serialize: String,
};

export const enumCodec = <T extends string>(allowed: readonly T[]): StorageCodec<T> => ({
  parse: (raw) => (allowed.includes(raw as T) ? (raw as T) : undefined),
  serialize: (value) => value,
});

export const jsonArrayCodec = <T>(): StorageCodec<T[]> => ({
  parse: (raw) => {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : undefined;
  },
  serialize: (value) => JSON.stringify(value),
});

/**
 * `useState` backed by localStorage. The codec must be a stable reference
 * (declare it at module level) so the value is only written when it changes.
 */
export function usePersistentState<T>(key: string, fallback: T, codec: StorageCodec<T>) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw === null ? undefined : codec.parse(raw);
      if (parsed !== undefined) return parsed;
    } catch (e) {
      console.error(`Failed to load "${key}" from localStorage`, e);
    }
    return fallback;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, codec.serialize(value));
    } catch (e) {
      console.error(`Failed to save "${key}" to localStorage`, e);
    }
  }, [key, value, codec]);

  return [value, setValue] as const;
}
