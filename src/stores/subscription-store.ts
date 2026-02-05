import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ExpoSecureStoreAdapter } from '@/lib/supabase';
import type { Capabilities, PlanId, SubscriptionStatus } from '@/types';

export interface SubscriptionSnapshot {
  planId: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  renewsAt: string | null;
  capabilities: Capabilities;
  updatedAt: string;
}

interface SubscriptionStoreState {
  lastKnown: SubscriptionSnapshot | null;
  setLastKnown: (snapshot: SubscriptionSnapshot) => void;
  clear: () => void;
}

const storage = createJSONStorage(() => ExpoSecureStoreAdapter);

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set) => ({
      lastKnown: null,
      setLastKnown: (snapshot) => set({ lastKnown: snapshot }),
      clear: () => set({ lastKnown: null }),
    }),
    {
      name: 'vinesight-subscription',
      storage,
    },
  ),
);
