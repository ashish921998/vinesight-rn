import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { router, usePathname, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useLanguageStore } from '@/stores';
import { telemetry } from '@/services/telemetry';
import { GuidedTourCoachmark } from './coachmark';
import { GuidedTourCompletionCard } from './completion-card';
import {
  GUIDED_TOUR_TARGET_IDS,
  GUIDED_TOUR_TARGET_RETRY_MS,
  GUIDED_TOUR_TARGET_TIMEOUT_MS,
  MAX_GUIDED_TOUR_TARGET_RETRIES,
} from './constants';
import { guidedTourEmit, guidedTourOn } from './events';
import { GuidedTourOverlay } from './overlay';
import {
  registerGuidedTourPushDevice,
  fetchGuidedTourServerState,
  upsertGuidedTourServerState,
} from './service';
import { useGuidedTourStore } from './store';
import { measureGuidedTourTarget, type GuidedTourTargetRect } from './targets';
import type { GuidedTourStep } from './types';
import { GuidedTourWelcomeCard } from './welcome-card';

function isDashboardRoute(segments: string[]) {
  return segments[0] === '(tabs)' && (!segments[1] || segments[1] === 'index');
}

function isAddFarmHostRoute(pathname: string | null, segments: string[]) {
  return pathname === '/explore' || (segments[0] === '(tabs)' && segments[1] === 'explore');
}

function parseFarmRouteId(pathname: string | null): number | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/farm\/(\d+)$/);
  return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

function isAddFarmFlowRoute(pathname: string | null): boolean {
  return pathname === '/farm/add';
}

function isAddLogFlowRoute(pathname: string | null, segments: string[]): boolean {
  if (pathname === '/log-entry/add' || pathname === '/add-entry') return true;
  return (segments[0] === 'log-entry' && segments[1] === 'add') || segments[0] === 'add-entry';
}

