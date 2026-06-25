import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GuidedTourCoachmark } from './coachmark';
import { GUIDED_TOUR_TARGET_IDS, MAX_GUIDED_TOUR_TARGET_RETRIES } from './constants';
import {
  measureGuidedTourTarget,
  subscribeGuidedTourTarget,
  type GuidedTourTargetRect,
} from './targets';
import { useWorkersTourStore, type WorkersTourStep } from './workers-tour-store';
import type { GuidedTourStep } from './types';
import type { GuidedTourTargetId } from './constants';
import { colorWithOpacity } from '@/utils/color';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';

function AttendanceLegend() {
  const { t } = useTranslation();
  const attendanceStates = [
    {
      label: t('guided_tour.workersTour.legend.fullDay'),
      dot: '#4ADE80',
      bg: 'rgba(74,222,128,0.18)',
      tap: t('guided_tour.workersTour.legend.tap1'),
    },
    {
      label: t('guided_tour.workersTour.legend.halfDay'),
      dot: '#FBBF24',
      bg: 'rgba(251,191,36,0.18)',
      tap: t('guided_tour.workersTour.legend.tap2'),
    },
    {
      label: t('guided_tour.workersTour.legend.absent'),
      dot: '#F87171',
      bg: 'rgba(248,113,113,0.18)',
      tap: t('guided_tour.workersTour.legend.tap3'),
    },
  ];

  return (
    <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
      {/* Tap instruction row */}
      <Text
        style={{
          color: colorWithOpacity('#FFFFFF', 0.8),
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          marginBottom: spacing[1],
        }}
      >
        {t('guided_tour.workersTour.cyclesThrough')}
      </Text>

      {/* State badges */}
      {attendanceStates.map((s) => (
        <View
          key={s.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[3],
          }}
        >
          {/* Tap count chip */}
          <View
            style={{
              backgroundColor: colorWithOpacity('#FFFFFF', 0.14),
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
              minWidth: 56,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colorWithOpacity('#FFFFFF', 0.7),
                fontSize: fontSize.xs,
                fontWeight: fontWeight.medium,
              }}
            >
              {s.tap}
            </Text>
          </View>

          {/* Coloured dot */}
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: radius.xs,
              backgroundColor: s.dot,
            }}
          />

          {/* State badge */}
          <View
            style={{
              flex: 1,
              backgroundColor: s.bg,
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
              }}
            >
              {s.label}
            </Text>
          </View>
        </View>
      ))}

      {/* Clear note */}
      <Text
        style={{
          color: colorWithOpacity('#FFFFFF', 0.55),
          fontSize: fontSize.xs,
          marginTop: spacing[1],
        }}
      >
        {t('guided_tour.workersTour.legend.tap4')}
      </Text>
    </View>
  );
}

// ─── Step metadata ────────────────────────────────────────────────────────────
const STEP_ORDER: WorkersTourStep[] = ['tabs_overview', 'add_worker', 'attendance_tab', 'mark_day'];
const TOTAL_STEPS = STEP_ORDER.length;

const STEP_META: Record<
  WorkersTourStep,
  {
    targetId: GuidedTourTargetId;
    messageKey: string;
    actionLabelKey: string;
    step: GuidedTourStep;
    messageNode?: React.ReactNode;
  }
> = {
  tabs_overview: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKERS_TAB_SELECTOR,
    messageKey: 'guided_tour.workers.tabs_overview.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'tabs_overview',
  },
  add_worker: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKERS_FAB,
    messageKey: 'guided_tour.workers.add_worker.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'add_worker',
  },
  attendance_tab: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKERS_ATTENDANCE_TAB,
    messageKey: 'guided_tour.workers.attendance_tab.message',
    actionLabelKey: 'guided_tour.workersTour.next',
    step: 'attendance_tab',
  },
  mark_day: {
    targetId: GUIDED_TOUR_TARGET_IDS.WORKERS_MARK_DAY_CELL,
    messageKey: 'guided_tour.workers.mark_day.message',
    actionLabelKey: 'guided_tour.workersTour.gotIt',
    step: 'mark_day',
    messageNode: <AttendanceLegend />,
  },
};

const REMEASURE_DEBOUNCE_MS = 80;

interface WorkersTourCoachmarkProps {
  /** Called when the tour wants to navigate to the attendance tab */
  onNavigateToAttendance?: () => void;
}

export function WorkersTourCoachmark({ onNavigateToAttendance }: WorkersTourCoachmarkProps) {
  const { t } = useTranslation();
  const isActive = useWorkersTourStore((s) => s.isActive);
  const currentStep = useWorkersTourStore((s) => s.currentStep);
  const advanceStep = useWorkersTourStore((s) => s.advanceStep);
  const skipTour = useWorkersTourStore((s) => s.skipTour);

  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [rect, setRect] = useState<GuidedTourTargetRect | null>(null);
  const [measureNonce, setMeasureNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meta = STEP_META[currentStep];
  const currentStepIndex = STEP_ORDER.indexOf(currentStep) + 1;
  const progressLabel = `${currentStepIndex} / ${TOTAL_STEPS}`;

  const triggerRemeasure = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setMeasureNonce((n) => n + 1);
    }, REMEASURE_DEBOUNCE_MS);
  }, []);

  // Measure the target element for the current step
  useEffect(() => {
    if (!isActive) {
      return;
    }

    cancelledRef.current = false;

    const targetId = meta.targetId;
    const MAX_RETRIES = MAX_GUIDED_TOUR_TARGET_RETRIES;
    let retryCount = 0;

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
  }, [isActive, currentStep, meta.targetId, triggerRemeasure, measureNonce]);

  const handleAction = useCallback(() => {
    // Before advancing attendance_tab → mark_day, navigate to Attendance tab first.
    // Android needs extra time for the JS bridge to mount the new tab content and
    // register the WORKERS_MARK_DAY_CELL GuidedTourTarget — otherwise the next step
    // would spin through all retries without finding its target.
    if (currentStep === 'attendance_tab') {
      onNavigateToAttendance?.();
      const delay = Platform.OS === 'android' ? 600 : 350;
      setTimeout(() => advanceStep(), delay);
    } else {
      advanceStep();
    }
  }, [currentStep, advanceStep, onNavigateToAttendance]);

  if (!isActive || !rect) return null;

  // Skip chip sits at `insets.top + spacing[2]` (8px) inside GuidedTourCoachmark.
  // When the spotlight target is near the top (tab selector, mark tab button), the
  // chip lands on top of the segmented control. Shift it below the target in those cases.
  const SKIP_CHIP_BASE = insets.top + 8;
  const targetBottom = rect.y + rect.height + 12; // 12px clearance below target
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
        messageNode={meta.messageNode}
        actionLabel={t(meta.actionLabelKey)}
        onAction={handleAction}
        onSkip={skipTour}
        blockOutsideTouches
        tooltipPlacement="auto"
        skipTopOffset={skipTopOffset}
        hideTapHint
        inlineSkip
        progressLabel={progressLabel}
      />
    </View>
  );
}
