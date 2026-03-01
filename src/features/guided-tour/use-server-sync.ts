import { useEffect, useRef, useState } from 'react';
import { useAuthStore, useLanguageStore } from '@/stores';
import { GUIDED_TOUR_VERSION } from './constants';
import {
  fetchGuidedTourServerState,
  registerGuidedTourPushDevice,
  upsertGuidedTourServerState,
  userHasAnyFarms,
} from './service';
import { useGuidedTourStore } from './store';

/**
 * Handles server-side synchronisation for guided-tour state:
 * user-change detection, initial fetch, debounced upsert and push registration.
 *
 * Returns `true` once the first server hydration has completed.
 */
export function useGuidedTourServerSync(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const language = useLanguageStore((s) => s.language) ?? 'en';

  const hasHydrated = useGuidedTourStore((s) => s.hasHydrated);
  const replayResetPending = useGuidedTourStore((s) => s.replayResetPending);
  const activeFarmId = useGuidedTourStore((s) => s.activeFarmId);
  const completedAt = useGuidedTourStore((s) => s.completedAt);
  const currentStep = useGuidedTourStore((s) => s.currentStep);
  const skippedAtStep = useGuidedTourStore((s) => s.skippedAtStep);
  const status = useGuidedTourStore((s) => s.status);
  const startedAt = useGuidedTourStore((s) => s.startedAt);
  const expiredAt = useGuidedTourStore((s) => s.expiredAt);
  const lastActiveAt = useGuidedTourStore((s) => s.lastActiveAt);

  const applyServerState = useGuidedTourStore((s) => s.applyServerState);
  const toServerPatch = useGuidedTourStore((s) => s.toServerPatch);
  const completeTour = useGuidedTourStore((s) => s.completeTour);
  const resetForReplay = useGuidedTourStore((s) => s.resetForReplay);

  const [initialServerHydrated, setInitialServerHydrated] = useState(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrationSyncedRef = useRef(false);
  const previousUserIdRef = useRef<string | null>(userId ?? null);
  const upsertPromiseRef = useRef<Promise<void> | null>(null);

  const isSupportedLocale = language === 'en' || language === 'hi' || language === 'mr';

  // Reset on user change
  useEffect(() => {
    if (!hasHydrated) return;

    const userIdChanged = userId && userId !== previousUserIdRef.current;
    const authStateChanged = isAuthenticated !== !!previousUserIdRef.current;

    if (userIdChanged || authStateChanged) {
      resetForReplay?.();
      hydrationSyncedRef.current = false;
      previousUserIdRef.current = userId ?? null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialServerHydrated(false);
    }
  }, [hasHydrated, isAuthenticated, resetForReplay, userId]);

  // Fetch server state on auth
  useEffect(() => {
    if (!isAuthenticated || !hasHydrated || hydrationSyncedRef.current) return;
    fetchGuidedTourServerState()
      .then(async (server) => {
        hydrationSyncedRef.current = true;
        if (server) {
          applyServerState(server);
          return;
        }

        const hasAnyFarms = await userHasAnyFarms();
        if (hasAnyFarms) {
          completeTour();
        }
      })
      .catch((error) => {
        if (__DEV__) console.warn('[guided-tour] fetch sync failed', error);
      })
      .finally(() => {
        setInitialServerHydrated(true);
      });
  }, [applyServerState, completeTour, hasHydrated, isAuthenticated, userId]);

  // Debounced upsert to server
  useEffect(() => {
    if (!isAuthenticated || !hasHydrated || !isSupportedLocale || !initialServerHydrated) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      const promise = replayResetPending
        ? upsertGuidedTourServerState({
            tour_status: 'not_started',
            current_step: 'welcome',
            skipped_at_step: null,
            reminders_sent: 0,
            tour_started_at: null,
            tour_completed_at: null,
            tour_expired_at: null,
            last_active_at: new Date().toISOString(),
            active_farm_id: null,
            locale: language === 'hi' || language === 'mr' ? language : 'en',
            tour_version: GUIDED_TOUR_VERSION,
            clear_nullable_fields: true,
          })
        : upsertGuidedTourServerState(toServerPatch(language));

      upsertPromiseRef.current = promise;
      promise
        .catch((error) => {
          if (__DEV__) {
            console.warn('[guided-tour] state sync failed', error);
          }
        })
        .finally(() => {
          if (upsertPromiseRef.current === promise) {
            upsertPromiseRef.current = null;
          }
        });
    }, 350);
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      upsertPromiseRef.current = null;
    };
  }, [
    isAuthenticated,
    isSupportedLocale,
    initialServerHydrated,
    language,
    hasHydrated,
    replayResetPending,
    toServerPatch,
    activeFarmId,
    completedAt,
    currentStep,
    skippedAtStep,
    status,
    startedAt,
    expiredAt,
    lastActiveAt,
  ]);

  // Push device registration
  useEffect(() => {
    if (!isAuthenticated || !isSupportedLocale) return;
    void registerGuidedTourPushDevice(language).catch((error) => {
      if (__DEV__) {
        console.warn('[guided-tour] push registration failed in controller effect', error);
      }
    });
  }, [isAuthenticated, isSupportedLocale, language]);

  return initialServerHydrated;
}