export function GuidedTourController() {
  const pathname = usePathname();
  const segments = useSegments();
  // router singleton is used directly for all navigation (stable across deferred callbacks)
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const needsProfileCompletion = useAuthStore((s) => s.needsProfileCompletion);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const language = useLanguageStore((s) => s.language) ?? 'en';

  const status = useGuidedTourStore((s) => s.status);
  const currentStep = useGuidedTourStore((s) => s.currentStep);
  const hasHydrated = useGuidedTourStore((s) => s.hasHydrated);
  const hasSeenWelcomeThisSession = useGuidedTourStore((s) => s.hasSeenWelcomeThisSession);
  const activeFarmId = useGuidedTourStore((s) => s.activeFarmId);
  const isSuspended = useGuidedTourStore((s) => s.isSuspended);
  const isSeasonFormVisible = useGuidedTourStore((s) => s.isSeasonFormVisible);
  const hasActiveSeasonForCurrentFarm = useGuidedTourStore((s) => s.hasActiveSeasonForCurrentFarm);
  const lastActiveAt = useGuidedTourStore((s) => s.lastActiveAt);
  const remindersSent = useGuidedTourStore((s) => s.remindersSent);
  const startedAt = useGuidedTourStore((s) => s.startedAt);
  const completedAt = useGuidedTourStore((s) => s.completedAt);
  const expiredAt = useGuidedTourStore((s) => s.expiredAt);
  const skippedAtStep = useGuidedTourStore((s) => s.skippedAtStep);

  const applyServerState = useGuidedTourStore((s) => s.applyServerState);
  const toServerPatch = useGuidedTourStore((s) => s.toServerPatch);
  const setLastActiveAt = useGuidedTourStore((s) => s.setLastActiveAt);
  const resumeIfEligible = useGuidedTourStore((s) => s.resumeIfEligible);
  const showStep = useGuidedTourStore((s) => s.showStep);
  const completeStep = useGuidedTourStore((s) => s.completeStep);
  const skipTour = useGuidedTourStore((s) => s.skipTour);
  const startTour = useGuidedTourStore((s) => s.startTour);
  const completeTour = useGuidedTourStore((s) => s.completeTour);
  const [rect, setRect] = useState<GuidedTourTargetRect | null>(null);
  const [activeCoachStep, setActiveCoachStep] = useState<GuidedTourStep | null>(null);
  const [hasChosenActivityType, setHasChosenActivityType] = useState(false);
  const [hasPendingLogDrafts, setHasPendingLogDrafts] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null);
  const [isAddFarmNameFilled, setIsAddFarmNameFilled] = useState(false);
  const [isAddFarmRegionFilled, setIsAddFarmRegionFilled] = useState(false);
  const [isAddFarmAreaFilled, setIsAddFarmAreaFilled] = useState(false);
  const [addFarmPhase, setAddFarmPhase] = useState<
    | 'cta'
    | 'name'
    | 'region'
    | 'area'
    | 'crop'
    | 'crop_option'
    | 'variety'
    | 'variety_option'
    | 'custom_variety'
    | 'submit'
  >('cta');
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownRef = useRef<Set<string>>(new Set());
  const queuedFarmCreatedRef = useRef<number | null>(null);
  const queuedLogCreatedRef = useRef<{ farmId: number; recordType: string } | null>(null);
  const hydrationSyncedRef = useRef(false);
  const mountedRef = useRef(false);
  const addLogRetryCountRef = useRef(0);
  const previousShowEventKeyRef = useRef<string | null>(null);

  const guidedTourEnabled =
    (process.env.EXPO_PUBLIC_GUIDED_TOUR_ENABLED ?? 'false').toLowerCase() === 'true';
  const forceEnable =
    (process.env.EXPO_PUBLIC_GUIDED_TOUR_FORCE_ENABLE ?? 'false').toLowerCase() === 'true';

  const isSupportedLocale = language === 'en' || language === 'hi' || language === 'mr';

  const eligible =
    (guidedTourEnabled || forceEnable) &&
    isAuthenticated &&
    !needsProfileCompletion &&
    hasHydrated &&
    !['complete', 'skipped', 'expired'].includes(status);

  const addLogFlowRoute = isAddLogFlowRoute(pathname, segments);

  const overlayMode = useMemo(() => {
    if (!eligible) return 'none' as const;
    if (isSuspended) return 'none' as const;
    if (status === 'not_started' && isDashboardRoute(segments) && !hasSeenWelcomeThisSession) {
      return 'welcome' as const;
    }
    if (status === 'in_progress' && (currentStep === 'add_farm' || currentStep === 'add_log')) {
      return 'coach' as const;
    }
    if (status === 'in_progress' && currentStep === 'complete_card') {
      return 'complete' as const;
    }
    return 'none' as const;
  }, [currentStep, eligible, hasSeenWelcomeThisSession, isSuspended, segments, status]);

  useEffect(() => {
    if (!isAuthenticated || !hasHydrated || hydrationSyncedRef.current) return;
    hydrationSyncedRef.current = true;
    fetchGuidedTourServerState()
      .then((server) => {
        if (server) applyServerState(server);
      })
      .catch((error) => {
        if (__DEV__) console.warn('[guided-tour] fetch sync failed', error);
      });
  }, [applyServerState, hasHydrated, isAuthenticated, userId]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      hydrationSyncedRef.current = false;
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || !hasHydrated || !isSupportedLocale) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      void upsertGuidedTourServerState(toServerPatch(language)).catch((error) => {
        if (__DEV__) {
          console.warn('[guided-tour] state sync failed', error);
        }
      });
    }, 350);
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [
    isAuthenticated,
    isSupportedLocale,
    language,
    hasHydrated,
    toServerPatch,
    activeFarmId,
    completedAt,
    currentStep,
    expiredAt,
    lastActiveAt,
    remindersSent,
    skippedAtStep,
    startedAt,
    status,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !isSupportedLocale) return;
    void registerGuidedTourPushDevice(language);
  }, [isAuthenticated, isSupportedLocale, language]);

  useEffect(() => {
    if (!eligible) return;
    setLastActiveAt();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setLastActiveAt();
        resumeIfEligible();
      }
    });
    return () => subscription.remove();
  }, [eligible, resumeIfEligible, setLastActiveAt]);

  useEffect(() => {
    mountedRef.current = false;
    requestAnimationFrame(() => {
      mountedRef.current = true;
    });
    return () => {
      mountedRef.current = false;
      queuedFarmCreatedRef.current = null;
      queuedLogCreatedRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unsubFarm = guidedTourOn('guidedTour.farmCreated', ({ farmId }) => {
      setHasChosenActivityType(false);
      setSelectedActivityType(null);
      setAddFarmPhase('cta');
      const current = useGuidedTourStore.getState();
      if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
      queuedFarmCreatedRef.current = farmId;
      queuedLogCreatedRef.current = null;
      telemetry.capture('tour_step_completed', { step: 'add_farm' });
      completeStep('add_farm', { farmId });
      showStep('add_log');
      router.replace(`/farm/${farmId}`);
      queuedFarmCreatedRef.current = null;
    });
    const unsubLogType = guidedTourOn('guidedTour.logTypeSelected', ({ recordType }) => {
      setHasChosenActivityType(true);
      setSelectedActivityType(recordType);
      setRect(null);
      setActiveCoachStep(null);
    });
    const unsubAddLogSelectionState = guidedTourOn(
      'guidedTour.addLogSelectionState',
      ({ hasSelection, hasPendingDrafts, recordType }) => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_log') return;
        setHasChosenActivityType(hasSelection);
        setHasPendingLogDrafts(hasPendingDrafts);
        setSelectedActivityType(hasSelection ? (recordType ?? null) : null);
        setRect(null);
        setActiveCoachStep(null);
      },
    );
    const unsubAddFarmName = guidedTourOn('guidedTour.addFarmNameEntered', ({ isFilled }) => {
      setIsAddFarmNameFilled(isFilled);
    });
    const unsubAddFarmRegion = guidedTourOn('guidedTour.addFarmRegionEntered', ({ isFilled }) => {
      setIsAddFarmRegionFilled(isFilled);
    });
    const unsubAddFarmArea = guidedTourOn('guidedTour.addFarmAreaEntered', ({ isFilled }) => {
      setIsAddFarmAreaFilled(isFilled);
    });
    const unsubAddFarmCrop = guidedTourOn('guidedTour.addFarmCropSelected', ({ shouldAdvance }) => {
      const current = useGuidedTourStore.getState();
      if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
      if (shouldAdvance !== false) {
        setAddFarmPhase((prev) => (prev === 'crop' || prev === 'crop_option' ? 'variety' : prev));
      }
    });
    const unsubAddFarmCropPickerToggled = guidedTourOn(
      'guidedTour.addFarmCropPickerToggled',
      ({ open }) => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
        setAddFarmPhase((prev) => {
          if (open && prev === 'crop') return 'crop_option';
          if (!open && prev === 'crop_option') return 'crop';
          return prev;
        });
      },
    );
    const unsubAddFarmVarietyPickerOpened = guidedTourOn(
      'guidedTour.addFarmVarietyPickerOpened',
      () => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
        setAddFarmPhase((prev) => (prev === 'variety' ? 'variety_option' : prev));
      },
    );
    const unsubAddFarmVariety = guidedTourOn(
      'guidedTour.addFarmVarietySelected',
      ({ isCustom }) => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
        setAddFarmPhase(isCustom ? 'custom_variety' : 'submit');
      },
    );
    const unsubAddFarmCustomVariety = guidedTourOn('guidedTour.addFarmCustomVarietyEntered', () => {
      const current = useGuidedTourStore.getState();
      if (current.status !== 'in_progress' || current.currentStep !== 'add_farm') return;
      setAddFarmPhase('submit');
    });
    const unsubLog = guidedTourOn('guidedTour.logCreated', ({ farmId, recordType }) => {
      setHasChosenActivityType(false);
      setHasPendingLogDrafts(false);
      setSelectedActivityType(null);
      const current = useGuidedTourStore.getState();
      if (current.status !== 'in_progress' || current.currentStep !== 'add_log') return;
      if (current.activeFarmId && current.activeFarmId !== farmId) return;
      queuedLogCreatedRef.current = { farmId, recordType };
      telemetry.capture('tour_step_completed', { step: 'add_log', recordType });
      completeStep('add_log');
      showStep('complete_card');
      setActiveCoachStep(null);
      setRect(null);
      queuedLogCreatedRef.current = null;
    });
    const unsubNotif = guidedTourOn('guidedTour.notificationOpened', ({ sequence }) => {
      const current = useGuidedTourStore.getState();
      telemetry.capture('tour_reminder_opened', { sequence });
      if (current.status === 'in_progress') {
        telemetry.capture('tour_resume', { step: current.currentStep });
      }
    });
    return () => {
      unsubFarm();
      unsubLogType();
      unsubAddLogSelectionState();
      unsubAddFarmName();
      unsubAddFarmRegion();
      unsubAddFarmArea();
      unsubAddFarmCrop();
      unsubAddFarmCropPickerToggled();
      unsubAddFarmVarietyPickerOpened();
      unsubAddFarmVariety();
      unsubAddFarmCustomVariety();
      unsubLog();
      unsubNotif();
    };
  }, [completeStep, showStep]);

  useEffect(() => {
    if (!eligible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCoachStep(null);
      setRect(null);
      return;
    }

    if (overlayMode === 'welcome') {
      if (!shownRef.current.has('welcome')) {
        telemetry.capture('tour_welcome_shown');
        shownRef.current.add('welcome');
      }
      return;
    }

    if (status !== 'in_progress') return;

    if (currentStep === 'add_farm') {
      if (isAddFarmFlowRoute(pathname)) {
        if (addFarmPhase === 'cta') {
          setAddFarmPhase('name');
        }
        return;
      }
      if (!isAddFarmHostRoute(pathname, segments)) {
        router.push('/explore');
        return;
      }
      if (queuedFarmCreatedRef.current) {
        const farmId = queuedFarmCreatedRef.current;
        telemetry.capture('tour_step_completed', { step: 'add_farm', source: 'queued_event' });
        completeStep('add_farm', { farmId });
        showStep('add_log');
        router.replace(`/farm/${farmId}`);
        queuedFarmCreatedRef.current = null;
        setAddFarmPhase('cta');
        return;
      }
    }

    if (currentStep === 'add_log') {
      if (hasActiveSeasonForCurrentFarm === false && !isSeasonFormVisible && !addLogFlowRoute) {
        setRect(null);
        setActiveCoachStep(null);
        return;
      }
      if (addLogFlowRoute || isSeasonFormVisible) {
        return;
      }
      const routeFarmId = parseFarmRouteId(pathname);
      if (!routeFarmId || (activeFarmId && routeFarmId !== activeFarmId)) {
        if (activeFarmId) router.push(`/farm/${activeFarmId}`);
        return;
      }
      if (
        queuedLogCreatedRef.current &&
        (!activeFarmId || queuedLogCreatedRef.current.farmId === activeFarmId)
      ) {
        telemetry.capture('tour_step_completed', {
          step: 'add_log',
          source: 'queued_event',
          recordType: queuedLogCreatedRef.current.recordType,
        });
        completeStep('add_log');
        showStep('complete_card');
        queuedLogCreatedRef.current = null;
        return;
      }
    }
  }, [
    activeFarmId,
    addLogFlowRoute,
    completeStep,
    currentStep,
    eligible,
    hasActiveSeasonForCurrentFarm,
    isSeasonFormVisible,
    overlayMode,
    pathname,
    segments,
    showStep,
    status,
    addFarmPhase,
  ]);

  useEffect(() => {
    if (overlayMode !== 'coach') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      setActiveCoachStep(null);
      return;
    }

    const step = currentStep;
    const routeFarmId = parseFarmRouteId(pathname);
    if (step === 'add_farm' && !isAddFarmHostRoute(pathname, segments)) {
      if (!isAddFarmFlowRoute(pathname)) {
        setRect(null);
        setActiveCoachStep(null);
        return;
      }
    }
    if (
      step === 'add_farm' &&
      isAddFarmFlowRoute(pathname) &&
      addFarmPhase !== 'name' &&
      addFarmPhase !== 'region' &&
      addFarmPhase !== 'area' &&
      addFarmPhase !== 'crop' &&
      addFarmPhase !== 'crop_option' &&
      addFarmPhase !== 'variety' &&
      addFarmPhase !== 'variety_option' &&
      addFarmPhase !== 'custom_variety' &&
      addFarmPhase !== 'submit'
    ) {
      setRect(null);
      setActiveCoachStep(null);
      return;
    }
    if (
      step === 'add_log' &&
      hasActiveSeasonForCurrentFarm === false &&
      !isSeasonFormVisible &&
      !addLogFlowRoute
    ) {
      setRect(null);
      setActiveCoachStep(null);
      return;
    }
    if (
      step === 'add_log' &&
      !isSeasonFormVisible &&
      !addLogFlowRoute &&
      (!routeFarmId || (activeFarmId && routeFarmId !== activeFarmId))
    ) {
      if (!addLogFlowRoute) {
        setRect(null);
        setActiveCoachStep(null);
        return;
      }
    }
    const isSeasonStartPhase = step === 'add_log' && isSeasonFormVisible;
    const isAddLogSavePhase =
      step === 'add_log' && addLogFlowRoute && hasPendingLogDrafts && !isSeasonStartPhase;
    const isAddLogTypeSelectorPhase =
      step === 'add_log' &&
      addLogFlowRoute &&
      !hasPendingLogDrafts &&
      !hasChosenActivityType &&
      !isSeasonStartPhase;
    const isAddLogAddEntryPhase =
      step === 'add_log' &&
      addLogFlowRoute &&
      !hasPendingLogDrafts &&
      hasChosenActivityType &&
      !isSeasonStartPhase;
    const addFarmTargetId = isAddFarmFlowRoute(pathname)
      ? addFarmPhase === 'name'
        ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_NAME
        : addFarmPhase === 'region'
          ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_REGION
          : addFarmPhase === 'area'
            ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_AREA
            : addFarmPhase === 'crop_option'
              ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP_SHEET
              : addFarmPhase === 'variety_option'
                ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_VARIETY_SHEET
                : addFarmPhase === 'variety'
                  ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_VARIETY
                  : addFarmPhase === 'custom_variety'
                    ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_CUSTOM_VARIETY
                    : addFarmPhase === 'crop'
                      ? GUIDED_TOUR_TARGET_IDS.ADD_FARM_CROP
                      : GUIDED_TOUR_TARGET_IDS.ADD_FARM_SUBMIT
      : GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY;
    const targetId =
      step === 'add_farm'
        ? addFarmTargetId
        : isSeasonStartPhase
          ? GUIDED_TOUR_TARGET_IDS.START_SEASON_SHEET
          : isAddLogSavePhase
            ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE
            : isAddLogTypeSelectorPhase
              ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR
              : isAddLogAddEntryPhase
                ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY
                : GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY;
    let cancelled = false;
    const startedAt = Date.now();

    const showEventKey = `step-shown-${step}-${targetId}`;
    const attempt = async () => {
      if (cancelled) return;

      if (step === 'add_log' && previousShowEventKeyRef.current !== showEventKey) {
        addLogRetryCountRef.current = 0;
      }
      previousShowEventKeyRef.current = showEventKey;

      const measured = await measureGuidedTourTarget(targetId);
      if (cancelled) return;
      if (measured) {
        setRect(measured);
        setActiveCoachStep(step);
        if (!shownRef.current.has(showEventKey)) {
          telemetry.capture('tour_step_shown', {
            step,
            ...(isSeasonStartPhase
              ? { phase: 'season_start' }
              : isAddLogSavePhase
                ? { phase: 'save' }
                : isAddLogTypeSelectorPhase
                  ? { phase: 'activity_type' }
                  : isAddLogAddEntryPhase
                    ? { phase: 'add_entry' }
                    : { phase: 'entrypoint' }),
          });
          showStep(step);
          shownRef.current.add(showEventKey);
        }
        if (isSeasonStartPhase) {
          setTimeout(() => {
            void attempt();
          }, GUIDED_TOUR_TARGET_RETRY_MS);
        }
        return;
      }

      if (step === 'add_log' && addLogFlowRoute) {
        // Add-log UI can mount targets with delays (sheet animation, route transitions).
        // Keep retrying instead of dropping guidance for this step, but cap retries.
        if (addLogRetryCountRef.current < MAX_GUIDED_TOUR_TARGET_RETRIES) {
          addLogRetryCountRef.current += 1;
          setTimeout(() => {
            void attempt();
          }, GUIDED_TOUR_TARGET_RETRY_MS);
        } else {
          telemetry.capture('tour_target_missing', {
            step,
            targetId,
            route: pathname,
            reason: 'max_retries_exceeded',
          });
        }
        return;
      }

      if (Date.now() - startedAt >= GUIDED_TOUR_TARGET_TIMEOUT_MS) {
        telemetry.capture('tour_target_missing', { step, targetId, route: pathname });
        if (step === 'add_farm') {
          if (isAddFarmFlowRoute(pathname)) {
            // In add-farm form phases, never auto-complete the whole step because a target
            // may temporarily be off-screen or filtered out (e.g., variety list search).
            if (addFarmPhase === 'crop_option') {
              setAddFarmPhase('crop');
            }
            if (addFarmPhase === 'variety_option') {
              setAddFarmPhase('variety');
            }
          } else {
            completeStep('add_farm');
            showStep('add_log');
          }
        } else if (step === 'add_log' && isSeasonStartPhase) {
          // If the season form CTA cannot be measured, hide the coach-mark and let the user proceed manually.
        } else if (step === 'add_log' && isAddLogTypeSelectorPhase) {
          // Keep add-log step active; target retries are handled above.
        } else if (step === 'add_log' && addLogFlowRoute) {
          // In add-log flow, targets can be dynamic while filling fields.
          // Keep the step active instead of auto-completing.
        } else if (step === 'add_log') {
          completeStep('add_log');
          showStep('complete_card');
        }
        setRect(null);
        setActiveCoachStep(null);
        return;
      }

      setTimeout(() => {
        void attempt();
      }, GUIDED_TOUR_TARGET_RETRY_MS);
    };

    void attempt();

    return () => {
      cancelled = true;
    };
  }, [
    activeFarmId,
    addLogFlowRoute,
    completeStep,
    currentStep,
    hasActiveSeasonForCurrentFarm,
    hasChosenActivityType,
    hasPendingLogDrafts,
    isSeasonFormVisible,
    overlayMode,
    pathname,
    segments,
    showStep,
    addFarmPhase,
  ]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (status === 'in_progress' && currentStep !== 'welcome') {
      const lastActive = lastActiveAt ? Date.parse(lastActiveAt) : NaN;
      if (Number.isFinite(lastActive) && Date.now() - lastActive > 24 * 60 * 60 * 1000) {
        telemetry.capture('tour_abandoned');
      }
    }
  }, [currentStep, lastActiveAt, status]);

  useEffect(() => {
    addLogRetryCountRef.current = 0;
  }, [currentStep]);

  if (overlayMode === 'none') return null;

  const handleSkip = () => {
    const step = overlayMode === 'welcome' ? 'welcome' : currentStep;
    telemetry.capture('tour_skipped', { skippedAtStep: step });
    skipTour(step);
    queuedFarmCreatedRef.current = null;
    queuedLogCreatedRef.current = null;
    addLogRetryCountRef.current = 0;
    setRect(null);
    setActiveCoachStep(null);
    setHasChosenActivityType(false);
    setHasPendingLogDrafts(false);
    setSelectedActivityType(null);
    setIsAddFarmNameFilled(false);
    setIsAddFarmRegionFilled(false);
    setIsAddFarmAreaFilled(false);
    setAddFarmPhase('cta');
  };

  const handleStart = () => {
    telemetry.capture('tour_started');
    queuedFarmCreatedRef.current = null;
    queuedLogCreatedRef.current = null;
    setHasChosenActivityType(false);
    setHasPendingLogDrafts(false);
    setSelectedActivityType(null);
    setIsAddFarmNameFilled(false);
    setIsAddFarmRegionFilled(false);
    setIsAddFarmAreaFilled(false);
    setAddFarmPhase('cta');
    startTour();
    showStep('add_farm');
    router.push('/explore');
  };

  const handleDone = () => {
    telemetry.capture('tour_complete');
    queuedFarmCreatedRef.current = null;
    queuedLogCreatedRef.current = null;
    setHasChosenActivityType(false);
    setHasPendingLogDrafts(false);
    setSelectedActivityType(null);
    setIsAddFarmNameFilled(false);
    setIsAddFarmRegionFilled(false);
    setIsAddFarmAreaFilled(false);
    setAddFarmPhase('cta');
    completeTour();
    setRect(null);
    setActiveCoachStep(null);
  };

  const isAddFarmFormCoach = activeCoachStep === 'add_farm' && isAddFarmFlowRoute(pathname);
  const showAddFarmNextAction =
    isAddFarmFormCoach &&
    (addFarmPhase === 'name' || addFarmPhase === 'region' || addFarmPhase === 'area');
  const showAddFarmCropNextAction = isAddFarmFormCoach && addFarmPhase === 'crop';
  const canAdvanceAddFarmField =
    (addFarmPhase === 'name' && isAddFarmNameFilled) ||
    (addFarmPhase === 'region' && isAddFarmRegionFilled) ||
    (addFarmPhase === 'area' && isAddFarmAreaFilled);
  const showAddFarmBackAction =
    isAddFarmFormCoach &&
    addFarmPhase !== 'name' &&
    addFarmPhase !== 'cta' &&
    addFarmPhase !== 'crop_option';
  const coachSecondaryActionLabel = showAddFarmBackAction
    ? t('common.back', { defaultValue: 'Back' })
    : undefined;
  const coachActionLabel =
    (showAddFarmNextAction && canAdvanceAddFarmField) || showAddFarmCropNextAction
      ? t('common.next', { defaultValue: 'Next' })
      : undefined;
  const coachSecondaryAction = showAddFarmBackAction
    ? () =>
        setAddFarmPhase((prev) => {
          if (prev === 'region') {
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'name' });
            return 'name';
          }
          if (prev === 'area') {
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'region' });
            return 'region';
          }
          if (prev === 'crop') {
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'area' });
            return 'area';
          }
          if (prev === 'crop_option') {
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'area' });
            return 'area';
          }
          if (prev === 'variety' || prev === 'variety_option' || prev === 'custom_variety') {
            return 'crop';
          }
          if (prev === 'submit') {
            return 'variety';
          }
          return prev;
        })
    : undefined;
  const coachAction = showAddFarmNextAction
    ? () =>
        setAddFarmPhase((prev) => {
          if (prev === 'name') {
            if (!isAddFarmNameFilled) {
              guidedTourEmit('guidedTour.addFarmFocusField', { field: 'name' });
              return prev;
            }
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'region' });
            return 'region';
          }
          if (prev === 'region') {
            if (!isAddFarmRegionFilled) {
              guidedTourEmit('guidedTour.addFarmFocusField', { field: 'region' });
              return prev;
            }
            guidedTourEmit('guidedTour.addFarmFocusField', { field: 'area' });
            return 'area';
          }
          if (prev === 'area') {
            if (!isAddFarmAreaFilled) {
              guidedTourEmit('guidedTour.addFarmFocusField', { field: 'area' });
              return prev;
            }
            return 'crop';
          }
          return prev;
        })
    : showAddFarmCropNextAction
      ? () => setAddFarmPhase('variety')
      : undefined;

  return (
    <GuidedTourOverlay>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {overlayMode === 'welcome' ? (
          <GuidedTourWelcomeCard onStart={handleStart} onSkip={handleSkip} />
        ) : null}
        {overlayMode === 'coach' && rect && activeCoachStep ? (
          <GuidedTourCoachmark
            step={activeCoachStep}
            rect={rect}
            onSkip={handleSkip}
            focusPadding={activeCoachStep === 'add_farm' && addFarmPhase === 'variety' ? 10 : 4}
            blockOutsideTouches={
              !(
                (activeCoachStep === 'add_log' && isSeasonFormVisible) ||
                (activeCoachStep === 'add_farm' && isAddFarmFlowRoute(pathname))
              )
            }
            tooltipPlacement={
              (activeCoachStep === 'add_log' && isSeasonFormVisible) ||
              (activeCoachStep === 'add_farm' &&
                (addFarmPhase === 'crop_option' || addFarmPhase === 'variety_option'))
                ? 'top'
                : 'auto'
            }
            tooltipOffsetY={activeCoachStep === 'add_farm' && addFarmPhase === 'crop' ? 16 : 0}
            message={
              activeCoachStep === 'add_log' && addLogFlowRoute && hasPendingLogDrafts
                ? t('guidedTour.step2.addEntryCoach', {
                    defaultValue: 'Great. Tap Save to continue.',
                  })
                : activeCoachStep === 'add_log' && addLogFlowRoute && !hasChosenActivityType
                  ? `${t('guidedTour.step2.pickActivityCoach')}\n${t('guidedTour.step2.pickActivityHelper')}`
                  : activeCoachStep === 'add_log' && addLogFlowRoute && hasChosenActivityType
                    ? t('guidedTour.step2.addEntryCoach', {
                        defaultValue: `Fill the ${String(selectedActivityType ?? 'activity').replace('_', ' ')} details, then tap Add entry.`,
                      })
                    : activeCoachStep === 'add_log' && isSeasonFormVisible
                      ? t('guidedTour.step2.startSeasonCoach')
                      : activeCoachStep === 'add_farm' && isAddFarmFlowRoute(pathname)
                        ? addFarmPhase === 'name'
                          ? t('guidedTour.step1.formNameCoach', {
                              defaultValue: 'Enter your farm name first.',
                            })
                          : addFarmPhase === 'region'
                            ? t('guidedTour.step1.formRegionCoach', {
                                defaultValue: 'Add your farm location (region).',
                              })
                            : addFarmPhase === 'area'
                              ? t('guidedTour.step1.formAreaCoach', {
                                  defaultValue: 'Now enter your farm area in acres.',
                                })
                              : addFarmPhase === 'variety_option'
                                ? t('guidedTour.step1.formVarietyPickCoach', {
                                    defaultValue: 'Pick one variety from the list.',
                                  })
                                : addFarmPhase === 'variety'
                                  ? t('guidedTour.step1.formVarietyCoach', {
                                      defaultValue: 'Select your crop variety.',
                                    })
                                  : addFarmPhase === 'custom_variety'
                                    ? t('guidedTour.step1.formCustomVarietyCoach', {
                                        defaultValue: 'Type your custom variety name.',
                                      })
                                    : addFarmPhase === 'crop' || addFarmPhase === 'crop_option'
                                      ? t('guidedTour.step1.formCropCoach', {
                                          defaultValue: 'Now choose your crop type.',
                                        })
                                      : t('guidedTour.step1.formSubmitCoach', {
                                          defaultValue: 'Great. Tap Create farm to continue.',
                                        })
                        : undefined
            }
            actionLabel={coachActionLabel}
            onAction={coachAction}
            secondaryActionLabel={coachSecondaryActionLabel}
            onSecondaryAction={coachSecondaryAction}
          />
        ) : null}
        {overlayMode === 'complete' ? <GuidedTourCompletionCard onDone={handleDone} /> : null}
      </View>
    </GuidedTourOverlay>
  );
}
