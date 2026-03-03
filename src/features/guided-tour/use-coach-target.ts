import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';
import { telemetry } from '@/services/telemetry';
import {
  GUIDED_TOUR_TARGET_IDS,
  GUIDED_TOUR_TARGET_RETRY_MS,
  GUIDED_TOUR_TARGET_TIMEOUT_MS,
  MAX_GUIDED_TOUR_TARGET_RETRIES,
} from './constants';
import type { GuidedTourTargetId } from './constants';
import { useGuidedTourStore } from './store';
import {
  measureGuidedTourTarget,
  subscribeGuidedTourTarget,
  type GuidedTourTargetRect,
} from './targets';
import type { GuidedTourStep } from './types';
import type { AddFarmPhase, SeasonFormPhase } from './use-tour-events';

const MAX_SEASON_START_RETRIES = 20;
const REACTIVE_REMEASURE_DEBOUNCE_MS = 70;
function isAddFarmFlowRoute(pathname: string | null): boolean {
  return pathname === '/farm/add';
}

function isAddFarmHostRoute(pathname: string | null, segments: string[]) {
  return pathname === '/explore' || (segments[0] === '(tabs)' && segments[1] === 'explore');
}

interface CoachTargetParams {
  overlayMode: 'none' | 'welcome' | 'coach' | 'complete';
  eligible: boolean;
  pathname: string;
  segments: string[];
  addLogFlowRoute: boolean;
  addFarmPhase: AddFarmPhase;
  hasChosenActivityType: boolean;
  hasPendingLogDrafts: boolean;
  hasConfirmedLogInput: boolean;
  isCurrentLogValid: boolean;
  selectedActivityType: string | null;
  seasonFormPhase: SeasonFormPhase;
}

interface CoachTargetResult {
  rect: GuidedTourTargetRect | null;
  activeCoachStep: GuidedTourStep | null;
  activeTargetId: GuidedTourTargetId | null;
  clearOverlay: () => void;
}

/**
 * Resolves the correct target element for the current tour step / phase,
 * measures its position on screen, and re-measures with retries until the
 * target is found or a timeout elapses.
 */
