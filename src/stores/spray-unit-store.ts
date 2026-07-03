import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-product last-used spray unit chip (issue #194).
 *
 * When the farmer picks or types a product they logged before, the unit chip
 * they last used for it becomes the default selection. Keys prefer catalog
 * identity over the (drift-prone) display name; values are chip keys from
 * spray-unit-chips.ts ('g/L', 'kg total', …), validated on read by the form.
 */
interface SprayUnitState {
  /** productKey → chip key, insertion-ordered oldest-first (recency via re-insert). */
  lastUsedChips: Record<string, string>;
  setLastUsedChip: (productKey: string, chipKey: string) => void;
}

/** Local-preference cap — oldest entries drop first. */
const MAX_TRACKED_PRODUCTS = 200;

export function sprayProductKey(
  name: string | null | undefined,
  catalogProductId?: number | null,
): string | null {
  if (catalogProductId != null) return `catalog:${catalogProductId}`;
  const normalized = name?.trim().toLowerCase();
  return normalized ? `name:${normalized}` : null;
}

export const useSprayUnitStore = create<SprayUnitState>()(
  persist(
    (set) => ({
      lastUsedChips: {},
      setLastUsedChip: (productKey, chipKey) =>
        set((state) => {
          const next = { ...state.lastUsedChips };
          // Delete-then-set keeps insertion order meaning "least recently used first".
          delete next[productKey];
          next[productKey] = chipKey;
          const keys = Object.keys(next);
          for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_TRACKED_PRODUCTS))) {
            delete next[stale];
          }
          return { lastUsedChips: next };
        }),
    }),
    {
      name: 'vinesight-spray-unit-prefs',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastUsedChips: state.lastUsedChips }),
    },
  ),
);
