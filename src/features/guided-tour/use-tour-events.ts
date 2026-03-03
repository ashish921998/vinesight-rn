import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import { router } from 'expo-router';
import { telemetry } from '@/services/telemetry';
import { guidedTourOn } from './events';
import { useGuidedTourStore } from './store';

export type AddFarmPhase =
  | 'cta'
  | 'name'
  | 'region'
  | 'area'
  | 'crop'
  | 'crop_option'
  | 'variety'
  | 'variety_option'
  | 'custom_variety'
  | 'submit';
export type SeasonFormPhase = 'start_date' | 'target_date' | 'submit';

interface QueuedLogPayload {
  farmId: number;
  recordType: string;
}

export interface GuidedTourFormState {
  addFarmPhase: AddFarmPhase;
  setAddFarmPhase: Dispatch<SetStateAction<AddFarmPhase>>;
  isAddFarmNameFilled: boolean;
  isAddFarmRegionFilled: boolean;
  isAddFarmAreaFilled: boolean;
  hasChosenActivityType: boolean;
  setHasChosenActivityType: Dispatch<SetStateAction<boolean>>;
  hasPendingLogDrafts: boolean;
  selectedActivityType: string | null;
  isCurrentLogValid: boolean;
  hasConfirmedLogInput: boolean;
  setHasConfirmedLogInput: Dispatch<SetStateAction<boolean>>;
  seasonFormPhase: SeasonFormPhase;
  setSeasonFormPhase: Dispatch<SetStateAction<SeasonFormPhase>>;
  queuedFarmCreatedRef: MutableRefObject<number | null>;
  queuedLogCreatedRef: MutableRefObject<QueuedLogPayload | null>;
  resetFormState: (opts?: { clearOverlay?: boolean }) => void;
}

/**
 * Owns form-level state for the add-farm and add-log guided tour steps and
 * subscribes to all guided-tour events that mutate that state.
 *
 * `clearOverlayRef` is called when an event handler needs to dismiss the
 * coach-mark overlay (e.g. on log-type selection or log creation).
 */
export function useGuidedTourFormState(
  clearOverlayRef: MutableRefObject<() => void>,
): GuidedTourFormState {
  const completeStep = useGuidedTourStore((s) => s.completeStep);
  const showStep = useGuidedTourStore((s) => s.showStep);

  const [addFarmPhase, setAddFarmPhase] = useState<AddFarmPhase>('cta');
  const [isAddFarmNameFilled, setIsAddFarmNameFilled] = useState(false);
  const [isAddFarmRegionFilled, setIsAddFarmRegionFilled] = useState(false);
  const [isAddFarmAreaFilled, setIsAddFarmAreaFilled] = useState(false);
  const [hasChosenActivityType, setHasChosenActivityType] = useState(false);
  const [hasPendingLogDrafts, setHasPendingLogDrafts] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null);
  const [isCurrentLogValid, setIsCurrentLogValid] = useState(false);
  const [hasConfirmedLogInput, setHasConfirmedLogInput] = useState(false);
  const [seasonFormPhase, setSeasonFormPhase] = useState<SeasonFormPhase>('start_date');

  const queuedFarmCreatedRef = useRef<number | null>(null);
  const queuedLogCreatedRef = useRef<QueuedLogPayload | null>(null);

  const resetFormState = (opts?: { clearOverlay?: boolean }) => {
    queuedFarmCreatedRef.current = null;
    queuedLogCreatedRef.current = null;
    setHasChosenActivityType(false);
    setHasPendingLogDrafts(false);
    setSelectedActivityType(null);
    setIsCurrentLogValid(false);
    setHasConfirmedLogInput(false);
    setSeasonFormPhase('start_date');
    setIsAddFarmNameFilled(false);
    setIsAddFarmRegionFilled(false);
    setIsAddFarmAreaFilled(false);
    setAddFarmPhase('cta');
    if (opts?.clearOverlay) {
      clearOverlayRef.current();
    }
  };

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
      setIsCurrentLogValid(false);
      setHasConfirmedLogInput(false);
      clearOverlayRef.current();
    });

    const unsubAddLogSelectionState = guidedTourOn(
      'guidedTour.addLogSelectionState',
      ({ hasSelection, hasPendingDrafts, recordType, isCurrentLogValid: currentLogValid }) => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_log') return;
        setHasChosenActivityType(hasSelection);
        setHasPendingLogDrafts(hasPendingDrafts);
        setSelectedActivityType(hasSelection ? (recordType ?? null) : null);
        setIsCurrentLogValid(Boolean(currentLogValid));
        if (!hasSelection || hasPendingDrafts || !currentLogValid) {
          setHasConfirmedLogInput(false);
        }
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
      setIsCurrentLogValid(false);
      setHasConfirmedLogInput(false);
      const current = useGuidedTourStore.getState();
      if (current.status !== 'in_progress' || current.currentStep !== 'add_log') return;
      if (current.activeFarmId && current.activeFarmId !== farmId) return;
      queuedLogCreatedRef.current = { farmId, recordType };
      telemetry.capture('tour_step_completed', { step: 'add_log', recordType });
      completeStep('add_log');
      showStep('complete_card');
      clearOverlayRef.current();
      queuedLogCreatedRef.current = null;
    });

    const unsubNotif = guidedTourOn('guidedTour.notificationOpened', ({ sequence }) => {
      const current = useGuidedTourStore.getState();
      telemetry.capture('tour_reminder_opened', { sequence });
      if (current.status === 'in_progress') {
        telemetry.capture('tour_resume', { step: current.currentStep });
      }
    });

    const unsubSeasonFormPhaseChanged = guidedTourOn(
      'guidedTour.seasonFormPhaseChanged',
      ({ phase }) => {
        const current = useGuidedTourStore.getState();
        if (current.status !== 'in_progress' || current.currentStep !== 'add_log') return;
        setSeasonFormPhase(phase);
      },
    );

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
      unsubSeasonFormPhaseChanged();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeStep, showStep]);

  return {
    addFarmPhase,
    setAddFarmPhase,
    isAddFarmNameFilled,
    isAddFarmRegionFilled,
    isAddFarmAreaFilled,
    hasChosenActivityType,
    setHasChosenActivityType,
    hasPendingLogDrafts,
    selectedActivityType,
    isCurrentLogValid,
    hasConfirmedLogInput,
    setHasConfirmedLogInput,
    seasonFormPhase,
    setSeasonFormPhase,
    queuedFarmCreatedRef,
    queuedLogCreatedRef,
    resetFormState,
  };
}
