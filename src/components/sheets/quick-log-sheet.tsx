/**
 * QuickLogSheet — single-log bottom sheet for dashboard quick actions.
 *
 * Tapping a quick action opens one sheet with just that log's form; Save
 * persists immediately (via {@link useSaveSingleLog}) and closes the sheet.
 * The farm is the dashboard's selected farm and is NOT repeated here (it's
 * already visible in the "Logging to" bar); the date defaults to today.
 *
 * Irrigation renders fertilizers as a first-class (but optional) section —
 * ~99% of irrigations carry them, so there is no gating switch: any added
 * rows save as a linked fertigation record. Spray gets the full picker
 * sources (catalog mixes, warehouse, history, plan) plus the PHI
 * harvest-safety check on Save.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  UIManager,
  findNodeHandle,
  useWindowDimensions,
  type ScrollView,
  type TextInputProps,
} from 'react-native';
import { BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { DateField } from '@/components/ui';
import { NoActiveSeasonBanner } from '@/components/ui/no-active-season-banner';
import { QuickLogSheetContainer } from './quick-log-sheet-container';
import { getLogType, type LogTypeId } from '@/constants/calculator-models';
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';
import { isGrapeCrop } from '@/utils/crop';
import { isPhiConflict } from '@/services/phi-service';
import { createStartSeasonHref } from '@/utils/add-log-navigation';
import { calculateKeyboardScrollOffset, resolveKeyboardTop } from '@/utils/keyboard-scroll';
import { formatDate } from '@/i18n/format';
import { triggerHapticSuccess } from '@/utils/haptics';
import { telemetry } from '@/services/telemetry';
import { guidedTourEmit } from '@/features/guided-tour';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import {
  SprayForm,
  ExpenseForm,
  HarvestForm,
  FertigationForm,
  validateIrrigationForm,
  validateSprayForm,
  validateExpenseForm,
  validateHarvestForm,
  validateFertigationForm,
  createEmptySprayFormData,
  createEmptyExpenseFormData,
  createEmptyHarvestFormData,
  finalizeSprayFormData,
  type IrrigationFormData,
  type SprayFormData,
  type ExpenseFormData,
  type HarvestFormData,
  type FertigationFormData,
} from '@/components/forms';
import {
  useFarmAreaAcres,
  useFarmSeasonStatus,
  useChemicalMixSearch,
  usePhiComputation,
  useSprayInputSources,
  useFertigationInputSources,
  useDeleteIrrigationRecord,
} from '@/hooks';
import {
  LinkedFertigationSaveError,
  useSaveSingleLog,
  saveIrrigationWithLinkedFertigation,
} from '@/features/entry-log-session';

export type QuickLogType = Extract<LogTypeId, 'irrigation' | 'spray' | 'harvest' | 'expense'>;

/**
 * Draft payload handed to `onSubmitDraft` when the sheet runs in draft mode
 * (add-log full screen). Same form-data shapes the host's pending-log
 * pipeline already consumes; the host enqueues them onto its multi-draft
 * stack instead of persisting immediately. Spray is the raw draft (with
 * `phiOverride` applied when the PHI double-confirm was accepted) — the host
 * finalizes it via its own `buildSprayPendingData`, mirroring the path a
 * spray draft takes when added from the inline composer.
 */
export type QuickLogDraftPayload =
  | {
      type: 'irrigation';
      irrigation: IrrigationFormData;
      /** Linked fertigation draft when fertilizer rows were added; null otherwise. */
      fertigation: FertigationFormData | null;
    }
  | { type: 'spray'; spray: SprayFormData }
  | { type: 'expense'; expense: ExpenseFormData }
  | { type: 'harvest'; harvest: HarvestFormData };

/**
 * Prefill for the sheet's drafts (draft mode). The add-log screen builds this
 * from its prefill sources (plan one-tap chemicals, task irrigation duration,
 * voice extraction) so a prefilled log opens in the SAME sheet as a manual
 * chip tap instead of a separate inline form. Only the field for the opening
 * `type` is read; the rest are ignored. Seeded once per open — the host keeps
 * the object in state so its reference stays stable while the sheet is open.
 */
export interface QuickLogInitialDraft {
  irrigation?: IrrigationFormData;
  spray?: SprayFormData;
  expense?: ExpenseFormData;
  harvest?: HarvestFormData;
}

