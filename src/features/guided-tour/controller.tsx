import React, { useEffect, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { router, usePathname, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { useProfile } from '@/hooks';
import { telemetry } from '@/services/telemetry';
import { GuidedTourCoachmark } from './coachmark';
import { GuidedTourCompletionCard } from './completion-card';
import { GUIDED_TOUR_TARGET_IDS } from './constants';
import type { GuidedTourTargetId } from './constants';
import { guidedTourEmit } from './events';
import { GuidedTourOverlay } from './overlay';
import { useGuidedTourStore } from './store';
import { useCoachTargetMeasurement } from './use-coach-target';
import { useGuidedTourServerSync } from './use-server-sync';
import { useGuidedTourFormState } from './use-tour-events';
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

function isAddFarmScrollLockedPhase(
  phase:
    | 'cta'
    | 'name'
    | 'region'
    | 'area'
    | 'crop'
    | 'crop_option'
    | 'variety'
    | 'variety_option'
    | 'custom_variety'
    | 'submit',
): boolean {
  return phase === 'name' || phase === 'region' || phase === 'area' || phase === 'custom_variety';
}

function isAddLogFlowRoute(pathname: string | null, segments: string[]): boolean {
  if (pathname === '/log-entry/add' || pathname === '/add-entry' || pathname === '/add-activity') {
    return true;
  }
  return (
    (segments[0] === 'log-entry' && segments[1] === 'add') ||
    segments[0] === 'add-entry' ||
    segments[0] === 'add-activity'
  );
}

export function GuidedTourController() {
  const pathname = usePathname();
  const segments = useSegments();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const needsProfileCompletion = useAuthStore((s) => s.needsProfileCompletion);
  const { data: profile } = useProfile({ enabled: isAuthenticated });

  const status = useGuidedTourStore((s) => s.status);
  const currentStep = useGuidedTourStore((s) => s.currentStep);
  const hasHydrated = useGuidedTourStore((s) => s.hasHydrated);
  const hasSeenWelcomeThisSession = useGuidedTourStore((s) => s.hasSeenWelcomeThisSession);
  const activeFarmId = useGuidedTourStore((s) => s.activeFarmId);
  const isSuspended = useGuidedTourStore((s) => s.isSuspended);
  const isSeasonFormVisible = useGuidedTourStore((s) => s.isSeasonFormVisible);
  const hasActiveSeasonForCurrentFarm = useGuidedTourStore((s) => s.hasActiveSeasonForCurrentFarm);
  const lastActiveAt = useGuidedTourStore((s) => s.lastActiveAt);

  const setLastActiveAt = useGuidedTourStore((s) => s.setLastActiveAt);
  const resumeIfEligible = useGuidedTourStore((s) => s.resumeIfEligible);
  const showStep = useGuidedTourStore((s) => s.showStep);
  const completeStep = useGuidedTourStore((s) => s.completeStep);
  const skipTour = useGuidedTourStore((s) => s.skipTour);
  const startTour = useGuidedTourStore((s) => s.startTour);
  const completeTour = useGuidedTourStore((s) => s.completeTour);

  // --- Extracted hooks ---
  const initialServerHydrated = useGuidedTourServerSync();

  const clearOverlayRef = useRef<() => void>(() => {});
  const formState = useGuidedTourFormState(clearOverlayRef);
  const {
    addFarmPhase,
    setAddFarmPhase,
    isAddFarmNameFilled,
    isAddFarmRegionFilled,
    isAddFarmAreaFilled,
    hasChosenActivityType,
    hasPendingLogDrafts,
    selectedActivityType,
    isCurrentLogValid,
    hasConfirmedLogInput,
    setHasConfirmedLogInput,
    seasonFormPhase,
    queuedFarmCreatedRef,
    queuedLogCreatedRef,
    resetFormState,
  } = formState;

  const eligible =
    isAuthenticated &&
    !needsProfileCompletion &&
    hasHydrated &&
    initialServerHydrated &&
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

  const { rect, activeCoachStep, activeTargetId, clearOverlay } = useCoachTargetMeasurement({
    overlayMode,
    eligible,
    pathname,
    segments,
    addLogFlowRoute,
    addFarmPhase,
    hasChosenActivityType,
    hasPendingLogDrafts,
    hasConfirmedLogInput,
    isCurrentLogValid,
    selectedActivityType,
    seasonFormPhase,
  });

  useEffect(() => {
    clearOverlayRef.current = clearOverlay;
  }, [clearOverlay]);

  // AppState listener
  useEffect(() => {
    if (!eligible || !initialServerHydrated) return;
    setLastActiveAt();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setLastActiveAt();
        resumeIfEligible();
      }
    });
    return () => subscription.remove();
  }, [eligible, resumeIfEligible, setLastActiveAt, initialServerHydrated]);

  // Mount / unmount cleanup
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queuedFarmCreatedRef.current = null;
      queuedLogCreatedRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Route guard: ensure user is on the correct route for the current step
  useEffect(() => {
    if (!eligible) return;
    if (overlayMode === 'welcome') return;
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
        activeFarmId &&
        queuedLogCreatedRef.current.farmId === activeFarmId
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
    setAddFarmPhase,
    queuedFarmCreatedRef,
    queuedLogCreatedRef,
  ]);

  // Abandoned tour detection
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
    if (status !== 'in_progress' || currentStep !== 'add_farm' || !isAddFarmFlowRoute(pathname)) {
      return;
    }

    const isCoachMode = overlayMode === 'coach';
    const focusField =
      isCoachMode &&
      (addFarmPhase === 'name' || addFarmPhase === 'region' || addFarmPhase === 'area')
        ? addFarmPhase
        : undefined;
    guidedTourEmit('guidedTour.addFarmPhaseChanged', {
      phase: addFarmPhase,
      lockScroll: isCoachMode && isAddFarmScrollLockedPhase(addFarmPhase),
      focusField,
    });
  }, [addFarmPhase, currentStep, overlayMode, pathname, status]);

  if (overlayMode === 'none') return null;

  const handleSkip = () => {
    const step = overlayMode === 'welcome' ? 'welcome' : currentStep;
    telemetry.capture('tour_skipped', { skippedAtStep: step });
    skipTour(step);
    resetFormState({ clearOverlay: true });
  };

  const handleStart = () => {
    telemetry.capture('tour_started');
    resetFormState();
    startTour();
    showStep('add_farm');
    router.push('/explore');
  };

  const handleDone = () => {
    telemetry.capture('tour_complete');
    resetFormState({ clearOverlay: true });
    completeTour();
  };

  const isAddFarmFormCoach = activeCoachStep === 'add_farm' && isAddFarmFlowRoute(pathname);
  const addLogDetailsTargetId: GuidedTourTargetId = (() => {
    if (selectedActivityType === 'irrigation') {
      return GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION;
    }
    if (selectedActivityType === 'spray') {
      return GUIDED_TOUR_TARGET_IDS.ADD_LOG_SPRAY_DETAILS;
    }
    if (selectedActivityType === 'harvest') {
      return GUIDED_TOUR_TARGET_IDS.ADD_LOG_HARVEST_DETAILS;
    }
    if (selectedActivityType === 'expense') {
      return GUIDED_TOUR_TARGET_IDS.ADD_LOG_EXPENSE_DETAILS;
    }
    if (selectedActivityType === 'fertigation') {
      return GUIDED_TOUR_TARGET_IDS.ADD_LOG_FERTIGATION_DETAILS;
    }
    return GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY;
  })();
  const showAddFarmNextAction =
    isAddFarmFormCoach &&
    (addFarmPhase === 'name' || addFarmPhase === 'region' || addFarmPhase === 'area');
  const showAddFarmCropNextAction = isAddFarmFormCoach && addFarmPhase === 'crop';
  const showAddLogDetailsNextAction =
    activeCoachStep === 'add_log' &&
    addLogFlowRoute &&
    (activeTargetId === addLogDetailsTargetId ||
      activeTargetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY) &&
    !hasPendingLogDrafts &&
    hasChosenActivityType &&
    !hasConfirmedLogInput;
  const canAdvanceAddFarmField =
    (addFarmPhase === 'name' && isAddFarmNameFilled) ||
    (addFarmPhase === 'region' && isAddFarmRegionFilled) ||
    (addFarmPhase === 'area' && isAddFarmAreaFilled);
  const showAddFarmBackAction =
    isAddFarmFormCoach &&
    addFarmPhase !== 'name' &&
    addFarmPhase !== 'cta' &&
    addFarmPhase !== 'crop_option';
  const showAddLogBackAction =
    activeCoachStep === 'add_log' &&
    addLogFlowRoute &&
    activeTargetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY &&
    !hasPendingLogDrafts &&
    hasChosenActivityType &&
    hasConfirmedLogInput;
  const coachSecondaryActionLabel =
    showAddFarmBackAction || showAddLogBackAction
      ? t('common.back', { defaultValue: 'Back' })
      : undefined;
  const coachActionLabel =
    (showAddFarmNextAction && canAdvanceAddFarmField) ||
    showAddFarmCropNextAction ||
    (showAddLogDetailsNextAction && isCurrentLogValid)
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
    : showAddLogBackAction
      ? () => setHasConfirmedLogInput(false)
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
      : showAddLogDetailsNextAction && isCurrentLogValid
        ? () => setHasConfirmedLogInput(true)
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
            targetId={activeTargetId}
            onSkip={handleSkip}
            focusPadding={activeCoachStep === 'add_farm' && addFarmPhase === 'variety' ? 10 : 4}
            blockOutsideTouches={
              !(
                (activeCoachStep === 'add_log' && isSeasonFormVisible) ||
                (activeCoachStep === 'add_log' && addLogFlowRoute)
              )
            }
            tooltipPlacement={
              (activeCoachStep === 'add_log' && isSeasonFormVisible) ||
              (activeCoachStep === 'add_farm' && addFarmPhase === 'area') ||
              (activeCoachStep === 'add_farm' &&
                (addFarmPhase === 'crop_option' || addFarmPhase === 'variety_option')) ||
              (activeCoachStep === 'add_log' &&
                addLogFlowRoute &&
                hasChosenActivityType &&
                !hasPendingLogDrafts)
                ? 'top'
                : 'auto'
            }
            tooltipOffsetY={
              activeCoachStep === 'add_log' && isSeasonFormVisible
                ? 92
                : activeCoachStep === 'add_farm' && addFarmPhase === 'crop'
                  ? 16
                  : 0
            }
            message={
              activeCoachStep === 'add_log' &&
              addLogFlowRoute &&
              activeTargetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE
                ? t('guidedTour.step2.tapSaveCoach', {
                    defaultValue: 'Great. Tap Save to continue.',
                  })
                : activeCoachStep === 'add_log' &&
                    addLogFlowRoute &&
                    activeTargetId === GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR
                  ? `${t('guidedTour.step2.pickActivityCoach')}\n${t('guidedTour.step2.pickActivityHelper')}`
                  : activeCoachStep === 'add_log' &&
                      addLogFlowRoute &&
                      activeTargetId !== GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR &&
                      activeTargetId !== GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE &&
                      activeTargetId !== GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY
                    ? hasConfirmedLogInput
                      ? t('guidedTour.step2.addEntryCoach', {
                          activity: String(selectedActivityType ?? 'activity').replace('_', ' '),
                          defaultValue: `Great. Tap Add entry to continue.`,
                        })
                      : t('guidedTour.step2.fillActivityDetailsCoach', {
                          defaultValue: `Fill the ${String(selectedActivityType ?? 'activity').replace('_', ' ')} details, then tap Next.`,
                        })
                    : activeCoachStep === 'add_log' && isSeasonFormVisible
                      ? t('guidedTour.step2.startSeasonSimpleCoach', {
                          defaultValue: 'Select both dates, then tap Start season to continue.',
                        })
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
                                  areaUnit: t(
                                    `units.${profile?.area_unit_preference === 'hectares' ? 'hectares' : 'acres'}`,
                                  ),
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
            hideTapHint={activeCoachStep === 'add_log' && isSeasonFormVisible}
            compact={activeCoachStep === 'add_log' && isSeasonFormVisible}
            hidePointer={activeCoachStep === 'add_log' && isSeasonFormVisible}
            hideBubble={activeCoachStep === 'add_log' && isSeasonFormVisible}
            hideFocus={activeCoachStep === 'add_log' && isSeasonFormVisible}
            hideDimming={activeCoachStep === 'add_log' && isSeasonFormVisible}
          />
        ) : null}
        {overlayMode === 'complete' ? <GuidedTourCompletionCard onDone={handleDone} /> : null}
      </View>
    </GuidedTourOverlay>
  );
}