export function useCoachTargetMeasurement(params: CoachTargetParams): CoachTargetResult {
  const {
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
  } = params;

  const currentStep = useGuidedTourStore((s) => s.currentStep);
  const activeFarmId = useGuidedTourStore((s) => s.activeFarmId);
  const hasActiveSeasonForCurrentFarm = useGuidedTourStore((s) => s.hasActiveSeasonForCurrentFarm);
  const isSeasonFormVisible = useGuidedTourStore((s) => s.isSeasonFormVisible);
  const completeStep = useGuidedTourStore((s) => s.completeStep);
  const showStep = useGuidedTourStore((s) => s.showStep);

  const [rect, setRect] = useState<GuidedTourTargetRect | null>(null);
  const [activeCoachStep, setActiveCoachStep] = useState<GuidedTourStep | null>(null);
  const [activeTargetId, setActiveTargetId] = useState<GuidedTourTargetId | null>(null);
  const [measureTrigger, setMeasureTrigger] = useState(0);
  const activeTargetIdRef = useRef<GuidedTourTargetId | null>(null);

  const shownRef = useRef<Set<string>>(new Set());
  const addLogRetryCountRef = useRef(0);
  const previousShowEventKeyRef = useRef<string | null>(null);
  const measureRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueMeasureRefresh = useCallback(() => {
    if (measureRefreshTimerRef.current) {
      clearTimeout(measureRefreshTimerRef.current);
    }
    measureRefreshTimerRef.current = setTimeout(() => {
      setMeasureTrigger((prev) => prev + 1);
    }, REACTIVE_REMEASURE_DEBOUNCE_MS);
  }, []);

  const updateActiveTargetId = useCallback((nextTargetId: GuidedTourTargetId | null) => {
    activeTargetIdRef.current = nextTargetId;
    setActiveTargetId(nextTargetId);
  }, []);

  const clearOverlay = useCallback(() => {
    setRect(null);
    setActiveCoachStep(null);
    updateActiveTargetId(null);
    addLogRetryCountRef.current = 0;
  }, [updateActiveTargetId]);

  // Reset when eligibility changes
  useEffect(() => {
    if (!eligible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      setActiveCoachStep(null);
      updateActiveTargetId(null);
    }
  }, [eligible, updateActiveTargetId]);

  // Welcome telemetry (fired once per session)
  useEffect(() => {
    if (overlayMode === 'welcome' && !shownRef.current.has('welcome')) {
      telemetry.capture('tour_welcome_shown');
      shownRef.current.add('welcome');
    }
  }, [overlayMode]);

  // Reset retry counter when step changes
  useEffect(() => {
    addLogRetryCountRef.current = 0;
  }, [currentStep]);

  useEffect(() => {
    return () => {
      if (measureRefreshTimerRef.current) {
        clearTimeout(measureRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (overlayMode !== 'coach') return;
    const handleViewportChange = () => queueMeasureRefresh();
    const keyboardShowSub = Keyboard.addListener('keyboardDidShow', handleViewportChange);
    const keyboardHideSub = Keyboard.addListener('keyboardDidHide', handleViewportChange);
    const keyboardFrameSub = Keyboard.addListener('keyboardDidChangeFrame', handleViewportChange);
    const dimensionsSub = Dimensions.addEventListener('change', handleViewportChange);
    return () => {
      keyboardShowSub.remove();
      keyboardHideSub.remove();
      keyboardFrameSub.remove();
      dimensionsSub.remove();
    };
  }, [overlayMode, queueMeasureRefresh]);

  // Main measurement loop
  useEffect(() => {
    if (overlayMode !== 'coach') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRect(null);
      setActiveCoachStep(null);
      updateActiveTargetId(null);
      return;
    }

    const step = currentStep;

    // Guard: wrong route for add_farm
    if (step === 'add_farm' && !isAddFarmHostRoute(pathname, segments)) {
      if (!isAddFarmFlowRoute(pathname)) {
        setRect(null);
        setActiveCoachStep(null);
        updateActiveTargetId(null);
        return;
      }
    }

    // Guard: add_farm in form but no valid phase
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
      updateActiveTargetId(null);
      return;
    }

    // Guard: add_log waiting for season
    if (
      step === 'add_log' &&
      hasActiveSeasonForCurrentFarm === false &&
      !isSeasonFormVisible &&
      !addLogFlowRoute
    ) {
      setRect(null);
      setActiveCoachStep(null);
      updateActiveTargetId(null);
      return;
    }

    // Guard: add_log wrong farm route
    const parseFarmRouteId = (p: string | null): number | null => {
      if (!p) return null;
      const match = p.match(/^\/farm\/(\d+)$/);
      return match ? Number.parseInt(match[1] ?? '', 10) : null;
    };
    const routeFarmId = parseFarmRouteId(pathname);
    if (
      step === 'add_log' &&
      !isSeasonFormVisible &&
      !addLogFlowRoute &&
      (!routeFarmId || (activeFarmId && routeFarmId !== activeFarmId))
    ) {
      if (!addLogFlowRoute) {
        setRect(null);
        setActiveCoachStep(null);
        updateActiveTargetId(null);
        return;
      }
    }

    // Compute phase booleans
    const isSeasonStartPhase = step === 'add_log' && isSeasonFormVisible;
    const isAddLogSavePhase =
      step === 'add_log' && addLogFlowRoute && hasPendingLogDrafts && !isSeasonStartPhase;
    const isAddLogTypeSelectorPhase =
      step === 'add_log' &&
      addLogFlowRoute &&
      !hasPendingLogDrafts &&
      !hasChosenActivityType &&
      !isSeasonStartPhase;
    const isAddLogDetailsPhase =
      step === 'add_log' &&
      addLogFlowRoute &&
      !hasPendingLogDrafts &&
      hasChosenActivityType &&
      (!isCurrentLogValid || !hasConfirmedLogInput) &&
      !isSeasonStartPhase;
    const isAddLogAddEntryPhase =
      step === 'add_log' &&
      addLogFlowRoute &&
      !hasPendingLogDrafts &&
      hasChosenActivityType &&
      isCurrentLogValid &&
      hasConfirmedLogInput &&
      !isSeasonStartPhase;

    // Resolve target id
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
          ? GUIDED_TOUR_TARGET_IDS.START_SEASON_PRIMARY
          : isAddLogSavePhase
            ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE
            : isAddLogTypeSelectorPhase
              ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR
              : isAddLogDetailsPhase
                ? selectedActivityType === 'irrigation'
                  ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION
                  : selectedActivityType === 'spray'
                    ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_SPRAY_DETAILS
                    : selectedActivityType === 'harvest'
                      ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_HARVEST_DETAILS
                      : selectedActivityType === 'expense'
                        ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_EXPENSE_DETAILS
                        : selectedActivityType === 'fertigation'
                          ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_FERTIGATION_DETAILS
                          : GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY
                : isAddLogAddEntryPhase
                  ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY
                  : GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY;

    const targetCandidates: GuidedTourTargetId[] = isSeasonStartPhase
      ? [GUIDED_TOUR_TARGET_IDS.START_SEASON_PRIMARY]
      : step === 'add_log' && addLogFlowRoute && !isSeasonStartPhase
        ? hasPendingLogDrafts
          ? [GUIDED_TOUR_TARGET_IDS.ADD_LOG_SAVE]
          : isAddLogDetailsPhase
            ? [
                targetId,
                GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY,
                GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY,
              ]
            : [
                GUIDED_TOUR_TARGET_IDS.ADD_LOG_TYPE_SELECTOR,
                GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY,
                GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY,
              ]
        : [targetId];

    const unsubscribeTargets = targetCandidates.map((candidate) =>
      subscribeGuidedTourTarget(candidate, queueMeasureRefresh),
    );

    if (activeTargetIdRef.current && activeTargetIdRef.current !== targetId) {
      setRect(null);
      updateActiveTargetId(null);
    }

    let cancelled = false;
    let seasonStartRetryCount = 0;
    let seasonStartRetryTimer: ReturnType<typeof setTimeout> | null = null;
    const measureStartedAt = Date.now();

    const showPhaseKey = isSeasonStartPhase
      ? `season_${seasonFormPhase}`
      : isAddLogSavePhase
        ? 'save'
        : isAddLogTypeSelectorPhase
          ? 'activity_type'
          : isAddLogDetailsPhase
            ? 'details'
            : isAddLogAddEntryPhase
              ? 'add_entry'
              : 'entrypoint';
    const showEventKey = `step-shown-${pathname}-${step}-${targetId}-${showPhaseKey}`;
    const attempt = async () => {
      if (cancelled) return;

      if (step === 'add_log' && previousShowEventKeyRef.current !== showEventKey) {
        addLogRetryCountRef.current = 0;
      }
      previousShowEventKeyRef.current = showEventKey;

      if (targetCandidates.length === 0) return;

      let measured: GuidedTourTargetRect | null = null;
      let measuredTargetId: GuidedTourTargetId = targetCandidates[0];
      for (const candidate of targetCandidates) {
        measured = await measureGuidedTourTarget(candidate);
        if (measured) {
          measuredTargetId = candidate;
          break;
        }
      }
      if (cancelled) return;
      if (measured) {
        const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');
        const isInViewport =
          measured.x < viewportWidth &&
          measured.y < viewportHeight &&
          measured.x + measured.width > 0 &&
          measured.y + measured.height > 0;
        if (!isInViewport) {
          telemetry.capture('tour_target_rect_invalid', {
            step,
            targetId: measuredTargetId,
            route: pathname,
          });
        }
        if (measuredTargetId !== targetId) {
          telemetry.capture('tour_target_candidate_switched', {
            step,
            route: pathname,
            expectedTargetId: targetId,
            measuredTargetId,
          });
        }
        setRect(measured);
        setActiveCoachStep(step);
        updateActiveTargetId(measuredTargetId);
        telemetry.capture('tour_target_remeasured', {
          step,
          route: pathname,
          targetId: measuredTargetId,
          trigger: measureTrigger,
        });
        if (!shownRef.current.has(showEventKey)) {
          telemetry.capture('tour_step_shown', {
            step,
            ...(isSeasonStartPhase
              ? { phase: `season_${seasonFormPhase}` }
              : isAddLogSavePhase
                ? { phase: 'save' }
                : isAddLogTypeSelectorPhase
                  ? { phase: 'activity_type' }
                  : isAddLogDetailsPhase
                    ? { phase: 'details' }
                    : isAddLogAddEntryPhase
                      ? { phase: 'add_entry' }
                      : { phase: 'entrypoint' }),
          });
          showStep(step);
          shownRef.current.add(showEventKey);
        }
        if (isSeasonStartPhase && seasonStartRetryCount < MAX_SEASON_START_RETRIES) {
          seasonStartRetryCount += 1;
          seasonStartRetryTimer = setTimeout(() => {
            if (cancelled) return;
            void attempt();
          }, GUIDED_TOUR_TARGET_RETRY_MS);
        }
        return;
      }

      if (step === 'add_log' && addLogFlowRoute) {
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
            target_candidates: targetCandidates,
          });
          setRect(null);
          setActiveCoachStep(null);
          updateActiveTargetId(null);
        }
        return;
      }

      if (Date.now() - measureStartedAt >= GUIDED_TOUR_TARGET_TIMEOUT_MS) {
        telemetry.capture('tour_target_missing', {
          step,
          targetId,
          route: pathname,
          target_candidates: targetCandidates,
        });
        if (step === 'add_farm') {
          if (isAddFarmFlowRoute(pathname)) {
            if (addFarmPhase === 'crop_option') {
              // intentionally empty - crop_option phase handled elsewhere
            }
            if (addFarmPhase === 'variety_option') {
              // intentionally empty - variety_option phase handled elsewhere
            }
          } else {
            completeStep('add_farm');
            showStep('add_log');
          }
        } else if (step === 'add_log' && isSeasonStartPhase) {
          // Season form CTA cannot be measured — let user proceed manually.
        } else if (step === 'add_log' && isAddLogTypeSelectorPhase) {
          // Keep add-log step active; target retries are handled above.
        } else if (step === 'add_log' && addLogFlowRoute) {
          // In add-log flow, targets can be dynamic while filling fields.
        } else if (step === 'add_log') {
          completeStep('add_log');
          showStep('complete_card');
        }
        setRect(null);
        setActiveCoachStep(null);
        updateActiveTargetId(null);
        return;
      }

      setTimeout(() => {
        void attempt();
      }, GUIDED_TOUR_TARGET_RETRY_MS);
    };

    void attempt();

    return () => {
      cancelled = true;
      if (seasonStartRetryTimer) {
        clearTimeout(seasonStartRetryTimer);
      }
      for (const unsubscribe of unsubscribeTargets) {
        unsubscribe();
      }
    };
  }, [
    activeFarmId,
    addLogFlowRoute,
    completeStep,
    currentStep,
    hasActiveSeasonForCurrentFarm,
    hasChosenActivityType,
    hasPendingLogDrafts,
    hasConfirmedLogInput,
    isCurrentLogValid,
    isSeasonFormVisible,
    overlayMode,
    pathname,
    queueMeasureRefresh,
    selectedActivityType,
    seasonFormPhase,
    segments,
    showStep,
    addFarmPhase,
    measureTrigger,
    updateActiveTargetId,
  ]);

  return { rect, activeCoachStep, activeTargetId, clearOverlay };
}