interface QuickLogSheetProps {
  /** Which log's sheet to show; null keeps the sheet closed. */
  type: QuickLogType | null;
  farm: Farm | null;
  onClose: () => void;
  /**
   * Draft mode (add-log full screen): when provided, Save assembles the draft
   * and calls this instead of persisting immediately, then closes the sheet.
   * Absent on the dashboard, which keeps the original immediate-save behavior.
   * PHI double-confirm for spray runs in both modes before the payload is built.
   */
  onSubmitDraft?: (payload: QuickLogDraftPayload) => void;
  /**
   * Live validity pulse for the host. The sheet owns its form state, so a host
   * that needs to know whether the current draft is valid (e.g. the add-log
   * full screen feeding the guided-tour coach) subscribes here. Fires on mount
   * and whenever validity flips. Absent on the dashboard, which ignores it.
   */
  onValidityChange?: (valid: boolean) => void;
  /**
   * Controlled date (draft mode): when provided, the sheet uses this date
   * instead of its own, keeping the draft synchronized with the host's
   * pending-log date and PHI computation. Value and setter travel as one
   * pair so a half-controlled date is unrepresentable. Absent on the
   * dashboard, which owns its own date.
   */
  date?: { value: Date; onChange: (date: Date) => void };
  /**
   * Prefill drafts, seeded when the sheet opens (draft mode only — the
   * dashboard never prefills). See {@link QuickLogInitialDraft}.
   */
  initialDraft?: QuickLogInitialDraft | null;
}

interface HeroStepperProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unitLabel: string;
  presets: number[];
  formatPreset: (preset: number) => string;
  step: number;
  accentColor: string;
  /** Upper bound; typed or stepped values clamp here so absurd inputs (and the
   *  layout blow-out they cause) can't happen. */
  maxValue: number;
  /** Quiet plain-words echo under the presets ("≈ 12.5 mm of water"). */
  echo?: string | null;
}

/**
 * The drawer's main-number control (v2 design): a big value with −/+ steppers
 * and one row of preset chips — irrigation hours and spray tank litres share
 * it. One glance, one thumb; the presets cover the common answers.
 */
