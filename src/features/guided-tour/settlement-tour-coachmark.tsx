/**
 * SettlementTourCoachmark
 * 3-step in-context tour for the Settlement modal:
 *   1. Worker picker  →  2. Period selector  →  3. Calculate button
 * Fires once on first settlement open.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GuidedTourCoachmark } from './coachmark';
import { GUIDED_TOUR_TARGET_IDS } from './constants';
import {
  measureGuidedTourTarget,
  subscribeGuidedTourTarget,
  type GuidedTourTargetRect,
} from './targets';
import { useWorkersTourStore, type SettlementTourStep } from './workers-tour-store';
import type { GuidedTourTargetId } from './constants';
import type { GuidedTourStep } from './types';
import { MAX_GUIDED_TOUR_TARGET_RETRIES } from './constants';

const SETTLEMENT_STEP_ORDER: SettlementTourStep[] = [
  'worker_picker',
  'period_selector',
  'calculate_btn',
];
const TOTAL_SETTLEMENT_STEPS = SETTLEMENT_STEP_ORDER.length;

const STEP_META: Record<
  SettlementTourStep,
  { targetId: GuidedTourTargetId; messageKey: string; actionLabelKey: string; step: GuidedTourStep }
> = {
  worker_picker: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_WORKER_PICKER,
    messageKey: 'guided_tour.settlement.worker_picker.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'add_farm',
  },
  period_selector: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_PERIOD_SELECTOR,
    messageKey: 'guided_tour.settlement.period_selector.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'add_farm',
  },
  calculate_btn: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_CALCULATE_BTN,
    messageKey: 'guided_tour.settlement.calculate_btn.message',
    actionLabelKey: 'guided_tour.workersTour.gotIt',
    step: 'add_farm',
  },
};

export function SettlementTourCoachmark() {
  const { t } = useTranslation();
  const isActive = useWorkersTourStore((s) => s.isSettlementTourActive);
  const currentStep = useWorkersTourStore((s) => s.settlementTourStep);
  const advanceStep = useWorkersTourStore((s) => s.advanceSettlementStep);
  const skipTour = useWorkersTourStore((s) => s.skipSettlementTour);

  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [rect, setRect] = useState<GuidedTourTargetRect | null>(null);
  const [measureNonce, setMeasureNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const measureTriggerRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = STEP_META[currentStep];
  const currentStepIndex = SETTLEMENT_STEP_ORDER.indexOf(currentStep) + 1;
  const progressLabel = `${currentStepIndex} / ${TOTAL_SETTLEMENT_STEPS}`;

  const triggerRemeasure = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      measureTriggerRef.current += 1;
      setMeasureNonce((n) => n + 1);
    }, 80);
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    cancelledRef.current = false;
    const targetId = meta.targetId;
    let retryCount = 0;

    const attempt = async () => {
      if (cancelledRef.current) return;
      const measured = await measureGuidedTourTarget(targetId);
      if (cancelledRef.current) return;
      if (measured) {
        setRect(measured);
      } else if (retryCount < MAX_GUIDED_TOUR_TARGET_RETRIES) {
        retryCount += 1;
        retryTimerRef.current = setTimeout(attempt, 250);
      }
    };

    void attempt();
    const unsubscribe = subscribeGuidedTourTarget(targetId, triggerRemeasure);

    return () => {
      cancelledRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      unsubscribe();
      setRect(null);
    };
  }, [isActive, currentStep, meta.targetId, triggerRemeasure, measureNonce]);

  if (!isActive || !rect) return null;

  const SKIP_CHIP_BASE = insets.top + 8;
  const targetBottom = rect.y + rect.height + 12;
  const skipTopOffset =
    targetBottom > SKIP_CHIP_BASE && rect.y < screenHeight * 0.35
      ? targetBottom - SKIP_CHIP_BASE
      : 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GuidedTourCoachmark
        step={meta.step}
        rect={rect}
        targetId={meta.targetId}
        message={t(meta.messageKey)}
        actionLabel={t(meta.actionLabelKey)}
        onAction={advanceStep}
        onSkip={skipTour}
        blockOutsideTouches={false}
        tooltipPlacement="auto"
        skipTopOffset={skipTopOffset}
        hideTapHint
        inlineSkip
        progressLabel={progressLabel}
      />
    </View>
  );
}
