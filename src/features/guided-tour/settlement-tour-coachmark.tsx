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

const STEP_META: Record<
  SettlementTourStep,
  { targetId: GuidedTourTargetId; messageKey: string; actionLabel: string }
> = {
  worker_picker: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_WORKER_PICKER,
    messageKey: 'guided_tour.settlement.worker_picker.message',
    actionLabel: 'Next',
  },
  period_selector: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_PERIOD_SELECTOR,
    messageKey: 'guided_tour.settlement.period_selector.message',
    actionLabel: 'Next',
  },
  calculate_btn: {
    targetId: GUIDED_TOUR_TARGET_IDS.SETTLEMENT_CALCULATE_BTN,
    messageKey: 'guided_tour.settlement.calculate_btn.message',
    actionLabel: 'Got it!',
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
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = STEP_META[currentStep];

  const triggerRemeasure = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setRect(null), 80);
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    cancelledRef.current = false;
    const targetId = meta.targetId;
    let retryCount = 0;
    const MAX_RETRIES = 20;

    const attempt = async () => {
      if (cancelledRef.current) return;
      const measured = await measureGuidedTourTarget(targetId);
      if (cancelledRef.current) return;
      if (measured) {
        setRect(measured);
      } else if (retryCount < MAX_RETRIES) {
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
  }, [isActive, currentStep, meta.targetId, triggerRemeasure]);

  if (!isActive || !rect) return null;

  const SKIP_CHIP_BASE = insets.top + 8;
  const targetBottom = rect.y + rect.height + 12;
  const skipTopOffset =
    targetBottom > SKIP_CHIP_BASE && rect.y < screenHeight * 0.35
      ? targetBottom - SKIP_CHIP_BASE
      : 0;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <GuidedTourCoachmark
        step="add_farm"
        rect={rect}
        targetId={meta.targetId}
        message={t(meta.messageKey)}
        actionLabel={meta.actionLabel}
        onAction={advanceStep}
        onSkip={skipTour}
        blockOutsideTouches={false}
        tooltipPlacement="auto"
        skipTopOffset={skipTopOffset}
        hideTapHint
        inlineSkip
      />
    </View>
  );
}