function HeroStepper({
  value,
  onChange,
  unitLabel,
  presets,
  formatPreset,
  step,
  accentColor,
  maxValue,
  echo,
}: HeroStepperProps) {
  const m3 = useM3();
  const current = value ?? 0;
  const displayValue = Number.isInteger(current) ? String(current) : current.toFixed(1);
  // Shrink the hero font as digits grow so wide values (up to maxValue) stay
  // centered without shoving the −/+ buttons off the row.
  const heroFontSize = (shown: string) =>
    shown.length > 5 ? fontSize['3xl'] : shown.length > 3 ? fontSize['4xl'] : fontSize['5xl'];

  // Keyboard entry for exact values, no UI change: the hero number doubles as
  // a decimal-pad TextInput. Local draft holds partial input ("1.") while
  // focused so the −/+ rounding never fights the keystroke.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // Round to 2dp so 0.1-steps never accumulate float dust; 0 clears back to
  // undefined so validation still reads "not answered". Keep the draft in sync
  // so tapping −/+ or a preset mid-edit updates the on-screen number too.
  const setValue = (next: number) => {
    const rounded = Math.min(Math.round(next * 100) / 100, maxValue);
    const clamped = rounded > 0 ? rounded : undefined;
    onChange(clamped);
    if (editing) setDraft(clamped === undefined ? '' : String(clamped));
  };
  const onTypedChange = (raw: string) => {
    // Keep digits and a single decimal separator only.
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    const normalized = cleaned.split('.').slice(0, 2).join('.');
    const parsed = parseFloat(normalized);
    if (Number.isFinite(parsed) && parsed > maxValue) {
      // Snap over-cap input back to the ceiling instead of accepting garbage.
      setDraft(String(maxValue));
      onChange(maxValue);
      return;
    }
    setDraft(normalized);
    onChange(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : undefined);
  };

  return (
    <View
      style={{
        backgroundColor: m3.surface.s100,
        borderWidth: 1,
        borderColor: m3.surface.s200,
        borderRadius: borderRadius.xl,
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[3],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[5],
        }}
      >
        <Pressable
          onPress={() => setValue(current - step)}
          disabled={current <= 0}
          accessibilityRole="button"
          accessibilityLabel="−"
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: borderRadius.full,
            borderWidth: 1.5,
            borderColor: m3.surface.s300,
            backgroundColor: m3.surface.s50,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: current <= 0 ? 0.4 : 1,
          }}
        >
          <Symbol name="minus" size={20} color={m3.surface.s900} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
          <TextInput
            value={editing ? draft : displayValue}
            onChangeText={onTypedChange}
            onFocus={() => {
              setEditing(true);
              setDraft(current > 0 ? displayValue : '');
            }}
            onBlur={() => setEditing(false)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            numberOfLines={1}
            maxLength={String(Math.floor(maxValue)).length + 3}
            accessibilityLabel={unitLabel}
            style={{
              fontSize: heroFontSize(editing ? draft : displayValue),
              fontWeight: fontWeight.bold,
              letterSpacing: -1,
              color: m3.surface.s900,
              lineHeight: 54,
              textAlign: 'center',
              alignSelf: 'stretch',
              padding: 0,
            }}
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s500,
            }}
          >
            {unitLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => setValue(current + step)}
          accessibilityRole="button"
          accessibilityLabel="+"
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            borderRadius: borderRadius.full,
            borderWidth: 1.5,
            borderColor: m3.surface.s300,
            backgroundColor: m3.surface.s50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name="plus" size={20} color={m3.surface.s900} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
        {presets.map((preset) => {
          const selected = value === preset;
          return (
            <Pressable
              key={preset}
              onPress={() => setValue(preset)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatPreset(preset)} ${unitLabel}`}
              style={{
                flex: 1,
                paddingVertical: spacing[3],
                borderRadius: borderRadius.full,
                alignItems: 'center',
                backgroundColor: selected ? accentColor : m3.surface.s50,
                borderWidth: 1,
                borderColor: selected ? accentColor : m3.surface.s300,
              }}
            >
              <Text
                style={{
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.sm,
                  color: selected ? m3.surface.s50 : m3.colorScheme.onSurface,
                }}
              >
                {formatPreset(preset)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {echo ? (
        <Text
          style={{
            marginTop: spacing[3],
            textAlign: 'center',
            fontSize: fontSize.xs,
            color: m3.surface.s600,
          }}
        >
          {echo}
        </Text>
      ) : null}
    </View>
  );
}

/** Uppercase plain-question section label above each drawer section. */
function SectionLabel({ children, optional }: { children: string; optional?: string }) {
  const m3 = useM3();
  return (
    <Text
      style={{
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: m3.surface.s500,
        marginBottom: spacing[2],
      }}
    >
      {children}
      {optional ? (
        <Text style={{ fontWeight: fontWeight.medium, color: m3.surface.s400 }}>
          {'  ·  '}
          {optional}
        </Text>
      ) : null}
    </Text>
  );
}

export function QuickLogSheet({
  type,
  farm,
  onClose,
  onSubmitDraft,
  onValidityChange,
  date: controlledDate,
  initialDraft = null,
}: QuickLogSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const domainColors = useDomainColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const farmId = farm?.id ?? undefined;
  const isDraftMode = Boolean(onSubmitDraft);
  const isGrapeFarm = isGrapeCrop(farm?.crop, farm?.crop_variety);
  const { preferredAreaUnit, farmAreaAcres } = useFarmAreaAcres(farm?.area);
  const { activeSeason, hasResolvedSeasons } = useFarmSeasonStatus(farmId);
  // Gate on hasResolvedSeasons: activeSeason is null both while the query
  // loads and when it errors, so only a confirmed no-season result blocks.
  const isBlockedByNoSeason = farmId != null && hasResolvedSeasons && !activeSeason;

  const [internalDate, setInternalDate] = useState<Date>(() => new Date());
  // Controlled (draft mode) when the host passes the date pair; uncontrolled
  // (dashboard) otherwise. The pair type makes half-controlled impossible.
  const isControlledDate = controlledDate != null;
  const selectedDate = controlledDate?.value ?? internalDate;
  const handleDateChange = controlledDate?.onChange ?? setInternalDate;
  const dateStr = useMemo(() => toSupabaseDateString(selectedDate), [selectedDate]);

  const [irrigationDraft, setIrrigationDraft] = useState<IrrigationFormData>({
    duration: undefined,
  });
  // Starts with NO rows (unlike createEmptyFertigationFormData's one blank
  // row): fertilizers are optional here, and a lingering blank row would
  // block an irrigation-only save.
  const [fertigationDraft, setFertigationDraft] = useState<FertigationFormData>({
    fertilizers: [],
  });
  const [sprayDraft, setSprayDraft] = useState<SprayFormData>(() => createEmptySprayFormData());
  const [expenseDraft, setExpenseDraft] = useState<ExpenseFormData>(() =>
    createEmptyExpenseFormData(),
  );
  const [harvestDraft, setHarvestDraft] = useState<HarvestFormData>(() =>
    createEmptyHarvestFormData(),
  );
  const [saving, setSaving] = useState(false);
  // Synchronous re-entrancy guard (the `saving` state flips a tick later).
  const savingRef = useRef(false);

  // Keyboard-aware scrolling (same mechanics as EntryForm): the sheet keeps
  // its height while the keyboard overlays it, so a focused input — and the
  // typeahead dropdown that opens under the name field — must be scrolled
  // into the visible strip above the keyboard.
  const { height: windowHeight } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardTopRef = useRef<number | null>(null);
  const focusedInputRef = useRef<number | null>(null);

  const scrollToNode = useCallback((nodeHandle: number) => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop == null) return;
    UIManager.measureInWindow(nodeHandle, (_x, y, _width, height) => {
      const nextOffset = calculateKeyboardScrollOffset({
        currentOffset: scrollOffsetRef.current,
        inputY: y,
        inputHeight: height,
        keyboardTop,
        // The native sheet shrinks above the keyboard and keeps its Save
        // footer pinned, so the real occluder sits ~90pt above keyboardTop;
        // add the typeahead dropdown's height on top of that so the list is
        // on screen, not just the input's caret. ponytail: fixed budget
        // instead of measuring the footer — revisit if footer height changes.
        buffer: 360,
      });
      if (nextOffset != null) {
        scrollViewRef.current?.scrollTo({ y: nextOffset, animated: true });
      }
    });
  }, []);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = resolveKeyboardTop({
        screenY: event.endCoordinates.screenY,
        keyboardHeight: event.endCoordinates.height,
        windowHeight,
      });
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [scrollToNode, windowHeight]);

  const handleInputFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (event) => {
      const target = (event as { target?: unknown } | undefined)?.target ?? null;
      const nodeHandle = findNodeHandle(target as unknown as number | React.Component | null);
      if (typeof nodeHandle !== 'number') return;
      focusedInputRef.current = nodeHandle;
      requestAnimationFrame(() => scrollToNode(nodeHandle));
    },
    [scrollToNode],
  );

  // Fresh sheet per open: empty drafts, or the host's prefill when one was
  // provided (plan/voice/duration handoff). Saving guards reset on every type
  // change (open and close) so a draft-mode save that set them doesn't leak.
  // Date is only reset when uncontrolled (dashboard); draft mode uses the
  // host's date, which the host manages.
  useEffect(() => {
    savingRef.current = false;
    setSaving(false);
    if (!type) return;
    if (!isControlledDate) setInternalDate(new Date());
    setIrrigationDraft(initialDraft?.irrigation ?? { duration: undefined });
    setFertigationDraft({ fertilizers: [] });
    setSprayDraft(initialDraft?.spray ?? createEmptySprayFormData());
    setExpenseDraft(initialDraft?.expense ?? createEmptyExpenseFormData());
    setHarvestDraft(initialDraft?.harvest ?? createEmptyHarvestFormData());
  }, [type, isControlledDate, initialDraft]);

  // Picker sources — catalog for spray (per design), plan/warehouse/history for both.
  const spraySources = useSprayInputSources(farmId);
  const fertigationSources = useFertigationInputSources(farmId, {
    catalogEnabled: type === 'irrigation',
  });
  const { data: catalogMixes = [] } = useChemicalMixSearch('', isGrapeFarm);

  // PHI fields derive from mix + spray date; stamp them into the draft so the
  // saved record carries them (same contract as EntryForm).
  const { data: sprayPhiComputation } = usePhiComputation(sprayDraft.catalogMixId ?? null, dateStr);
  useEffect(() => {
    if (!sprayPhiComputation) return;
    setSprayDraft((prev) => {
      if (prev.catalogMixId !== sprayPhiComputation.catalogMixId) return prev;
      if (
        prev.governingPhiDays === sprayPhiComputation.governingPhiDays &&
        prev.safeHarvestDate === sprayPhiComputation.safeHarvestDate &&
        prev.phiBlockingComponent === sprayPhiComputation.blockingComponentName &&
        prev.phiStatus === sprayPhiComputation.phiStatus
      ) {
        return prev;
      }
      return {
        ...prev,
        governingPhiDays: sprayPhiComputation.governingPhiDays,
        safeHarvestDate: sprayPhiComputation.safeHarvestDate,
        phiBlockingComponent: sprayPhiComputation.blockingComponentName,
        phiStatus: sprayPhiComputation.phiStatus,
      };
    });
  }, [sprayPhiComputation]);

  const saveLog = useSaveSingleLog();
  const deleteIrrigation = useDeleteIrrigationRecord();
  // Retain a successfully created irrigation when compensation fails so an
  // immediate retry only saves its fertigation rider instead of duplicating it.
  const pendingIrrigationRef = useRef<Awaited<ReturnType<typeof saveLog>> | null>(null);
  useEffect(() => {
    pendingIrrigationRef.current = null;
  }, [type]);

  // Fertilizers ride along whenever any rows exist (they're optional, so an
  // empty list is simply "none today" — but partial rows block Save).
  const hasFertilizers = fertigationDraft.fertilizers.length > 0;

  // Duration hero echo — duration × system discharge, the same mm estimate
  // IrrigationForm showed, phrased as one quiet line.
  const estimatedWaterEcho = useMemo(() => {
    const discharge = farm?.system_discharge;
    const duration = irrigationDraft.duration;
    if (!discharge || !duration || duration <= 0) return null;
    return `${t('irrigationForm.estimatedWaterLabel')}: ≈ ${(duration * discharge).toFixed(1)} ${t('units.millimeter')}`;
  }, [farm?.system_discharge, irrigationDraft.duration, t]);

  // Same PHI gate the Save path double-confirms on, surfaced live as a card.
  const sprayPhiConflict =
    isGrapeFarm && sprayDraft.catalogMixId != null && sprayDraft.safeHarvestDate != null
      ? isPhiConflict({
          safeHarvestDate: sprayDraft.safeHarvestDate,
          targetHarvestDate: activeSeason?.target_harvest_date ?? null,
        })
      : false;

  const isValid =
    type === 'irrigation'
      ? validateIrrigationForm(irrigationDraft) &&
        (!hasFertilizers || validateFertigationForm(fertigationDraft))
      : type === 'spray'
        ? validateSprayForm(sprayDraft)
        : type === 'expense'
          ? validateExpenseForm(expenseDraft)
          : type === 'harvest'
            ? validateHarvestForm(harvestDraft)
            : false;

  // Pulse validity to the host (add-log full screen feeds the guided-tour
  // coach, which needs to know when the sheet's draft is complete). The sheet
  // owns its form state, so the host can't derive this itself. No-op on the
  // dashboard, which doesn't pass onValidityChange.
  const onValidityChangeRef = useRef(onValidityChange);
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  }, [onValidityChange]);
  useEffect(() => {
    onValidityChangeRef.current?.(isValid);
  }, [isValid]);

  const captureSaved = useCallback((recordType: LogTypeId, savedFarmId: number) => {
    try {
      telemetry.capture('record_created', {
        record_type: recordType,
        created_from: 'manual',
        farm_id: savedFarmId,
      });
      telemetry.capture('meaningful_action', {
        action_type: 'record_created',
        feature_name: recordType,
      });
    } catch {
      // telemetry is best-effort
    }
  }, []);

  // Assemble the draft payload for draft mode (onSubmitDraft). Same shapes
  // performSave persists in immediate mode; the host finalizes spray via its
  // own buildSprayPendingData, so the spray draft is handed back raw (with
  // phiOverride already applied by the caller).
  const buildDraftPayload = useCallback(
    (sprayPayload?: SprayFormData): QuickLogDraftPayload | null => {
      if (type === 'irrigation') {
        return {
          type: 'irrigation',
          irrigation: { ...irrigationDraft },
          fertigation: hasFertilizers ? { ...fertigationDraft } : null,
        };
      }
      if (type === 'spray') {
        return { type: 'spray', spray: sprayPayload ?? sprayDraft };
      }
      if (type === 'expense') {
        return { type: 'expense', expense: { ...expenseDraft } };
      }
      if (type === 'harvest') {
        return { type: 'harvest', harvest: { ...harvestDraft } };
      }
      return null;
    },
    [
      type,
      irrigationDraft,
      hasFertilizers,
      fertigationDraft,
      sprayDraft,
      expenseDraft,
      harvestDraft,
    ],
  );

  const performSave = useCallback(
    async (sprayPayload?: SprayFormData) => {
      if (!type || !farm || savingRef.current || isBlockedByNoSeason) return;

      // Draft mode (add-log full screen): hand the assembled draft to the host
      // instead of persisting. The PHI double-confirm for spray already ran in
      // handleSave before reaching here, so the override payload is honored.
      // Set saving guards before the callback to prevent a rapid double-tap
      // from enqueuing the same draft twice before onClose() takes effect.
      if (onSubmitDraft) {
        const payload = buildDraftPayload(sprayPayload);
        if (!payload) return;
        savingRef.current = true;
        setSaving(true);
        onSubmitDraft(payload);
        triggerHapticSuccess();
        onClose();
        return;
      }

      savingRef.current = true;
      setSaving(true);
      try {
        if (type === 'irrigation') {
          const outcome = await saveIrrigationWithLinkedFertigation({
            saveLog,
            deleteIrrigation: (ref) => deleteIrrigation.mutateAsync(ref),
            irrigationData: { ...irrigationDraft },
            fertigationData: { ...fertigationDraft },
            hasFertilizers,
            farm,
            dateStr,
            preferredAreaUnit,
            existingIrrigation: pendingIrrigationRef.current,
          });
          pendingIrrigationRef.current = outcome.irrigation;
          if (outcome.fertigation) {
            captureSaved('fertigation', outcome.irrigation.farmId);
          }
          pendingIrrigationRef.current = null;
          captureSaved('irrigation', outcome.irrigation.farmId);
          guidedTourEmit('guidedTour.logCreated', {
            farmId: outcome.irrigation.farmId,
            recordType: 'irrigation',
          });
        } else if (type === 'spray') {
          const result = await saveLog({
            type: 'spray',
            data: finalizeSprayFormData(sprayPayload ?? sprayDraft, isGrapeFarm),
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('spray', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'spray' });
        } else if (type === 'expense') {
          const result = await saveLog({
            type: 'expense',
            data: { ...expenseDraft },
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('expense', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'expense' });
        } else {
          const result = await saveLog({
            type: 'harvest',
            data: { ...harvestDraft },
            farm,
            dateStr,
            preferredAreaUnit,
          });
          captureSaved('harvest', result.farmId);
          guidedTourEmit('guidedTour.logCreated', { farmId: result.farmId, recordType: 'harvest' });
        }
        triggerHapticSuccess();
        onClose();
      } catch (error) {
        pendingIrrigationRef.current =
          error instanceof LinkedFertigationSaveError && !error.irrigationWasDeleted
            ? error.irrigation
            : null;
        Alert.alert(
          t('common.error'),
          error instanceof Error ? error.message : t('common.errors.failedToSaveLogs'),
        );
      } finally {
        setSaving(false);
        savingRef.current = false;
      }
    },
    [
      type,
      farm,
      isBlockedByNoSeason,
      onSubmitDraft,
      buildDraftPayload,
      saveLog,
      deleteIrrigation,
      irrigationDraft,
      hasFertilizers,
      fertigationDraft,
      sprayDraft,
      expenseDraft,
      harvestDraft,
      isGrapeFarm,
      dateStr,
      preferredAreaUnit,
      captureSaved,
      onClose,
      t,
    ],
  );

  const handleSave = useCallback(() => {
    if (!isValid || savingRef.current) return;
    if (type === 'spray') {
      // PHI computation for a selected mix is async (usePhiComputation stamps
      // it a tick after selection). Until it lands, phiStatus is null and both
      // gates below no-op — so an immediate save could persist a mix with no
      // governing PHI / safe-harvest date and skip the conflict prompt. Block
      // until it resolves.
      if (isGrapeFarm && sprayDraft.catalogMixId != null && sprayDraft.phiStatus == null) {
        Alert.alert(
          t('entryForm.phiErrors.computeFailedTitle'),
          t('entryForm.phiErrors.computeFailedBody'),
        );
        return;
      }
      // Same harvest-safety gate as EntryForm: a catalog mix whose PHI window
      // crosses the season's target harvest needs an explicit double-confirm.
      if (
        isGrapeFarm &&
        sprayDraft.catalogMixId &&
        sprayDraft.safeHarvestDate &&
        sprayDraft.governingPhiDays != null &&
        isPhiConflict({
          safeHarvestDate: sprayDraft.safeHarvestDate,
          targetHarvestDate: activeSeason?.target_harvest_date ?? null,
        })
      ) {
        Alert.alert(
          t('entryForm.phiErrors.conflictTitle'),
          t('entryForm.phiErrors.conflictBody', {
            safeDate: sprayDraft.safeHarvestDate,
            component: sprayDraft.phiBlockingComponent ?? 'a component',
            targetDate: activeSeason?.target_harvest_date ?? '-',
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('entryForm.phiErrors.overrideAction', { defaultValue: 'Add anyway' }),
              style: 'destructive',
              onPress: () => {
                Alert.alert(
                  t('entryForm.phiErrors.conflictTitle'),
                  t('entryForm.phiErrors.overrideConfirmBody', {
                    defaultValue:
                      'Are you sure? This spray violates harvest safety guidance and will be marked as an override.',
                  }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('common.confirm', { defaultValue: 'Confirm' }),
                      style: 'destructive',
                      onPress: () => void performSave({ ...sprayDraft, phiOverride: true }),
                    },
                  ],
                );
              },
            },
          ],
        );
        return;
      }
      if (
        isGrapeFarm &&
        sprayDraft.phiStatus === 'unknown' &&
        (!sprayDraft.catalogMixId ||
          sprayDraft.safeHarvestDate == null ||
          sprayDraft.governingPhiDays == null)
      ) {
        Alert.alert(
          t('entryForm.phiErrors.computeFailedTitle'),
          t('entryForm.phiErrors.computeFailedBody'),
        );
        return;
      }
    }
    void performSave();
  }, [isValid, type, isGrapeFarm, sprayDraft, activeSeason?.target_harvest_date, performSave, t]);

  const goStartSeason = useCallback(() => {
    if (farm?.id == null) return;
    onClose();
    router.push(createStartSeasonHref(farm.id));
  }, [farm?.id, onClose, router]);

  const logType = type ? getLogType(type) : null;
  const saveDisabled = !isValid || saving || isBlockedByNoSeason || !farm;

  // Spray & irrigation are tall, multi-row forms (chemical/fertilizer rows, each
  // with a typeahead + unit control, plus the keyboard) — they need full space,
  // so present them at a fixed near-full-height detent that scrolls cleanly.
  // Expense & harvest are short, so they keep content sizing (a tall detent
  // would just leave dead space below the footer).
  const fullHeight = type === 'spray' || type === 'irrigation';

  return (
    <QuickLogSheetContainer
      key={type ?? 'closed'}
      open={type !== null}
      fullHeight={fullHeight}
      onClose={onClose}
      backgroundColor={m3.colorScheme.background}
    >
      <BottomSheetScrollView
        ref={scrollViewRef}
        // Full-height sheets (spray/irrigation): fill the fixed detent and scroll
        // within it. Content-sized sheets (expense/harvest): cap the height so a
        // form that ever grows past the screen still has overflow to scroll —
        // otherwise fitToContents grows the sheet past the top and clips it,
        // with no way to scroll up. Short forms never reach the cap.
        style={fullHeight ? { flex: 1 } : { maxHeight: windowHeight * 0.72 }}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          // Gap below the native drag handle — the form (date field) starts
          // right here now that the title header is gone.
          paddingTop: spacing[3],
          paddingBottom: spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* No title header on the dashboard: the farmer just tapped a labelled
            quick action ("Irrigation"/"Spray"…) and the target farm shows in
            the home header above the sheet. In draft mode (add-entry full
            screen) the sheet covers the "Logging to" bar, so show the farm
            name here to prevent silent mis-logging on multi-farm setups. */}
        {isDraftMode && farm?.name ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: spacing[3],
              gap: spacing[2],
            }}
          >
            <AppIcon name="leaf.fill" size={14} color={m3.colorScheme.primary} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {farm.name}
            </Text>
          </View>
        ) : null}

        {/* Date — its own row, defaults to today. */}
        <View style={{ marginBottom: spacing[5] }}>
          <DateField
            value={selectedDate}
            onChange={handleDateChange}
            maximumDate={new Date()}
            label={t('activityEdit.dateLabel', { defaultValue: 'Date' })}
            testID="quick-log-date-field"
            overlay
            relativeLabels
          />
        </View>

        {isBlockedByNoSeason ? (
          <View style={{ marginBottom: spacing[4] }}>
            <NoActiveSeasonBanner onStartSeason={goStartSeason} />
          </View>
        ) : null}

        {type === 'irrigation' && (
          <>
            {/* Duration hero — big value, −/+ in half-hour steps, hour presets.
                The litres/mm echo translates the answer into water reality. */}
            <SectionLabel>{t('quickLog.durationQuestion')}</SectionLabel>
            <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_IRRIGATION_DURATION}>
              <HeroStepper
                value={irrigationDraft.duration}
                onChange={(duration) => setIrrigationDraft({ duration })}
                unitLabel={t('irrigationForm.durationUnit')}
                presets={[1, 2, 3, 4, 5]}
                formatPreset={(hours) => `${hours}h`}
                step={0.5}
                maxValue={999}
                accentColor={domainColors.category.irrigation}
                echo={estimatedWaterEcho}
              />
            </GuidedTourTarget>

            {/* Fertilizers — first-class, no gating switch (~99% of irrigations
                carry them). Zero rows simply means "none today" and saves
                irrigation alone. */}
            <View style={{ marginTop: spacing[5] }}>
              <SectionLabel optional={t('quickLog.optionalTag')}>
                {t('quickLog.fertilizerQuestion')}
              </SectionLabel>
              <FertigationForm
                data={fertigationDraft}
                onChange={setFertigationDraft}
                onInputFocus={handleInputFocus}
                historyItems={fertigationSources.historyItems}
                planItems={fertigationSources.planItems}
                catalogProducts={fertigationSources.catalogProducts}
                areaAcres={farmAreaAcres}
                compact
                showSectionHeader={false}
              />
              {!hasFertilizers ? (
                <Text
                  style={{
                    marginTop: spacing[2],
                    textAlign: 'center',
                    fontSize: fontSize.xs,
                    color: m3.surface.s500,
                  }}
                >
                  {t('quickLog.emptyFertilizerHint')}
                </Text>
              ) : null}
            </View>
          </>
        )}

        {type === 'spray' && (
          <>
            {/* Tank water hero — litres with −/+ in 50 L steps and presets. */}
            <SectionLabel>{t('quickLog.waterQuestion')}</SectionLabel>
            <HeroStepper
              value={sprayDraft.waterVolume}
              onChange={(waterVolume) => setSprayDraft((prev) => ({ ...prev, waterVolume }))}
              unitLabel={t('sprayForm.waterVolume.unitLiters')}
              presets={[100, 200, 400, 500, 1000]}
              formatPreset={(litres) => String(litres)}
              step={50}
              maxValue={10000}
              accentColor={domainColors.category.spray}
            />

            <View style={{ marginTop: spacing[5] }}>
              <SectionLabel>{t('quickLog.tankQuestion')}</SectionLabel>
              <SprayForm
                data={sprayDraft}
                onChange={setSprayDraft}
                onInputFocus={handleInputFocus}
                catalogMixes={catalogMixes}
                historyItems={spraySources.historyItems}
                planItems={spraySources.planItems}
                areaAcres={farmAreaAcres}
                compact
                showSectionHeader={false}
                showWaterInput={false}
              />
            </View>

            {/* Harvest-safety verdict in plain words — green when the PHI
                window clears the planned harvest, amber when it crosses it.
                Same isPhiConflict gate the Save path double-confirms on. */}
            {isGrapeFarm && sprayDraft.catalogMixId && sprayDraft.safeHarvestDate ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing[2],
                  marginTop: spacing[4],
                  padding: spacing[3],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1,
                  backgroundColor: colorWithOpacity(
                    sprayPhiConflict ? m3.colorScheme.warning : m3.colorScheme.success,
                    0.12,
                  ),
                  borderColor: colorWithOpacity(
                    sprayPhiConflict ? m3.colorScheme.warning : m3.colorScheme.success,
                    0.35,
                  ),
                }}
              >
                <Symbol
                  name={
                    sprayPhiConflict ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill'
                  }
                  size={18}
                  color={sprayPhiConflict ? m3.colorScheme.warning : m3.colorScheme.success}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s900,
                    }}
                  >
                    {sprayPhiConflict ? t('quickLog.phiRiskTitle') : t('quickLog.phiSafeTitle')}
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontSize: fontSize.xs,
                      color: m3.surface.s600,
                      lineHeight: 17,
                    }}
                  >
                    {sprayPhiConflict
                      ? t('quickLog.phiRiskBody', {
                          date: formatDate(sprayDraft.safeHarvestDate, {
                            day: 'numeric',
                            month: 'short',
                          }),
                          target: activeSeason?.target_harvest_date
                            ? formatDate(activeSeason.target_harvest_date, {
                                day: 'numeric',
                                month: 'short',
                              })
                            : '-',
                        })
                      : t('quickLog.phiSafeBody', {
                          date: formatDate(sprayDraft.safeHarvestDate, {
                            day: 'numeric',
                            month: 'short',
                          }),
                        })}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}

        {type === 'expense' && (
          <ExpenseForm
            data={expenseDraft}
            onChange={setExpenseDraft}
            onInputFocus={handleInputFocus}
            compact
          />
        )}

        {type === 'harvest' && (
          <HarvestForm
            data={harvestDraft}
            onChange={setHarvestDraft}
            onInputFocus={handleInputFocus}
            compact
          />
        )}
      </BottomSheetScrollView>

      {/* Fixed action footer: the form scrolls independently while its primary
          action remains reachable above the platform safe area. */}
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: Math.max(spacing[3], insets.bottom + spacing[2]),
          backgroundColor: m3.colorScheme.background,
          borderTopWidth: 1,
          borderTopColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
        }}
      >
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_ADD_ENTRY}
          style={{ alignSelf: 'stretch' }}
        >
          <Pressable
            disabled={saveDisabled}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: saveDisabled }}
            accessibilityLabel={
              logType ? t('quickLog.saveType', { type: t(logType.labelKey) }) : undefined
            }
            style={{
              paddingVertical: 15,
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: !saveDisabled ? m3.colorScheme.primary : m3.surface.s50,
            }}
          >
            {saving ? (
              <Spinner size="small" color={m3.colorScheme.onSurfaceVariant} />
            ) : (
              <AppIcon
                name="checkmark-circle"
                size={20}
                color={
                  !saveDisabled
                    ? m3.colorScheme.onPrimary
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)
                }
              />
            )}
            <Text
              style={{
                fontWeight: '700',
                color: !saveDisabled
                  ? m3.colorScheme.onPrimary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
              }}
            >
              {saving
                ? t('common.saving')
                : logType
                  ? t('quickLog.saveType', { type: t(logType.labelKey) })
                  : ''}
            </Text>
          </Pressable>
        </GuidedTourTarget>
      </View>
    </QuickLogSheetContainer>
  );
}
