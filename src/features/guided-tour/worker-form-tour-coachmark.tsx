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
import { GUIDED_TOUR_TARGET_IDS, MAX_GUIDED_TOUR_TARGET_RETRIES } from './constants';
import {
  measureGuidedTourTarget,
  subscribeGuidedTourTarget,
  type GuidedTourTargetRect,
} from './targets';
import { useWorkersTourStore, type AddWorkerTourStep } from './workers-tour-store';
import type { GuidedTourTargetId } from './constants';
import type { GuidedTourStep } from './types';

const ADD_WORKER_STEP_ORDER: AddWorkerTourStep[] = [
  'name_field',
  'daily_rate_field',
  'save_button',
];
const TOTAL_ADD_WORKER_STEPS = ADD_WORKER_STEP_ORDER.length;

const STEP_META: Record<
  AddWorkerTourStep,
  { targetId: GuidedTourTargetId; messageKey: string; actionLabelKey: string; step: GuidedTourStep }
> = {
  name_field: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_NAME,
    messageKey: 'guided_tour.worker_form.name_field.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'worker_form',
  },
  daily_rate_field: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_DAILY_RATE,
    messageKey: 'guided_tour.worker_form.daily_rate_field.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'worker_form',
  },
  save_button: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKER_FORM_SAVE,
    messageKey: 'guided_tour.worker_form.save_button.message',
    actionLabelKey: 'guided_tour.workersTour.gotIt',
    step: 'worker_form',
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
  const [measureNonce, setMeasureNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const measureTriggerRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = STEP_META[currentStep];
  const currentStepIndex = ADD_WORKER_STEP_ORDER.indexOf(currentStep) + 1;
  const progressLabel = `${currentStepIndex} / ${TOTAL_ADD_WORKER_STEPS}`;

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
    const MAX_RETRIES = MAX_GUIDED_TOUR_TARGET_RETRIES;

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
    };
  }, [isActive, currentStep, meta.targetId, triggerRemeasure, measureNonce]);

  useEffect(() => {
    return () => {
      setRect(null);
    };
  }, []);

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
