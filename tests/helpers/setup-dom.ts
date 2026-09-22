import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom's own localStorage getter comes back undefined in this vitest/jsdom combination
// (a known version mismatch, not something about our code) — swap in a minimal in-memory
// Storage so tests that touch localStorage (e.g. tests/components/token-bridge.test.tsx)
// don't need to special-case it themselves.
if (!window.localStorage) {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });
}
