/**
 * WorkerFormTourCoachmark
 * 3-step in-context tour for the Add Worker form:
 *   1. Name field  →  2. Daily Rate field  →  3. Save button
 * Fires once on first add (not on edit).
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
import { useWorkersTourStore, type AddWorkerTourStep } from './workers-tour-store';
import type { GuidedTourTargetId } from './constants';

const STEP_META: Record<
  AddWorkerTourStep,
  { targetId: GuidedTourTargetId; messageKey: string; actionLabel: string }
> = {
  name_field: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_NAME,
    messageKey: 'guided_tour.worker_form.name_field.message',
    actionLabel: 'Next',
  },
  daily_rate_field: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_DAILY_RATE,
    messageKey: 'guided_tour.worker_form.daily_rate_field.message',
    actionLabel: 'Next',
  },
  save_button: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_SAVE,
    messageKey: 'guided_tour.worker_form.save_button.message',
    actionLabel: 'Got it!',
  },
};

export function WorkerFormTourCoachmark() {
  const { t } = useTranslation();
  const isActive = useWorkersTourStore((s) => s.isAddWorkerTourActive);
  const currentStep = useWorkersTourStore((s) => s.addWorkerTourStep);
  const advanceStep = useWorkersTourStore((s) => s.advanceAddWorkerStep);
  const skipTour = useWorkersTourStore((s) => s.skipAddWorkerTour);

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

  if (!isActive) return null;
  if (!rect) return null;

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
