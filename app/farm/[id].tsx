import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  BackHandler,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useIsFocused } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui';
import {
  useFarm,
  useFarmRecords,
  useWeather,
  useProfile,
  useDeleteFarm,
  useDeleteIrrigationRecord,
  useDeleteSprayRecord,
  useDeleteHarvestRecord,
  useDeleteExpenseRecord,
  useDeleteFertigationRecord,
  useFarmSeasons,
  useStartFarmSeason,
  useEndFarmSeason,
  useUpdateFarmSeasonTargetHarvestDate,
  useFarmSeasonStatus,
  useRecomputeFarmSeasonAssignments,
  useEarliestSafeHarvestForSeason,
  isAndroid,
  isIOS,
  useCurrency,
} from '@/hooks';
import { useTasks, useCompleteTask, useDeleteTask } from '@/hooks/use-tasks';
import { TaskRow, TimelineLogCard } from '@/components/cards';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores';
import { cancelNotification } from '@/services/notifications';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
  DailyNoteRecord,
} from '@/types';
import type { TaskReminder } from '@/types/task';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatDate } from '@/i18n/format';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { isGrapeCrop } from '@/utils/crop';

import { useModalStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { triggerHapticWarning, triggerHapticSuccess, triggerHapticMedium } from '@/utils/haptics';
import { decodeTaskPlanFromDescription } from '@/utils/task-plan';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { telemetry } from '@/services/telemetry';
import { createAddLogHref } from '@/utils/add-log-navigation';
import {
  GUIDED_TOUR_TARGET_IDS,
  GuidedTourTarget,
  guidedTourEmit,
  guidedTourOn,
  useGuidedTourStore,
} from '@/features/guided-tour';

// Workboard action type
interface WorkboardAction {
  id: string;
  titleKey: string;
  icon: string;
  color: string;
  route?: string;
}

const NOW_TICK_MS = 60_000;
const OPEN_TASKS_PREVIEW_LIMIT = 5;

export default function FarmDetailScreen() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();
  const currency = useCurrency();

  const router = useRouter();
  const isFocused = useIsFocused();
  const { setEditActivity, setAddEntry } = useModalStore();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const insets = useSafeAreaInsets();

  // Expo Router route params can be `string[]` in some cases; normalize to one value.
  const normalizedId = Array.isArray(id) ? id[0] : id;
  const farmId = normalizedId ? parseInt(normalizedId, 10) : undefined;
  const farmIdParam = normalizedId;

  const { data: farm, isLoading: farmLoading, refetch: refetchFarm } = useFarm(farmId);
  const {
    irrigationRecords,
    sprayRecords,
    harvestRecords,
    expenseRecords,
    fertigationRecords,
    dailyNotes,
    refetch: refetchRecords,
  } = useFarmRecords(farmId);

  const { data: tasks, isLoading: isTasksLoading, refetch: refetchTasks } = useTasks(farmId);
  const { data: weather } = useWeather(farm?.latitude ?? undefined, farm?.longitude ?? undefined);
  const { data: profile } = useProfile({ enabled: true });
  const {
    data: farmSeasons,
    isLoading: isSeasonsLoading,
    refetch: refetchSeasons,
  } = useFarmSeasons(farmId);
  const { needsReview: needsSeasonReview } = useFarmSeasonStatus(farmId);
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const taskSchedules = useNotificationStore((s) => s.taskSchedules);
  const removeTaskSchedule = useNotificationStore((s) => s.removeTaskSchedule);

  const cleanupTaskNotifications = async (taskId: number): Promise<void> => {
    const schedule = taskSchedules[String(taskId)];
    if (!schedule) return;

    if (schedule.notificationIds?.length) {
      await Promise.allSettled(schedule.notificationIds.map(cancelNotification));
    }
    removeTaskSchedule(String(taskId));
  };

  const deleteFarmMutation = useDeleteFarm();
  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();
  const startFarmSeason = useStartFarmSeason();
  const endFarmSeason = useEndFarmSeason();
  const updateSeasonTargetHarvestDate = useUpdateFarmSeasonTargetHarvestDate();
  const recomputeSeasonAssignments = useRecomputeFarmSeasonAssignments();

  const [refreshing, setRefreshing] = useState(false);

  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [seasonFormMode, setSeasonFormMode] = useState<'start' | 'end'>('end');
  const [showFarmActionsSheet, setShowFarmActionsSheet] = useState(false);
  const [showSeasonStartPicker, setShowSeasonStartPicker] = useState(false);
  const [showSeasonEndPicker, setShowSeasonEndPicker] = useState(false);
  const [showSeasonTargetPicker, setShowSeasonTargetPicker] = useState(false);
  const [showActiveSeasonTargetPicker, setShowActiveSeasonTargetPicker] = useState(false);
  const [isStartingSeasonFlow, setIsStartingSeasonFlow] = useState(false);
  const [isSavingActiveSeasonTargetDate, setIsSavingActiveSeasonTargetDate] = useState(false);
  const [isEditingActiveSeasonTargetIOS, setIsEditingActiveSeasonTargetIOS] = useState(false);
  const [seasonTargetHarvestDate, setSeasonTargetHarvestDate] = useState<Date | null>(null);
  const [seasonTargetHarvestDraft, setSeasonTargetHarvestDraft] = useState<Date>(new Date());
  const [guidedSeasonPhase, setGuidedSeasonPhase] = useState<
    'start_date' | 'target_date' | 'submit'
  >('start_date');
  const [activeSeasonTargetHarvestDraft, setActiveSeasonTargetHarvestDraft] = useState<Date>(
    new Date(),
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const setGuidedTourSuspended = useGuidedTourStore((s) => s.setSuspended);
  const setGuidedTourSeasonFormVisible = useGuidedTourStore((s) => s.setSeasonFormVisible);
  const setGuidedTourHasActiveSeason = useGuidedTourStore(
    (s) => s.setHasActiveSeasonForCurrentFarm,
  );
  const isGuidedAddLogStep = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
  const guidedTourSeasonAutoOpenedRef = React.useRef(false);
  const isGuidedSeasonStep =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && showSeasonForm;

  useEffect(() => {
    const isGuidedAddLog = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
    setGuidedTourSuspended(false);
    setGuidedTourSeasonFormVisible(isGuidedAddLog && showSeasonForm);
  }, [
    guidedTourStatus,
    guidedTourStep,
    setGuidedTourSeasonFormVisible,
    setGuidedTourSuspended,
    showSeasonForm,
  ]);

  useEffect(() => {
    return () => {
      setGuidedTourSuspended(false);
      setGuidedTourSeasonFormVisible(false);
    };
  }, [setGuidedTourSeasonFormVisible, setGuidedTourSuspended]);

  useEffect(() => {
    const unsub = guidedTourOn('guidedTour.seasonFormPhaseChanged', ({ phase }) => {
      setGuidedSeasonPhase(phase);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isGuidedSeasonStep) {
      setGuidedSeasonPhase('start_date');
    }
  }, [isGuidedSeasonStep]);

  const [selectedLogTypes, setSelectedLogTypes] = useState<LogTypeId[]>([]);
  const [showSeasonSuccessOverlay, setShowSeasonSuccessOverlay] = useState(false);
  const [seasonSuccessType, setSeasonSuccessType] = useState<'start' | 'end'>('end');
  const seasonSuccessScale = React.useRef(new Animated.Value(0.92)).current;
  const seasonSuccessOpacity = React.useRef(new Animated.Value(0)).current;
  const seasonSuccessTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBackNavigation = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace('/farms');
    return true;
  }, [router]);

  useEffect(() => {
    if (!isAndroid || !isFocused) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      handleBackNavigation(),
    );

    return () => subscription.remove();
  }, [handleBackNavigation, isFocused]);

  const workboardActions = useMemo<WorkboardAction[]>(() => {
    const actions: WorkboardAction[] = [
      {
        id: 'ai',
        titleKey: 'farmDetails.workboard.actions.ai',
        // Match the bottom navbar AI assistant icon.
        icon: 'brain',
        color: m3.colorScheme.primary,
      },
      {
        id: 'lab',
        titleKey: 'farmDetails.workboard.actions.lab',
        icon: 'flask.fill',
        color: m3.colorScheme.secondary,
      },
      {
        id: 'reports',
        titleKey: 'farmDetails.workboard.actions.reports',
        icon: 'receipt',
        color: m3.colorScheme.tertiary,
      },
      {
        id: 'soil',
        titleKey: 'farmDetails.workboard.actions.soilMoisture',
        icon: 'square.stack.3d.up.fill',
        color: domain.category.task,
      },
    ];
    if (profile?.consultant_organization_id) {
      actions.push({
        id: 'fertilizer-plans',
        titleKey: 'farmDetails.fertilizerPlan.title',
        icon: 'leaf.fill',
        color: domain.category.fertigation,
      });
    }
    return actions;
  }, [domain.category.fertigation, domain.category.task, m3, profile?.consultant_organization_id]);

  const seasonEndDates = useMemo(() => {
    if (!farmSeasons || farmSeasons.length === 0) return [];
    return farmSeasons
      .map((season) => season.end_date)
      .filter((date): date is string => date !== null)
      .sort((a, b) => {
        const aDate = parseDbDateToLocalDate(a);
        const bDate = parseDbDateToLocalDate(b);
        return (aDate?.getTime() ?? 0) - (bDate?.getTime() ?? 0);
      });
  }, [farmSeasons]);

  const firstSeasonStartFromSeasons = useMemo(() => {
    if (!farmSeasons || farmSeasons.length === 0) return null;
    const ordered = [...farmSeasons].sort((a, b) => {
      const aDate = parseDbDateToLocalDate(a.start_date);
      const bDate = parseDbDateToLocalDate(b.start_date);
      return (aDate?.getTime() ?? 0) - (bDate?.getTime() ?? 0);
    });
    return ordered[0]?.start_date ?? null;
  }, [farmSeasons]);

  const lastSeasonEndDate =
    seasonEndDates.length > 0 ? seasonEndDates[seasonEndDates.length - 1] : null;
  const minimumSeasonStartDate = useMemo(() => {
    if (!lastSeasonEndDate) return null;
    const nextDate = parseDbDateToLocalDate(lastSeasonEndDate);
    if (!nextDate) return null;
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }, [lastSeasonEndDate]);
  const initialSeasonStartDate = useMemo(() => {
    if (firstSeasonStartFromSeasons) return parseDbDateToLocalDate(firstSeasonStartFromSeasons);
    if (farm?.first_season_start_date) return parseDbDateToLocalDate(farm.first_season_start_date);
    if (farm?.date_of_pruning) return parseDbDateToLocalDate(farm.date_of_pruning);
    return null;
  }, [farm, firstSeasonStartFromSeasons]);
  const defaultSeasonStartDate = useMemo(() => {
    return minimumSeasonStartDate ?? initialSeasonStartDate ?? new Date();
  }, [initialSeasonStartDate, minimumSeasonStartDate]);
  const activeSeasonRecord = useMemo(() => {
    if (!farmSeasons || farmSeasons.length === 0) return null;
    return farmSeasons.find((season) => season.end_date === null) ?? null;
  }, [farmSeasons]);
  const {
    data: earliestSafeHarvest,
    isError: earliestSafeHarvestIsError,
    refetch: refetchEarliestSafeHarvest,
  } = useEarliestSafeHarvestForSeason(farmId, activeSeasonRecord?.id ?? null);
  const earliestSafeHarvestDateLabel = useMemo(() => {
    const raw = earliestSafeHarvest?.earliestDate;
    if (!raw) return null;
    const parsed = parseDbDateToLocalDate(raw);
    if (!parsed) return raw;
    return formatDate(parsed, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [earliestSafeHarvest?.earliestDate]);
  const isGrapeFarm = useMemo(
    () => isGrapeCrop(farm?.crop, farm?.crop_variety),
    [farm?.crop, farm?.crop_variety],
  );
  const lockedSeasonStartDate = useMemo(() => {
    if (!activeSeasonRecord) return null;
    return parseDbDateToLocalDate(activeSeasonRecord.start_date);
  }, [activeSeasonRecord]);
  const lastEndedSeasonStartDate = useMemo(() => {
    if (!farmSeasons || farmSeasons.length === 0) return null;
    const lastEndedSeason = [...farmSeasons]
      .filter((season) => season.end_date !== null)
      .sort((a, b) => {
        const aDate = parseDbDateToLocalDate(a.end_date ?? '');
        const bDate = parseDbDateToLocalDate(b.end_date ?? '');
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
      })[0];
    if (!lastEndedSeason) return null;
    return parseDbDateToLocalDate(lastEndedSeason.start_date);
  }, [farmSeasons]);
  const isSeasonStartLocked = seasonFormMode === 'end' && activeSeasonRecord !== null;

  const seasonMetricsStartDate = useMemo(() => {
    if (lockedSeasonStartDate) return lockedSeasonStartDate;
    if (lastEndedSeasonStartDate) return lastEndedSeasonStartDate;
    if (farm?.date_of_pruning) return parseDbDateToLocalDate(farm.date_of_pruning);
    return null;
  }, [farm?.date_of_pruning, lastEndedSeasonStartDate, lockedSeasonStartDate]);
  const seasonMetricsEndDate = useMemo(() => {
    if (activeSeasonRecord) return null;
    return lastSeasonEndDate ? parseDbDateToLocalDate(lastSeasonEndDate) : null;
  }, [activeSeasonRecord, lastSeasonEndDate]);
  const isBetweenSeasons = useMemo(() => {
    if (activeSeasonRecord) return false;
    if (!minimumSeasonStartDate) return false;
    return formatLocalDate(new Date()) < formatLocalDate(minimumSeasonStartDate);
  }, [activeSeasonRecord, minimumSeasonStartDate]);

  // Compute urgent tasks (overdue or due today)
  const urgentTasks = useMemo(() => {
    if (!tasks) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatLocalDate(today);
    return tasks.filter((task) => {
      if (task.completed) return false;
      if (!task.due_date) return false;
      const taskDate = parseDbDateToLocalDate(task.due_date);
      if (!taskDate) return false;
      taskDate.setHours(0, 0, 0, 0);
      const taskDateStr = formatLocalDate(taskDate);
      // Overdue (before today) or due today
      return taskDateStr <= todayStr;
    });
  }, [tasks]);
  const openTasks = useMemo(() => tasks?.filter((t) => !t.completed) ?? [], [tasks]);

  const seasonProgressPct = useMemo(() => {
    const start =
      lockedSeasonStartDate ??
      (farm?.date_of_pruning ? parseDbDateToLocalDate(farm.date_of_pruning) : null);
    const raw = activeSeasonRecord?.target_harvest_date;
    const end = raw ? parseDbDateToLocalDate(raw) : null;
    if (!start || !end) return null;
    const startTime = start.getTime();
    const endTime = end.getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null;
    const total = endTime - startTime;
    if (total <= 0) return null;
    const elapsed = now - startTime;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [now, lockedSeasonStartDate, farm?.date_of_pruning, activeSeasonRecord?.target_harvest_date]);

  const hasPhiConflict = useMemo(() => {
    if (!isGrapeFarm) return false;
    if (!activeSeasonRecord?.target_harvest_date) return false;
    if (!earliestSafeHarvest?.earliestDate) return false;
    const target = parseDbDateToLocalDate(activeSeasonRecord.target_harvest_date);
    const safe = parseDbDateToLocalDate(earliestSafeHarvest.earliestDate);
    if (!target || !safe) return false;
    return safe.getTime() > target.getTime();
  }, [isGrapeFarm, activeSeasonRecord?.target_harvest_date, earliestSafeHarvest?.earliestDate]);

  // "Days after pruning" should always be based on the pruning date.
  const daysSincePruning = useMemo(() => {
    if (!farm?.date_of_pruning) return null;
    const pruningDate = parseDbDateToLocalDate(farm.date_of_pruning);
    if (!pruningDate) return null;
    const today = new Date(now);
    const diffTime = today.getTime() - pruningDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }, [farm?.date_of_pruning, now]);

  const totalWaterUsed = useMemo(() => {
    if (!irrigationRecords) return null;
    const activeStartIso = seasonMetricsStartDate ? formatLocalDate(seasonMetricsStartDate) : null;
    const scopedIrrigationRecords =
      activeStartIso === null
        ? irrigationRecords
        : irrigationRecords.filter((record) => {
            const recordDate = parseDbDateToLocalDate(record.date);
            if (!recordDate) return false;
            const recordDateIso = formatLocalDate(recordDate);
            return recordDateIso >= activeStartIso;
          });
    return scopedIrrigationRecords.reduce(
      (sum, record) => sum + (record.duration || 0) * (record.system_discharge || 0),
      0,
    );
  }, [irrigationRecords, seasonMetricsStartDate]);

  const seasonExpenseTotal = useMemo(() => {
    if (!expenseRecords) return null;
    const activeStartIso = seasonMetricsStartDate ? formatLocalDate(seasonMetricsStartDate) : null;
    const activeEndIso = seasonMetricsEndDate ? formatLocalDate(seasonMetricsEndDate) : null;
    const scopedExpenseRecords =
      activeStartIso === null && activeEndIso === null
        ? expenseRecords
        : expenseRecords.filter((record) => {
            const recordDate = parseDbDateToLocalDate(record.date);
            if (!recordDate) return false;
            const recordIso = formatLocalDate(recordDate);
            return (
              (activeStartIso === null || recordIso >= activeStartIso) &&
              (activeEndIso === null || recordIso <= activeEndIso)
            );
          });
    return scopedExpenseRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  }, [expenseRecords, seasonMetricsEndDate, seasonMetricsStartDate]);

  const seasonHarvestQuantity = useMemo(() => {
    if (!harvestRecords) return null;
    const activeStartIso = seasonMetricsStartDate ? formatLocalDate(seasonMetricsStartDate) : null;
    const activeEndIso = seasonMetricsEndDate ? formatLocalDate(seasonMetricsEndDate) : null;
    const scopedHarvestRecords =
      activeStartIso === null && activeEndIso === null
        ? harvestRecords
        : harvestRecords.filter((record) => {
            const recordDate = parseDbDateToLocalDate(record.date);
            if (!recordDate) return false;
            const recordIso = formatLocalDate(recordDate);
            return (
              (activeStartIso === null || recordIso >= activeStartIso) &&
              (activeEndIso === null || recordIso <= activeEndIso)
            );
          });
    return scopedHarvestRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
  }, [harvestRecords, seasonMetricsEndDate, seasonMetricsStartDate]);

  const formatCurrencyCompact = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return formatCurrency(value, currency, {
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    });
  };

  const formatHarvestQuantity = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    if (value >= 1000) {
      return t('farmDetails.harvest.quantityTon', {
        value: (value / 1000).toFixed(value >= 10000 ? 0 : 1),
      });
    }
    return t('farmDetails.harvest.quantityKg', {
      value: value.toFixed(value >= 100 ? 0 : 1),
    });
  };

  const formatWaterUsage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return t('farmDetails.water.noIrrigationLoggedYet');
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return t('farmDetails.water.mmUsed', { value: value.toFixed(digits) });
  };

  const formatWaterDepth = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '--';
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return t('farmDetails.water.mmDepth', { value: value.toFixed(digits) });
  };

  const waterUsageCaption =
    isBetweenSeasons && minimumSeasonStartDate
      ? t('farmDetails.seasons.betweenSeasonsHint', {
          date: formatDate(minimumSeasonStartDate, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        })
      : totalWaterUsed !== null
        ? t('farmDetails.water.captionThisSeason', { usage: formatWaterUsage(totalWaterUsed) })
        : t('farmDetails.water.captionLogIrrigation');
  const remainingSoilWater = farm?.remaining_water;

  const getInitialSeasonEndDate = React.useCallback((startDate: Date) => {
    const today = new Date();
    if (today.getTime() < startDate.getTime()) {
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return nextDay;
    }
    return today;
  }, []);

  const [seasonStartDate, setSeasonStartDate] = useState(defaultSeasonStartDate);
  const [seasonEndDate, setSeasonEndDate] = useState(
    getInitialSeasonEndDate(defaultSeasonStartDate),
  );

  React.useEffect(() => {
    setSeasonStartDate(defaultSeasonStartDate);
    setSeasonEndDate(getInitialSeasonEndDate(defaultSeasonStartDate));
  }, [defaultSeasonStartDate, getInitialSeasonEndDate]);

  React.useEffect(() => {
    if (!seasonTargetHarvestDate) return;
    if (seasonTargetHarvestDate.getTime() >= seasonStartDate.getTime()) return;
    setSeasonTargetHarvestDate(seasonStartDate);
    setSeasonTargetHarvestDraft(seasonStartDate);
  }, [seasonStartDate, seasonTargetHarvestDate]);

  const formattedSeasonStart = formatDate(seasonStartDate, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const effectiveSeasonStartDate = lockedSeasonStartDate ?? seasonStartDate;
  const formattedEffectiveSeasonStart = formatDate(effectiveSeasonStartDate, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedSeasonEnd = formatDate(seasonEndDate, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const showSeasonSuccess = React.useCallback(
    (type: 'start' | 'end') => {
      setSeasonSuccessType(type);
      setShowSeasonSuccessOverlay(true);
      seasonSuccessScale.setValue(0.92);
      seasonSuccessOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(seasonSuccessScale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(seasonSuccessOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      if (seasonSuccessTimerRef.current) {
        clearTimeout(seasonSuccessTimerRef.current);
      }
      seasonSuccessTimerRef.current = setTimeout(() => {
        Animated.timing(seasonSuccessOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setShowSeasonSuccessOverlay(false);
        });
      }, 1700);
    },
    [seasonSuccessOpacity, seasonSuccessScale],
  );

  const handleStartSeason = async () => {
    if (!farm?.id) return;
    if (isStartingSeasonFlow) return;
    if (activeSeasonRecord) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.activeSeasonExists'));
      return;
    }
    if (
      minimumSeasonStartDate &&
      formatLocalDate(seasonStartDate) < formatLocalDate(minimumSeasonStartDate)
    ) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.startBeforeAllowed'));
      return;
    }

    setIsStartingSeasonFlow(true);
    try {
      const createdSeason = await startFarmSeason.mutateAsync({
        farmId: farm.id,
        startDate: formatLocalDate(seasonStartDate),
        seasonName: null,
        cropTypeSnapshot: farm.crop_variety || farm.crop || null,
        configJson: {
          source: 'mobile',
          mode: 'manual',
        },
      });
      if (seasonTargetHarvestDate) {
        if (typeof createdSeason?.id !== 'number') {
          Alert.alert(
            t('common.warning', { defaultValue: 'Warning' }),
            t('entryForm.phiErrors.targetDateSavePartial', {
              defaultValue:
                'Season started successfully, but target harvest date was not saved. You can edit the season to set it now.',
            }),
          );
        } else {
          try {
            await updateSeasonTargetHarvestDate.mutateAsync({
              id: createdSeason.id,
              farmId: farm.id,
              targetHarvestDate: formatLocalDate(seasonTargetHarvestDate),
            });
          } catch {
            Alert.alert(
              t('common.warning', { defaultValue: 'Warning' }),
              t('entryForm.phiErrors.targetDateSavePartial', {
                defaultValue:
                  'Season started successfully, but target harvest date was not saved. You can edit the season to set it now.',
              }),
            );
          }
        }
      }
      await refetchSeasons();
      triggerHapticSuccess();
      setShowSeasonForm(false);
      setShowSeasonStartPicker(false);
      setShowSeasonEndPicker(false);
      setShowSeasonTargetPicker(false);
      showSeasonSuccess('start');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('farmDetails.seasons.errors.startFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsStartingSeasonFlow(false);
    }
  };

  const handleEndSeason = async () => {
    if (!farm?.id) return;
    if (!activeSeasonRecord) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.noActiveSeason'));
      return;
    }
    const effectiveStartDate = lockedSeasonStartDate ?? seasonStartDate;
    if (formatLocalDate(seasonEndDate) < formatLocalDate(effectiveStartDate)) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.invalidRange'));
      return;
    }
    if (
      minimumSeasonStartDate &&
      formatLocalDate(effectiveStartDate) < formatLocalDate(minimumSeasonStartDate)
    ) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.startBeforeAllowed'));
      return;
    }

    const endDateIso = formatLocalDate(seasonEndDate);
    if (seasonEndDates.includes(endDateIso)) {
      Alert.alert(t('common.error'), t('farmDetails.seasons.errors.duplicateEndDate'));
      return;
    }

    try {
      await endFarmSeason.mutateAsync({
        farmId: farm.id,
        endDate: endDateIso,
      });
      await refetchSeasons();

      triggerHapticSuccess();
      setShowSeasonForm(false);
      setShowSeasonStartPicker(false);
      setShowSeasonEndPicker(false);
      showSeasonSuccess('end');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        Alert.alert(t('common.error'), t('farmDetails.seasons.errors.duplicateEndDate'));
        return;
      }
      const message =
        error instanceof Error ? error.message : t('farmDetails.seasons.errors.endFailed');
      Alert.alert(t('common.error'), message);
    }
  };

  const handleOpenFarmActions = () => {
    if (!farm) return;
    const seasonActionLabel = activeSeasonRecord
      ? t('farmDetails.actions.endSeason')
      : t('farmDetails.actions.startSeason');
    if (isAndroid) {
      setShowFarmActionsSheet(true);
      return;
    }
    const actions = [
      {
        text: t('farmDetails.actions.editFarm'),
        onPress: () => {
          if (!farmIdParam) return;
          router.push(`/farm/${farmIdParam}/edit`);
        },
      },
      {
        text: seasonActionLabel,
        onPress: () => {
          closeSeasonForm();
          setSeasonFormMode(activeSeasonRecord ? 'end' : 'start');
          setShowSeasonForm(true);
        },
      },
    ];
    if (needsSeasonReview && typeof farm?.id === 'number') {
      const reviewFarmId = farm.id;
      actions.push({
        text: t('farmDetails.actions.reviewSeasonHistory'),
        onPress: async () => {
          try {
            await recomputeSeasonAssignments.mutateAsync({ farmId: reviewFarmId });
            toast.success(t('farmDetails.seasons.alerts.reviewQueuedSuccess'));
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : t('farmDetails.seasons.errors.reviewQueueFailed');
            Alert.alert(t('common.error'), message);
          }
        },
      });
    }
    Alert.alert(t('farmDetails.actions.menuTitle'), farm.name, [
      ...actions,
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: handleDeleteFarm,
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openEditFarm = () => {
    setShowFarmActionsSheet(false);
    if (!farmIdParam) return;
    router.push(`/farm/${farmIdParam}/edit`);
  };

  const closeSeasonForm = React.useCallback(() => {
    setShowSeasonForm(false);
    setShowSeasonStartPicker(false);
    setShowSeasonEndPicker(false);
    setShowSeasonTargetPicker(false);
    setSeasonTargetHarvestDate(null);
    setSeasonTargetHarvestDraft(new Date());
    guidedTourEmit('guidedTour.seasonFormPhaseChanged', { phase: 'start_date' });
  }, []);

  useEffect(() => {
    if (!isFocused && showSeasonForm) {
      closeSeasonForm();
    }
  }, [isFocused, showSeasonForm, closeSeasonForm]);

  useEffect(() => {
    if (activeSeasonRecord && seasonFormMode === 'start' && showSeasonForm) {
      closeSeasonForm();
    }
  }, [activeSeasonRecord, seasonFormMode, showSeasonForm, closeSeasonForm]);

  const dismissSeasonSuccessOverlay = React.useCallback(() => {
    if (seasonSuccessTimerRef.current) {
      clearTimeout(seasonSuccessTimerRef.current);
      seasonSuccessTimerRef.current = null;
    }
    Animated.timing(seasonSuccessOpacity, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowSeasonSuccessOverlay(false);
    });
  }, [seasonSuccessOpacity]);

  React.useEffect(() => {
    return () => {
      if (seasonSuccessTimerRef.current) {
        clearTimeout(seasonSuccessTimerRef.current);
      }
    };
  }, []);

  const openSeasonForm = (mode: 'start' | 'end') => {
    setShowFarmActionsSheet(false);
    setIsEditingActiveSeasonTargetIOS(false);
    setShowActiveSeasonTargetPicker(false);
    closeSeasonForm();
    setSeasonFormMode(mode);
    setShowSeasonForm(true);
    if (mode === 'start') {
      guidedTourEmit('guidedTour.seasonFormPhaseChanged', { phase: 'start_date' });
    }
  };

  const openStartSeasonForm = () => {
    openSeasonForm('start');
  };

  const openEndSeasonForm = () => {
    openSeasonForm('end');
  };

  const normalizeActiveSeasonTargetDate = React.useCallback(
    (value: Date | null): Date | null => {
      if (!value) return null;
      const seasonStartDate = parseDbDateToLocalDate(activeSeasonRecord?.start_date ?? '') ?? null;
      if (!seasonStartDate) return value;
      return value.getTime() < seasonStartDate.getTime() ? seasonStartDate : value;
    },
    [activeSeasonRecord?.start_date],
  );

  const saveActiveSeasonTargetHarvestDate = async (value: Date | null): Promise<boolean> => {
    if (!farm?.id || !activeSeasonRecord?.id) return false;
    if (isSavingActiveSeasonTargetDate) return false;
    const finalValue = normalizeActiveSeasonTargetDate(value);
    if (value && finalValue && value.getTime() !== finalValue.getTime()) {
      Alert.alert(
        t('common.error'),
        t('farmDetails.seasons.errors.targetBeforeSeasonStart', {
          defaultValue: 'Target harvest date cannot be before season start date.',
        }),
      );
      return false;
    }
    setIsSavingActiveSeasonTargetDate(true);
    try {
      await updateSeasonTargetHarvestDate.mutateAsync({
        id: activeSeasonRecord.id,
        farmId: farm.id,
        targetHarvestDate: finalValue ? formatLocalDate(finalValue) : null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('entryForm.phiErrors.targetDateSaveFailed', {
              defaultValue: 'Unable to save target harvest date. Please try again.',
            });
      Alert.alert(t('common.error'), message);
      return false;
    } finally {
      setIsSavingActiveSeasonTargetDate(false);
    }
  };

  const openActiveSeasonTargetEditor = () => {
    if (isSavingActiveSeasonTargetDate) return;
    const parsed = activeSeasonRecord?.target_harvest_date
      ? parseDbDateToLocalDate(activeSeasonRecord.target_harvest_date)
      : null;
    const draft = parsed ?? new Date();
    setActiveSeasonTargetHarvestDraft(draft);
    if (isIOS) {
      setIsEditingActiveSeasonTargetIOS(true);
      return;
    }
    // Android: Show Alert with options to Pick New Date or Clear Date
    const hasExistingDate = Boolean(activeSeasonRecord?.target_harvest_date);
    if (hasExistingDate) {
      Alert.alert(t('farmDetails.header.targetLabel'), undefined, [
        {
          text: t('farmDetails.header.pickNewDate'),
          onPress: () => setShowActiveSeasonTargetPicker(true),
        },
        {
          text: t('farmDetails.header.clearDate'),
          style: 'destructive',
          onPress: () => {
            void saveActiveSeasonTargetHarvestDate(null);
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      setShowActiveSeasonTargetPicker(true);
    }
  };

  useEffect(() => {
    const isGuidedAddLog = guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log';
    if (!isGuidedAddLog) {
      guidedTourSeasonAutoOpenedRef.current = false;
      setGuidedTourHasActiveSeason(null);
      return;
    }
    if (isSeasonsLoading || farmSeasons === undefined) return;
    setGuidedTourHasActiveSeason(Boolean(activeSeasonRecord));
    if (activeSeasonRecord) {
      guidedTourSeasonAutoOpenedRef.current = false;
    }
    if (!activeSeasonRecord && !showSeasonForm && !guidedTourSeasonAutoOpenedRef.current) {
      guidedTourSeasonAutoOpenedRef.current = true;
      openStartSeasonForm();
    }
    // `openStartSeasonForm` is intentionally omitted; we only need the latest implementation when this branch fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSeasonRecord,
    farmSeasons,
    guidedTourStatus,
    guidedTourStep,
    setGuidedTourHasActiveSeason,
    showSeasonForm,
    isSeasonsLoading,
  ]);

  const confirmDeleteFarmFromSheet = () => {
    setShowFarmActionsSheet(false);
    handleDeleteFarm();
  };

  // Activity logs - combine, filter, and sort
  const RECENT_ACTIVITY_LIMIT = 5;
  const allLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: LogTypeId;
      date: string;
      data:
        | IrrigationRecord
        | SprayRecord
        | HarvestRecord
        | ExpenseRecord
        | FertigationRecord
        | DailyNoteRecord;
    }> = [];

    irrigationRecords?.forEach((r) =>
      logs.push({
        id: `irrigation-${r.id}`,
        type: 'irrigation',
        date: r.date,
        data: r,
      }),
    );
    sprayRecords?.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        data: r,
      }),
    );
    harvestRecords?.forEach((r) =>
      logs.push({
        id: `harvest-${r.id}`,
        type: 'harvest',
        date: r.date,
        data: r,
      }),
    );
    expenseRecords?.forEach((r) =>
      logs.push({
        id: `expense-${r.id}`,
        type: 'expense',
        date: r.date,
        data: r,
      }),
    );
    fertigationRecords?.forEach((r) =>
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        data: r,
      }),
    );
    dailyNotes?.forEach((r) =>
      logs.push({
        id: `note-${r.id}`,
        type: 'note',
        date: r.date,
        data: r,
      }),
    );

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    irrigationRecords,
    sprayRecords,
    harvestRecords,
    expenseRecords,
    fertigationRecords,
    dailyNotes,
  ]);

  // Filter logs by selected types
  const filteredLogs = useMemo(() => {
    if (selectedLogTypes.length === 0) return allLogs;
    return allLogs.filter((log) => selectedLogTypes.includes(log.type));
  }, [allLogs, selectedLogTypes]);
  const hasActiveLogTypeFilters = selectedLogTypes.length > 0;

  // Get recent filtered logs
  const recentLogs = useMemo(() => {
    return filteredLogs.slice(0, RECENT_ACTIVITY_LIMIT);
  }, [filteredLogs]);

  // Toggle log type filter
  const toggleLogTypeFilter = (type: LogTypeId) => {
    setSelectedLogTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchFarm(),
        refetchRecords(),
        refetchTasks(),
        refetchSeasons(),
        refetchEarliestSafeHarvest(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddActivity = async () => {
    if (!farm?.id) return;
    if (!activeSeasonRecord) {
      const refreshedSeasons = await refetchSeasons();
      const refreshedActiveSeason =
        refreshedSeasons.data?.find((season) => season.end_date === null) ?? null;
      if (refreshedActiveSeason) {
        router.push(createAddLogHref({ farmId: farm.id, lockFarmSelection: true }));
        return;
      }

      if (guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log') {
        if (isSeasonsLoading) return;
        openStartSeasonForm();
        return;
      }
      Alert.alert(
        t('farmDetails.seasons.errors.noActiveSeason'),
        t('farmDetails.seasons.actions.startSeasonToContinue'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('farmDetails.actions.startSeason'), onPress: openStartSeasonForm },
        ],
      );
      return;
    }
    router.push(createAddLogHref({ farmId: farm.id, lockFarmSelection: true }));
  };

  const handleAddTask = () => {
    if (!farm?.id) return;
    setAddEntry({
      tabs: ['task'],
      initialTab: 'task',
      initialFarmId: farm.id,
    });
    router.push({
      pathname: '/add-entry',
      params: {
        tabs: 'task',
        initialTab: 'task',
        farmId: farm.id.toString(),
        lockFarmSelection: 'true',
      },
    });
  };

  const handleEditActivity = (log: (typeof recentLogs)[number]) => {
    if (!farm) return;
    if (log.type === 'note') {
      router.push({ pathname: '/add-note', params: { farmId: String(farm.id), date: log.date } });
      return;
    }
    const record = log.data as Exclude<typeof log.data, DailyNoteRecord>;
    setEditActivity({
      farm,
      logType: log.type,
      record,
    });
    router.push(`/log-entry/edit/${log.id}`);
  };

  const handleDeleteActivity = (log: (typeof recentLogs)[number]) => {
    triggerHapticWarning();
    Alert.alert(
      t('logs.delete.title'),
      t('logs.delete.body', {
        type: t(`logs.types.${log.type}`),
        date: formatDate(new Date(log.date), { month: 'short', day: 'numeric' }),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const record = log.data as
                | IrrigationRecord
                | SprayRecord
                | HarvestRecord
                | ExpenseRecord
                | FertigationRecord;
              const farmIdNum =
                farm?.id ??
                (record.farm_id
                  ? typeof record.farm_id === 'string'
                    ? parseInt(record.farm_id, 10)
                    : record.farm_id
                  : undefined);

              if (!farmIdNum) {
                Alert.alert(t('common.error'), t('common.errors.cannotDeleteLogFarmIdNotFound'));
                return;
              }

              switch (log.type) {
                case 'irrigation': {
                  const r = record as IrrigationRecord;
                  if (r.id) await deleteIrrigation.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'spray': {
                  const r = record as SprayRecord;
                  if (r.id) await deleteSpray.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'harvest': {
                  const r = record as HarvestRecord;
                  if (r.id) await deleteHarvest.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'expense': {
                  const r = record as ExpenseRecord;
                  if (r.id) await deleteExpense.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'fertigation': {
                  const r = record as FertigationRecord;
                  if (r.id) await deleteFertigation.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
              }
            } catch (_error) {
              Alert.alert(t('common.error'), t('common.errors.failedToDeleteLog'));
            }
          },
        },
      ],
    );
  };

  const handleCompleteTask = (taskId: number) => {
    Alert.alert(t('tasks.alerts.completeTitle'), t('tasks.alerts.completeBodyGeneric'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.complete'),
        onPress: () => {
          completeMutation.mutate(taskId, {
            onSuccess: () => {
              void cleanupTaskNotifications(taskId);
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert(
                t('common.error'),
                error.message || t('farmDetails.errors.completeTaskFailed'),
              );
            },
          });
        },
      },
    ]);
  };

  const handleDeleteTask = (taskId: number, taskTitle: string) => {
    triggerHapticWarning();
    Alert.alert(t('tasks.alerts.deleteTitle'), t('tasks.alerts.deleteBody', { title: taskTitle }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(taskId, {
            onSuccess: () => {
              void cleanupTaskNotifications(taskId);
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert(
                t('common.error'),
                error.message || t('farmDetails.errors.deleteTaskFailed'),
              );
            },
          });
        },
      },
    ]);
  };

  const handleLogFromTask = (task: TaskReminder) => {
    if (!task.id || (task.type !== 'spray' && task.type !== 'fertigation')) return;
    const planned =
      task.planned_inputs && task.planned_inputs.length > 0
        ? task.planned_inputs
        : decodeTaskPlanFromDescription(task.description);
    setAddEntry({
      tabs: ['log'],
      initialTab: 'log',
      initialFarmId: task.farm_id,
      initialLogType: task.type,
      sourceTaskId: task.id,
      logPrefill:
        task.type === 'spray'
          ? { sprayChemicals: planned }
          : {
              fertigationItems: planned,
            },
    });
    router.push({
      pathname: '/add-entry',
      params: {
        tabs: 'log',
        initialTab: 'log',
        farmId: String(task.farm_id),
        initialLogType: task.type,
      },
    });
  };

  const handleDeleteFarm = () => {
    if (!farmId || !farm) return;
    triggerHapticWarning();
    Alert.alert(
      t('farmDetails.deleteFarmTitle'),
      t('farmDetails.deleteFarmBody', { name: farm.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            telemetry.capture('farm_delete_confirmed', {
              farm_id: farmId,
            });
            deleteFarmMutation.mutate(farmId, {
              onSuccess: () => {
                telemetry.capture('farm_deleted', {
                  farm_id: farmId,
                });
                router.replace('/farms');
              },
              onError: (error: Error) => {
                const normalized = `${error.name ?? ''} ${error.message ?? ''}`.toLowerCase();
                const errorCategory = normalized.includes('not found')
                  ? 'NOT_FOUND'
                  : normalized.includes('invalid') || normalized.includes('validation')
                    ? 'VALIDATION'
                    : normalized.includes('network') || normalized.includes('timeout')
                      ? 'NETWORK'
                      : 'SERVER_ERROR';
                telemetry.capture('farm_delete_failed', {
                  farm_id: farmId,
                  error_category: errorCategory,
                });
                Alert.alert(
                  t('common.error'),
                  error.message || t('farmDetails.errors.deleteFarmFailed'),
                );
              },
            });
          },
        },
      ],
    );
  };

  const handleWorkboardAction = (action: WorkboardAction) => {
    triggerHapticMedium();
    switch (action.id) {
      case 'ai':
        if (!farmIdParam) return;
        // Use `navigate` here (instead of `push`) to avoid occasional unmatched-route
        // resolution issues when switching from Stack -> tabs group.
        router.navigate(`/(tabs)/assistant?farmId=${encodeURIComponent(farmIdParam)}`);
        break;
      case 'lab':
        if (!farmIdParam) return;
        router.push(`/lab-tests?farmId=${encodeURIComponent(farmIdParam)}`);
        break;
      case 'reports':
        router.push('/reports');
        break;
      case 'soil':
        if (!farmIdParam) return;
        router.push(`/soil-profiling?farmId=${encodeURIComponent(farmIdParam)}`);
        break;
      case 'fertilizer-plans':
        if (!farmIdParam) return;
        router.push({ pathname: '/fertilizer-plans', params: { farmId: farmIdParam } });
        break;
    }
  };

  if (farmLoading && !farm) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: m3.colorScheme.surface,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[4] }}>
            {t('farmDetails.loadingFarm')}
          </Text>
        </View>
      </>
    );
  }

  if (!farm) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: m3.colorScheme.surface,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          }}
        >
          <UiSymbol
            name="alert-circle-outline"
            size={48}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          />
          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              marginTop: spacing[4],
            }}
          >
            {t('farmDetails.notFound.title')}
          </Text>
          <View style={{ marginTop: spacing[4], width: '100%', maxWidth: 320 }}>
            <Button title={t('common.goBack')} variant="outline" onPress={() => router.back()} />
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={handleBackNavigation}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UiSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {farm.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.xs }}
              >
                {farm.region ||
                  farm.location_name ||
                  t('farmDetails.header.locationUnknown', { defaultValue: 'Location not set' })}
                {' · '}
                {farm.crop_variety || farm.crop}
                {daysSincePruning !== null
                  ? ` · ${t('farmDetails.pruning.daysShort', { count: daysSincePruning })}`
                  : ''}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleOpenFarmActions}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('farmDetails.a11y.openFarmActions')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UiSymbol name="ellipsis" size={18} color={m3.colorScheme.onSurfaceVariant} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={!isGuidedAddLogStep}
          contentContainerStyle={{
            paddingTop: 0,
            paddingBottom: spacing[6],
          }}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={m3.colorScheme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Season Strip Card — progress bar from pruning to target harvest */}
          {activeSeasonRecord && seasonProgressPct !== null && (
            <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
              <View
                style={{
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                  borderRadius: borderRadius.md,
                  padding: spacing[4],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: m3.surface.s500,
                    }}
                  >
                    {t('farmDetails.seasonStrip.title', { defaultValue: 'Season' })}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {100 - seasonProgressPct}%{' '}
                    {t('farmDetails.seasonStrip.toHarvest', { defaultValue: 'to harvest' })}
                  </Text>
                </View>

                {/* Progress track with dot marker */}
                <View style={{ height: 20, marginTop: spacing[4], position: 'relative' }}>
                  {/* Empty track */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 7,
                      height: 6,
                      backgroundColor: m3.surface.s200,
                      borderRadius: borderRadius.full,
                    }}
                  />
                  {/* Filled portion */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 7,
                      height: 6,
                      width: `${seasonProgressPct}%`,
                      backgroundColor: m3.colorScheme.primary,
                      borderRadius: borderRadius.full,
                    }}
                  />
                  {/* Current day marker dot */}
                  <View
                    style={{
                      position: 'absolute',
                      left: `${Math.min(seasonProgressPct, 97)}%`,
                      top: 3,
                      transform: [{ translateX: -7 }],
                      width: 14,
                      height: 14,
                      borderRadius: radius.sm,
                      backgroundColor: m3.surface.s100,
                      borderWidth: 2,
                      borderColor: m3.colorScheme.warning,
                    }}
                  />
                </View>

                {/* Milestone labels */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: spacing[2],
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: fontSize['2xs'],
                        fontWeight: fontWeight.bold,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        color: m3.surface.s500,
                      }}
                    >
                      {t('farmDetails.seasonStrip.pruning', { defaultValue: 'Pruning' })}
                    </Text>
                    <Text
                      style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 2 }}
                    >
                      {effectiveSeasonStartDate
                        ? formatDate(effectiveSeasonStartDate, { month: 'short', day: 'numeric' })
                        : '—'}
                    </Text>
                  </View>
                  {daysSincePruning !== null && (
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: fontSize['2xs'],
                          fontWeight: fontWeight.bold,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          color: m3.surface.s500,
                        }}
                      >
                        {t('farmDetails.seasonStrip.today', { defaultValue: 'Today' })}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.bold,
                          marginTop: 2,
                          color: m3.colorScheme.warning,
                        }}
                      >
                        {t('farmDetails.pruning.daysShort', { count: daysSincePruning })}
                      </Text>
                    </View>
                  )}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontSize: fontSize['2xs'],
                        fontWeight: fontWeight.bold,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        color: m3.surface.s500,
                      }}
                    >
                      {t('farmDetails.seasonStrip.target', { defaultValue: 'Target' })}
                    </Text>
                    <Pressable
                      onPress={openActiveSeasonTargetEditor}
                      accessibilityRole="button"
                      accessibilityLabel={t('farmDetails.a11y.editTargetDate', {
                        defaultValue: 'Edit target harvest date',
                      })}
                      disabled={isSavingActiveSeasonTargetDate}
                    >
                      <Text
                        style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 2 }}
                      >
                        {activeSeasonRecord.target_harvest_date
                          ? formatDate(
                              parseDbDateToLocalDate(activeSeasonRecord.target_harvest_date) ??
                                new Date(activeSeasonRecord.target_harvest_date),
                              { month: 'short', day: 'numeric' },
                            )
                          : t('farmDetails.seasonStrip.setTarget', {
                              defaultValue: 'Set target',
                            })}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Vital Signs — Soil Water + Weather */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: m3.surface.s500,
                marginBottom: spacing[2],
              }}
            >
              {t('farmDetails.vitalSigns.title', { defaultValue: 'Vital signs' })}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              {/* Soil Water Card */}
              <Pressable
                style={({ pressed: _pressed }) => ({
                  flex: 1,
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                })}
                onPress={() => {
                  if (!farm?.id) return;
                  router.push({
                    pathname: '/water-level',
                    params: { farmId: farm.id.toString() },
                  });
                }}
                accessibilityRole="button"
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize['2xs'],
                      fontWeight: fontWeight.bold,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: m3.surface.s500,
                    }}
                  >
                    {t('farmDetails.stats.soilWaterTitle')}
                  </Text>
                  <UiSymbol name="water" size={14} color={domain.category.irrigation} />
                </View>
                <Text
                  style={{
                    color:
                      remainingSoilWater != null && remainingSoilWater >= 0
                        ? domain.category.irrigation
                        : m3.colorScheme.error,
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    marginTop: spacing[1],
                  }}
                >
                  {formatWaterDepth(remainingSoilWater)}
                </Text>
                <Text
                  style={{
                    color: m3.surface.s400,
                    fontSize: fontSize.xs,
                    lineHeight: 14,
                    marginTop: spacing[1],
                  }}
                >
                  {waterUsageCaption}
                </Text>
              </Pressable>

              {/* Weather Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize['2xs'],
                      fontWeight: fontWeight.bold,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: m3.surface.s500,
                    }}
                  >
                    {t('farmDetails.vitalSigns.weather', { defaultValue: 'Weather' })}
                  </Text>
                  <UiSymbol name="partly-sunny" size={14} color={m3.colorScheme.warning} />
                </View>
                {weather?.current ? (
                  <>
                    <Text
                      style={{
                        color: m3.surface.s900,
                        fontSize: fontSize.xl,
                        fontWeight: fontWeight.bold,
                        marginTop: spacing[1],
                      }}
                    >
                      {weather.current.temperature}°C
                    </Text>
                    <Text
                      style={{
                        color: m3.surface.s400,
                        fontSize: fontSize.xs,
                        lineHeight: 14,
                        marginTop: spacing[1],
                      }}
                    >
                      {weather.current.condition}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      color: m3.surface.s500,
                      fontSize: fontSize.xl,
                      fontWeight: fontWeight.bold,
                      marginTop: spacing[1],
                    }}
                  >
                    --
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* PHI Conflict Banner — only shown when spray PHI pushes earliest safe harvest past target */}
          {hasPhiConflict && earliestSafeHarvestDateLabel && (
            <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[3] }}>
              <View
                style={{
                  padding: spacing[3],
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.error, 0.3),
                  borderRadius: borderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                <UiSymbol name="warning" size={16} color={m3.colorScheme.error} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.error,
                    }}
                  >
                    {t('farmDetails.phiConflict.title', {
                      defaultValue: 'Spray PHI delays harvest',
                    })}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                    {t('farmDetails.phiConflict.subtitle', {
                      defaultValue: 'Earliest safe: {{date}} — review spray schedule',
                      date: earliestSafeHarvestDateLabel,
                    })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Harvest-status unverified advisory — calm "needs attention", distinct
              from the red PHI-conflict banner above. Fail-closed: shown when season
              sprays are unmapped so "no conflict banner" never implies "safe". */}
          {isGrapeFarm && earliestSafeHarvest?.status === 'unverified' && !hasPhiConflict && (
            <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[3] }}>
              <View
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={t('farmDetails.harvestUnverified.a11y', {
                  count: earliestSafeHarvest.unverifiedCount,
                  defaultValue_one:
                    'Harvest safety not yet verified. {{count}} spray not yet mapped to label data.',
                  defaultValue_other:
                    'Harvest safety not yet verified. {{count}} sprays not yet mapped to label data.',
                })}
                style={{
                  padding: spacing[3],
                  backgroundColor: m3.colorScheme.warningContainer,
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.warning, 0.4),
                  borderRadius: borderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                <UiSymbol name="info.circle" size={16} color={m3.colorScheme.warning} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onWarningContainer,
                    }}
                  >
                    {t('farmDetails.harvestUnverified.title', {
                      defaultValue: 'Harvest safety not yet verified',
                    })}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onWarningContainer,
                      marginTop: 2,
                    }}
                  >
                    {t('farmDetails.harvestUnverified.subtitle', {
                      count: earliestSafeHarvest.unverifiedCount,
                      defaultValue_one: '{{count}} spray not yet mapped to label data',
                      defaultValue_other: '{{count}} sprays not yet mapped to label data',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Harvest check failed (most often offline) and we have no verdict to
              show. Say so honestly and let them retry, rather than leaving the area
              blank — which could read as "all clear". Dependency-free: driven off
              the query error state (no NetInfo wired in this app). */}
          {isGrapeFarm && earliestSafeHarvestIsError && !earliestSafeHarvest && (
            <Pressable
              onPress={() => refetchEarliestSafeHarvest()}
              accessibilityRole="button"
              accessibilityLabel={t('farmDetails.harvestCheckUnavailable.a11y', {
                defaultValue: "Can't check harvest safety right now. Double tap to retry.",
              })}
              style={{ paddingHorizontal: spacing[4], marginTop: spacing[3] }}
            >
              <View
                style={{
                  padding: spacing[3],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  borderRadius: borderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                <UiSymbol
                  name="arrow.clockwise"
                  size={16}
                  color={m3.colorScheme.onSurfaceVariant}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {t('farmDetails.harvestCheckUnavailable.title', {
                      defaultValue: "Can't check harvest safety right now",
                    })}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: m3.colorScheme.onSurfaceVariant,
                      marginTop: 2,
                    }}
                  >
                    {t('farmDetails.harvestCheckUnavailable.subtitle', {
                      defaultValue: 'Tap to retry',
                    })}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}

          {urgentTasks.length > 0 && (
            <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[3] }}>
              <Pressable
                onPress={() => {
                  if (!farm?.id) return;
                  router.push({ pathname: '/tasks', params: { farmId: farm.id.toString() } });
                }}
                accessibilityRole="button"
                accessibilityLabel={t('farmDetails.a11y.viewUrgentTasks', {
                  defaultValue: 'View urgent tasks',
                })}
                style={({ pressed }) => ({
                  padding: spacing[3],
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.warning, 0.16)
                    : colorWithOpacity(m3.colorScheme.warning, 0.1),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.warning, 0.3),
                  borderRadius: borderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                })}
              >
                <UiSymbol
                  name="exclamationmark.triangle.fill"
                  size={16}
                  color={m3.colorScheme.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.warning,
                    }}
                  >
                    {t('farmDetails.riskBlock.urgentTasks', { count: urgentTasks.length })}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                    {t('farmDetails.tasks.urgentHint', {
                      defaultValue: 'Review due and overdue work before logging more activity.',
                    })}
                  </Text>
                </View>
                <Text
                  style={{
                    color: m3.colorScheme.primary,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {t('common.view')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Workboard Section */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.labelSmall,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
                marginBottom: spacing[1],
              }}
            >
              {t('farmDetails.workboard.title')}
            </Text>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginBottom: spacing[2],
              }}
            >
              {t('farmDetails.workboard.subtitle')}
            </Text>

            <View
              style={{
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[4],
                marginTop: spacing[2],
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {workboardActions.map((action) => (
                  <Pressable
                    key={action.id}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: spacing[2] }}
                    onPress={() => handleWorkboardAction(action)}
                    accessibilityRole="button"
                    accessibilityLabel={t(action.titleKey)}
                  >
                    {({ pressed }) => (
                      <View
                        style={{
                          alignItems: 'center',
                          borderRadius: m3.shape.cornerMedium,
                          overflow: 'hidden',
                          paddingHorizontal: spacing[2],
                          paddingVertical: spacing[2],
                        }}
                      >
                        <View
                          style={{
                            borderRadius: radius.xl,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: spacing[1] + 1,
                            width: 40,
                            height: 40,
                            backgroundColor: colorWithOpacity(action.color, 0.12),
                          }}
                        >
                          <UiSymbol name={action.icon} size={18} color={action.color} />
                        </View>
                        <Text
                          style={{
                            color: m3.surface.s500,
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.medium,
                            textAlign: 'center',
                            lineHeight: 14,
                          }}
                        >
                          {t(action.titleKey)}
                        </Text>
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              backgroundColor: pressed
                                ? colorWithOpacity(
                                    m3.colorScheme.onSurface,
                                    m3.stateLayerOpacity.pressed,
                                  )
                                : 'transparent',
                            },
                          ]}
                        />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Open Tasks Section */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[6],
            }}
          >
            {/* Section header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: m3.surface.s500,
                  }}
                >
                  {t('farmDetails.sections.openTasks', { defaultValue: 'Open tasks' })}
                </Text>
                {openTasks.length > 0 && (
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s500,
                      marginLeft: 4,
                    }}
                  >
                    · {openTasks.length}
                  </Text>
                )}
              </View>
              {farm?.id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                  <Pressable
                    onPress={handleAddTask}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmDetails.actions.addTask')}
                    hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: m3.shape.cornerSmall,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    })}
                  >
                    <UiSymbol name="plus" size={13} color={m3.colorScheme.primary} />
                    <Text
                      style={{
                        color: m3.colorScheme.primary,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.actions.addTask')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!farm?.id) return;
                      router.push({
                        pathname: '/tasks',
                        params: { farmId: farm.id.toString() },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmDetails.actions.seeAllTasks')}
                    hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: m3.shape.cornerSmall,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        color: m3.colorScheme.primary,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.actions.seeAllTasks')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Task rows */}
            {openTasks.length > 0 ? (
              <View
                style={{
                  gap: spacing[3],
                }}
              >
                {openTasks.slice(0, OPEN_TASKS_PREVIEW_LIMIT).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showFarmName={false}
                    onComplete={(item) => {
                      if (!item.id) return;
                      handleCompleteTask(item.id);
                    }}
                    onEdit={(item) => {
                      setAddEntry({
                        tabs: ['task'],
                        initialTab: 'task',
                        editingTask: item,
                      });
                      router.push({
                        pathname: '/add-entry',
                        params: { tabs: 'task', initialTab: 'task' },
                      });
                    }}
                    onDelete={(item) => {
                      if (!item.id) return;
                      handleDeleteTask(item.id, item.title);
                    }}
                    onLogFromTask={(item) => handleLogFromTask(item)}
                  />
                ))}
              </View>
            ) : !isTasksLoading ? (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  alignItems: 'center',
                  padding: spacing[8],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <UiSymbol
                  name="checkbox-outline"
                  size={28}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    fontSize: fontSize.sm,
                    textAlign: 'center',
                    marginTop: spacing[2],
                  }}
                >
                  {t('farmDetails.tasks.empty.title')}
                </Text>
                <Pressable
                  onPress={handleAddTask}
                  accessibilityRole="button"
                  accessibilityLabel={t('farmDetails.actions.addTask')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[1],
                    marginTop: spacing[4],
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderRadius: m3.shape.cornerMedium,
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.primary, 0.22)
                      : colorWithOpacity(m3.colorScheme.primary, 0.14),
                    borderWidth: 1,
                    borderColor: m3.colorScheme.primary,
                  })}
                >
                  <UiSymbol name="plus" size={15} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      color: m3.colorScheme.primary,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {t('farmDetails.actions.addTask')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Recent Logs Section */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[6],
            }}
          >
            {/* Section header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: m3.surface.s500,
                  }}
                >
                  {t('farmDetails.sections.recentLogs', { defaultValue: 'Recent logs' })}
                </Text>
                {allLogs.length > 0 && (
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      color: m3.surface.s500,
                      marginLeft: 4,
                    }}
                  >
                    ·{' '}
                    {hasActiveLogTypeFilters
                      ? `${filteredLogs.length} ${t('common.filtered', { defaultValue: 'filtered' })}`
                      : allLogs.length}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => {
                  if (!farm?.id) return;
                  router.push({
                    pathname: '/logs',
                    params: { farmId: farm.id.toString() },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('farmDetails.actions.seeAllLogs')}. ${allLogs.length}`}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[1],
                  borderRadius: m3.shape.cornerSmall,
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                    : 'transparent',
                })}
              >
                <Text
                  style={{
                    color: m3.colorScheme.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {t('farmDetails.actions.seeAllLogs')}
                </Text>
              </Pressable>
            </View>

            {/* Filter chips */}
            <View style={{ marginBottom: spacing[3] }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[2] }}
              >
                <Pressable
                  onPress={() => setSelectedLogTypes([])}
                  accessibilityRole="button"
                  accessibilityLabel={t('farmDetails.a11y.filterAllLogs', {
                    defaultValue: 'Show all log types',
                  })}
                  accessibilityState={{ selected: !hasActiveLogTypeFilters }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 32,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[1],
                    borderRadius: m3.shape.cornerMedium,
                    backgroundColor: !hasActiveLogTypeFilters
                      ? colorWithOpacity(m3.colorScheme.primary, 0.14)
                      : m3.surface.surfaceContainer,
                    borderWidth: 1,
                    borderColor: !hasActiveLogTypeFilters
                      ? m3.colorScheme.primary
                      : m3.colorScheme.outlineVariant,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <UiSymbol
                    name="line.3.horizontal.decrease.circle"
                    size={12}
                    color={
                      !hasActiveLogTypeFilters
                        ? m3.colorScheme.primary
                        : m3.colorScheme.onSurfaceVariant
                    }
                  />
                  <Text
                    style={{
                      marginLeft: spacing[1],
                      fontSize: fontSize.sm,
                      fontWeight: !hasActiveLogTypeFilters
                        ? fontWeight.semibold
                        : fontWeight.medium,
                      color: !hasActiveLogTypeFilters
                        ? m3.colorScheme.primary
                        : m3.colorScheme.onSurface,
                    }}
                  >
                    {t('common.all', { defaultValue: 'All' })}
                  </Text>
                </Pressable>
                {LOG_TYPES.map((logType) => {
                  const isSelected = selectedLogTypes.includes(logType.id);
                  return (
                    <Pressable
                      key={logType.id}
                      onPress={() => toggleLogTypeFilter(logType.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t(logType.labelKey)}
                      accessibilityState={{ selected: isSelected }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 32,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1],
                        borderRadius: m3.shape.cornerMedium,
                        backgroundColor: isSelected
                          ? colorWithOpacity(logType.color, 0.14)
                          : m3.surface.surfaceContainer,
                        borderWidth: 1,
                        borderColor: isSelected ? logType.color : m3.colorScheme.outlineVariant,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <UiSymbol name={logType.icon} size={12} color={logType.color} />
                      <Text
                        style={{
                          marginLeft: spacing[1],
                          fontSize: fontSize.sm,
                          fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                          color: isSelected ? logType.color : m3.colorScheme.onSurface,
                        }}
                      >
                        {t(logType.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
                {hasActiveLogTypeFilters ? (
                  <Pressable
                    onPress={() => setSelectedLogTypes([])}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmDetails.a11y.clearLogTypeFilter', {
                      defaultValue: 'Clear log type filter',
                    })}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      minHeight: 32,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      borderRadius: m3.shape.cornerMedium,
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.hover,
                      ),
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <UiSymbol name="xmark" size={11} color={m3.colorScheme.onSurfaceVariant} />
                    <Text
                      style={{
                        marginLeft: spacing[1],
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.medium,
                        color: m3.colorScheme.onSurface,
                      }}
                    >
                      {t('common.clear', { defaultValue: 'Clear' })}
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>

            {/* Log rows */}
            {recentLogs.length > 0 ? (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  padding: spacing[2],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  gap: spacing[2],
                }}
              >
                {recentLogs.map((log) => (
                  <TimelineLogCard
                    key={log.id}
                    type={log.type}
                    date={log.date}
                    data={log.data}
                    farmName={farm?.name ?? undefined}
                    onEdit={() => handleEditActivity(log)}
                    onDelete={log.type === 'note' ? undefined : () => handleDeleteActivity(log)}
                    onPress={() => handleEditActivity(log)}
                  />
                ))}
              </View>
            ) : (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  alignItems: 'center',
                  padding: spacing[8],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <UiSymbol
                  name="doc.text"
                  size={28}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    fontSize: fontSize.sm,
                    textAlign: 'center',
                    marginTop: spacing[2],
                  }}
                >
                  {selectedLogTypes.length > 0
                    ? t('farmDetails.activities.empty.filteredSubtitle')
                    : t('farmDetails.activities.empty.subtitle')}
                </Text>
              </View>
            )}
          </View>

          {/* Season Totals */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: m3.surface.s500,
                marginBottom: spacing[2],
              }}
            >
              {t('farmDetails.sections.seasonTotals', { defaultValue: 'Season totals' })}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xs'],
                    fontWeight: fontWeight.bold,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('farmDetails.seasonTotals.expenses', { defaultValue: 'Expenses' })}
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    marginTop: spacing[1],
                  }}
                >
                  {formatCurrencyCompact(seasonExpenseTotal)}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xs'],
                    fontWeight: fontWeight.bold,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('farmDetails.seasonTotals.harvest', { defaultValue: 'Harvest' })}
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    marginTop: spacing[1],
                  }}
                >
                  {formatHarvestQuantity(seasonHarvestQuantity)}
                </Text>
              </View>
            </View>
          </View>

          {/* About */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[6],
              paddingBottom: spacing[8] + spacing[16],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: m3.surface.s500,
                marginBottom: spacing[2],
              }}
            >
              {t('farmDetails.sections.aboutFarm', { defaultValue: 'About this farm' })}
            </Text>
            <View
              style={{
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                borderRadius: borderRadius.md,
                padding: spacing[4],
                rowGap: spacing[3],
              }}
            >
              {[
                [
                  t('farmDetails.about.variety', { defaultValue: 'Variety' }),
                  farm.crop_variety || farm.crop || '—',
                ],
                [
                  t('farmDetails.about.area', { defaultValue: 'Area' }),
                  farm.area != null
                    ? t('farmDetails.header.areaAcres', { value: farm.area.toFixed(1) })
                    : '—',
                ],
                [
                  t('farmDetails.about.region', { defaultValue: 'Region' }),
                  farm.region || farm.location_name || '—',
                ],
                [
                  t('farmDetails.about.soilType', { defaultValue: 'Soil type' }),
                  farm.soil_texture_class || '—',
                ],
                [
                  t('farmDetails.about.spacing', { defaultValue: 'Spacing' }),
                  farm.vine_spacing && farm.row_spacing
                    ? `${farm.vine_spacing} × ${farm.row_spacing}`
                    : '—',
                ],
                [
                  t('farmDetails.about.planting', { defaultValue: 'Planting' }),
                  farm.planting_date
                    ? formatDate(
                        parseDbDateToLocalDate(farm.planting_date) ?? new Date(farm.planting_date),
                        { month: 'short', year: 'numeric' },
                      )
                    : '—',
                ],
              ].map(([label, value], index) => (
                <View
                  key={label}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: m3.colorScheme.outlineVariant,
                    paddingTop: index === 0 ? 0 : spacing[3],
                    gap: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize['2xs'],
                      fontWeight: fontWeight.bold,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      textAlign: 'right',
                    }}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {showFarmActionsSheet && isAndroid && (
        <Pressable
          onPress={() => setShowFarmActionsSheet(false)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            zIndex: 45,
          }}
        >
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderTopLeftRadius: m3.shape.cornerLarge,
              borderTopRightRadius: m3.shape.cornerLarge,
              paddingTop: spacing[3],
              paddingHorizontal: spacing[4],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              gap: spacing[1],
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
                marginBottom: spacing[2],
              }}
            />
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {t('farmDetails.actions.menuTitle')}
            </Text>
            <Text
              numberOfLines={1}
              style={{ ...m3.typography.bodyMedium, color: m3.colorScheme.onSurfaceVariant }}
            >
              {farm?.name}
            </Text>
            <Pressable
              onPress={openEditFarm}
              accessibilityRole="button"
              accessibilityLabel={t('farmDetails.actions.editFarm')}
              style={({ pressed }) => ({
                borderRadius: m3.shape.cornerMedium,
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : m3.surface.surfaceContainer,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol name="create-outline" size={18} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    marginLeft: spacing[2],
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.bodyMedium,
                  }}
                >
                  {t('farmDetails.actions.editFarm')}
                </Text>
              </View>
              <UiSymbol name="chevron.right" size={16} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
            <Pressable
              onPress={activeSeasonRecord ? openEndSeasonForm : openStartSeasonForm}
              accessibilityRole="button"
              accessibilityLabel={
                activeSeasonRecord
                  ? t('farmDetails.actions.endSeason')
                  : t('farmDetails.actions.startSeason')
              }
              style={({ pressed }) => ({
                borderRadius: m3.shape.cornerMedium,
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : m3.surface.surfaceContainer,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol name="calendar" size={18} color={m3.colorScheme.tertiary} />
                <Text
                  style={{
                    marginLeft: spacing[2],
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.bodyMedium,
                  }}
                >
                  {activeSeasonRecord
                    ? t('farmDetails.actions.endSeason')
                    : t('farmDetails.actions.startSeason')}
                </Text>
              </View>
              <UiSymbol name="chevron.right" size={16} color={m3.colorScheme.onSurfaceVariant} />
            </Pressable>
            {needsSeasonReview && typeof farm?.id === 'number' ? (
              <Pressable
                onPress={async () => {
                  setShowFarmActionsSheet(false);
                  if (typeof farm.id !== 'number') return;
                  const reviewFarmId = farm.id;
                  try {
                    await recomputeSeasonAssignments.mutateAsync({ farmId: reviewFarmId });
                    toast.success(t('farmDetails.seasons.alerts.reviewQueuedSuccess'));
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : t('farmDetails.seasons.errors.reviewQueueFailed');
                    Alert.alert(t('common.error'), message);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={t('farmDetails.actions.reviewSeasonHistory')}
                style={({ pressed }) => ({
                  borderRadius: m3.shape.cornerMedium,
                  paddingVertical: spacing[3],
                  paddingHorizontal: spacing[3],
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.primary, 0.14)
                    : colorWithOpacity(m3.colorScheme.primary, 0.08),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <UiSymbol name="refresh" size={18} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurface,
                      ...m3.typography.bodyMedium,
                    }}
                  >
                    {t('farmDetails.actions.reviewSeasonHistory')}
                  </Text>
                </View>
                <UiSymbol name="chevron.right" size={16} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={confirmDeleteFarmFromSheet}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
              style={({ pressed }) => ({
                borderRadius: m3.shape.cornerMedium,
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.error, 0.2)
                  : colorWithOpacity(m3.colorScheme.error, 0.12),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol name="trash" size={18} color={m3.colorScheme.error} />
                <Text
                  style={{
                    marginLeft: spacing[2],
                    color: m3.colorScheme.error,
                    ...m3.typography.bodyMedium,
                  }}
                >
                  {t('common.delete')}
                </Text>
              </View>
              <UiSymbol name="chevron.right" size={16} color={m3.colorScheme.error} />
            </Pressable>
            <Pressable
              onPress={() => setShowFarmActionsSheet(false)}
              style={({ pressed }) => ({
                borderRadius: m3.shape.cornerMedium,
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[3],
                alignItems: 'center',
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              })}
            >
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {showSeasonForm && (
        <Pressable
          onPress={isGuidedSeasonStep ? undefined : closeSeasonForm}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            zIndex: 40,
          }}
        >
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.START_SEASON_SHEET}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderTopLeftRadius: m3.shape.cornerLarge,
              borderTopRightRadius: m3.shape.cornerLarge,
              maxHeight: '82%',
              overflow: 'hidden',
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{ alignItems: 'center', paddingTop: spacing[2], paddingBottom: spacing[1] }}
            >
              <View
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: borderRadius.full,
                  backgroundColor: m3.colorScheme.outlineVariant,
                }}
              />
            </View>

            <View
              style={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[2],
                paddingBottom: spacing[3],
                borderBottomWidth: 1,
                borderBottomColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.45),
                gap: spacing[1],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: isGuidedSeasonStep ? 'flex-start' : 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
                  {seasonFormMode === 'start'
                    ? t('farmDetails.seasons.startFormTitle')
                    : t('farmDetails.seasons.formTitle')}
                </Text>
                {!isGuidedSeasonStep ? (
                  <Pressable
                    onPress={closeSeasonForm}
                    accessibilityLabel={t('common.close')}
                    accessibilityRole="button"
                  >
                    <UiSymbol
                      name="xmark.circle.fill"
                      size={24}
                      color={m3.colorScheme.onSurfaceVariant}
                    />
                  </Pressable>
                ) : null}
              </View>
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
                {seasonFormMode === 'start'
                  ? t('farmDetails.seasons.startHint')
                  : lastSeasonEndDate
                    ? t('farmDetails.seasons.lastEndDate', {
                        date: (() => {
                          const parsed = parseDbDateToLocalDate(lastSeasonEndDate);
                          return parsed
                            ? formatDate(parsed, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : lastSeasonEndDate;
                        })(),
                      })
                    : t('farmDetails.seasons.firstTimeHint')}
              </Text>
              {seasonFormMode === 'start' && isGuidedSeasonStep ? (
                <View
                  style={{
                    marginTop: spacing[1],
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                    borderWidth: 1,
                    borderColor: colorWithOpacity(m3.colorScheme.primary, 0.28),
                    borderRadius: m3.shape.cornerMedium,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    gap: spacing[1],
                  }}
                >
                  <Text style={{ color: m3.colorScheme.primary, ...m3.typography.labelSmall }}>
                    {t('guidedTour.coachmark.progress', {
                      defaultValue: 'Step {{current}} of {{total}}',
                      current:
                        guidedSeasonPhase === 'start_date'
                          ? 1
                          : guidedSeasonPhase === 'target_date'
                            ? 2
                            : 3,
                      total: 3,
                    })}
                  </Text>
                  <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium }}>
                    {guidedSeasonPhase === 'start_date'
                      ? t('farmDetails.seasons.guidedStartStep1', {
                          defaultValue: 'Set season start date (or keep today).',
                        })
                      : guidedSeasonPhase === 'target_date'
                        ? t('farmDetails.seasons.guidedStartStep2', {
                            defaultValue: 'Set your target harvest date.',
                          })
                        : t('farmDetails.seasons.guidedStartStep3', {
                            defaultValue: 'Tap Start season to finish.',
                          })}
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{
                paddingHorizontal: spacing[4],
                paddingTop: spacing[2],
                paddingBottom: spacing[3],
                gap: spacing[2],
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelLarge }}>
                {t('farmDetails.seasons.startDateLabel')}
              </Text>
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}>
                {t('farmDetails.seasons.startDateHelp', {
                  defaultValue: 'The day this season starts.',
                })}
              </Text>
              <GuidedTourTarget
                targetId={GUIDED_TOUR_TARGET_IDS.START_SEASON_START_DATE}
                enabled={isGuidedSeasonStep && seasonFormMode === 'start'}
              >
                {isSeasonStartLocked ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                      borderRadius: m3.shape.cornerMedium,
                      padding: spacing[3],
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium }}>
                      {formattedEffectiveSeasonStart}
                    </Text>
                  </View>
                ) : isIOS ? (
                  <DateTimePicker
                    value={seasonStartDate}
                    mode="date"
                    display="spinner"
                    minimumDate={minimumSeasonStartDate ?? undefined}
                    maximumDate={seasonFormMode === 'end' ? seasonEndDate : undefined}
                    onChange={(_, date) => {
                      if (!date) return;
                      setSeasonStartDate(date);
                      if (
                        seasonFormMode === 'end' &&
                        formatLocalDate(seasonEndDate) < formatLocalDate(date)
                      ) {
                        setSeasonEndDate(date);
                      }
                      if (seasonFormMode === 'start' && isGuidedSeasonStep) {
                        guidedTourEmit('guidedTour.seasonFormPhaseChanged', {
                          phase: 'target_date',
                        });
                      }
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => setShowSeasonStartPicker(true)}
                    style={{
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                      borderRadius: m3.shape.cornerMedium,
                      padding: spacing[3],
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium }}>
                      {formattedSeasonStart}
                    </Text>
                  </Pressable>
                )}
              </GuidedTourTarget>
              {seasonFormMode === 'end' && (
                <>
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelLarge }}
                  >
                    {t('farmDetails.seasons.endDateLabel')}
                  </Text>
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                  >
                    {t('farmDetails.seasons.endDateHelp', {
                      defaultValue: 'The day this season ends.',
                    })}
                  </Text>
                  {isIOS ? (
                    <DateTimePicker
                      value={seasonEndDate}
                      mode="date"
                      display="spinner"
                      minimumDate={effectiveSeasonStartDate}
                      onChange={(_, date) => {
                        if (date) setSeasonEndDate(date);
                      }}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setShowSeasonEndPicker(true)}
                      style={{
                        borderWidth: 1,
                        borderColor: m3.colorScheme.outlineVariant,
                        borderRadius: m3.shape.cornerMedium,
                        padding: spacing[3],
                      }}
                    >
                      <Text
                        style={{ color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium }}
                      >
                        {formattedSeasonEnd}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
              {seasonFormMode === 'start' && (
                <>
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelLarge }}
                  >
                    {t('safeToSpray.targetDate', { defaultValue: 'Target harvest date' })}
                  </Text>
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                  >
                    {t('farmDetails.seasons.targetHarvestDateHelp', {
                      defaultValue: 'Planned day you want to harvest.',
                    })}
                  </Text>
                  <GuidedTourTarget
                    targetId={GUIDED_TOUR_TARGET_IDS.START_SEASON_TARGET_DATE}
                    enabled={isGuidedSeasonStep && seasonFormMode === 'start'}
                  >
                    {isIOS ? (
                      <DateTimePicker
                        value={seasonTargetHarvestDate ?? seasonTargetHarvestDraft}
                        mode="date"
                        display="spinner"
                        minimumDate={seasonStartDate}
                        onChange={(_, date) => {
                          if (!date) return;
                          setSeasonTargetHarvestDraft(date);
                          setSeasonTargetHarvestDate(date);
                          if (isGuidedSeasonStep) {
                            guidedTourEmit('guidedTour.seasonFormPhaseChanged', {
                              phase: 'submit',
                            });
                          }
                        }}
                      />
                    ) : (
                      <Pressable
                        onPress={() => {
                          setSeasonTargetHarvestDraft(seasonTargetHarvestDate ?? seasonStartDate);
                          setShowSeasonTargetPicker(true);
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                          borderRadius: m3.shape.cornerMedium,
                          padding: spacing[3],
                        }}
                      >
                        <Text
                          style={{ color: m3.colorScheme.onSurface, ...m3.typography.bodyMedium }}
                        >
                          {seasonTargetHarvestDate
                            ? formatDate(seasonTargetHarvestDate, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </Text>
                      </Pressable>
                    )}
                  </GuidedTourTarget>
                </>
              )}
            </ScrollView>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.45),
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: Math.max(insets.bottom, spacing[4]),
              }}
            >
              <GuidedTourTarget
                targetId={GUIDED_TOUR_TARGET_IDS.START_SEASON_PRIMARY}
                pointerEvents="box-none"
              >
                <Button
                  title={
                    seasonFormMode === 'start'
                      ? t('farmDetails.seasons.startSeasonButton')
                      : t('farmDetails.seasons.endSeasonButton')
                  }
                  onPress={seasonFormMode === 'start' ? handleStartSeason : handleEndSeason}
                  isLoading={
                    isStartingSeasonFlow ||
                    startFarmSeason.isPending ||
                    updateSeasonTargetHarvestDate.isPending ||
                    endFarmSeason.isPending
                  }
                />
              </GuidedTourTarget>
            </View>
          </GuidedTourTarget>
        </Pressable>
      )}

      {showSeasonStartPicker && !isIOS && (
        <DateTimePicker
          value={seasonStartDate}
          mode="date"
          display="default"
          minimumDate={minimumSeasonStartDate ?? undefined}
          maximumDate={seasonFormMode === 'end' ? seasonEndDate : undefined}
          onChange={(_, date) => {
            setShowSeasonStartPicker(false);
            if (!date) return;
            setSeasonStartDate(date);
            if (seasonFormMode === 'end' && seasonEndDate.getTime() < date.getTime()) {
              setSeasonEndDate(date);
            }
            if (seasonFormMode === 'start' && isGuidedSeasonStep) {
              guidedTourEmit('guidedTour.seasonFormPhaseChanged', {
                phase: 'target_date',
              });
            }
          }}
        />
      )}

      {showSeasonEndPicker && seasonFormMode === 'end' && !isIOS && (
        <DateTimePicker
          value={seasonEndDate}
          mode="date"
          display="default"
          minimumDate={effectiveSeasonStartDate}
          onChange={(_, date) => {
            setShowSeasonEndPicker(false);
            if (date) setSeasonEndDate(date);
          }}
        />
      )}
      {showSeasonTargetPicker && seasonFormMode === 'start' && !isIOS && (
        <DateTimePicker
          value={seasonTargetHarvestDraft}
          mode="date"
          display="default"
          minimumDate={seasonStartDate}
          onChange={(_, date) => {
            setShowSeasonTargetPicker(false);
            if (!date) return;
            setSeasonTargetHarvestDraft(date);
            setSeasonTargetHarvestDate(date);
            if (isGuidedSeasonStep) {
              guidedTourEmit('guidedTour.seasonFormPhaseChanged', { phase: 'submit' });
            }
          }}
        />
      )}
      {showActiveSeasonTargetPicker && !isIOS && (
        <DateTimePicker
          value={activeSeasonTargetHarvestDraft}
          mode="date"
          display="default"
          minimumDate={parseDbDateToLocalDate(activeSeasonRecord?.start_date ?? '') ?? undefined}
          onChange={(_, date) => {
            setShowActiveSeasonTargetPicker(false);
            if (isSavingActiveSeasonTargetDate) return;
            if (!date) return;
            setActiveSeasonTargetHarvestDraft(date);
            void saveActiveSeasonTargetHarvestDate(date);
          }}
        />
      )}
      {isEditingActiveSeasonTargetIOS && isIOS && (
        <Pressable
          onPress={() => setIsEditingActiveSeasonTargetIOS(false)}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            zIndex: 45,
          }}
        >
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderTopLeftRadius: m3.shape.cornerLarge,
              borderTopRightRadius: m3.shape.cornerLarge,
              padding: spacing[4],
              gap: spacing[3],
            }}
            onStartShouldSetResponder={() => true}
          >
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {t('safeToSpray.targetDate', { defaultValue: 'Target harvest date' })}
            </Text>
            <DateTimePicker
              value={activeSeasonTargetHarvestDraft}
              mode="date"
              display="spinner"
              minimumDate={
                parseDbDateToLocalDate(activeSeasonRecord?.start_date ?? '') ?? undefined
              }
              onChange={(_, date) => {
                if (date) setActiveSeasonTargetHarvestDraft(date);
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] }}>
              <Pressable
                onPress={async () => {
                  if (isSavingActiveSeasonTargetDate) return;
                  const didSave = await saveActiveSeasonTargetHarvestDate(null);
                  if (didSave) {
                    setIsEditingActiveSeasonTargetIOS(false);
                  }
                }}
                style={{
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
                disabled={isSavingActiveSeasonTargetDate}
              >
                <Text
                  style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                >
                  {t('common.clear', { defaultValue: 'Clear' })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsEditingActiveSeasonTargetIOS(false)}
                style={{
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <Text
                  style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                >
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (isSavingActiveSeasonTargetDate) return;
                  const didSave = await saveActiveSeasonTargetHarvestDate(
                    activeSeasonTargetHarvestDraft,
                  );
                  if (didSave) {
                    setIsEditingActiveSeasonTargetIOS(false);
                  }
                }}
                style={{
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  backgroundColor: m3.colorScheme.primary,
                }}
                disabled={isSavingActiveSeasonTargetDate}
              >
                <Text style={{ color: m3.colorScheme.onPrimary, ...m3.typography.labelSmall }}>
                  {t('common.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}

      {showSeasonSuccessOverlay && (
        <Pressable
          onPress={dismissSeasonSuccessOverlay}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colorWithOpacity(m3.colorScheme.scrim, 0.28),
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing[6],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 340,
              backgroundColor: m3.surface.surfaceContainerHigh,
              borderRadius: m3.shape.cornerLarge,
              paddingHorizontal: spacing[5],
              paddingVertical: spacing[6],
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
              opacity: seasonSuccessOpacity,
              transform: [{ scale: seasonSuccessScale }],
            }}
          >
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[3],
              }}
            >
              <UiSymbol name="checkmark.seal.fill" size={34} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={{
                ...m3.typography.titleMedium,
                color: m3.colorScheme.onSurface,
                textAlign: 'center',
              }}
            >
              {seasonSuccessType === 'start'
                ? t('farmDetails.seasons.alerts.startSuccessTitle')
                : t('farmDetails.seasons.alerts.endSuccessTitle')}
            </Text>
            <Text
              style={{
                ...m3.typography.bodyMedium,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              {seasonSuccessType === 'start'
                ? t('farmDetails.seasons.alerts.startSuccess')
                : t('farmDetails.seasons.alerts.endSuccess')}
            </Text>
          </Animated.View>
        </Pressable>
      )}

      {/* Primary action — Material 3 floating action button (both platforms) */}
      <GuidedTourTarget
        targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY}
        style={{
          position: 'absolute',
          bottom: spacing[6] + insets.bottom,
          right: spacing[6],
          width: 56,
          height: 56,
        }}
      >
        <Pressable
          onPress={handleAddActivity}
          accessibilityRole="button"
          accessibilityLabel={t('farmDetails.actions.addActivity')}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: m3.colorScheme.primary,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {({ pressed }) => (
            <>
              <UiSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: pressed
                      ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                      : 'transparent',
                  },
                ]}
              />
            </>
          )}
        </Pressable>
      </GuidedTourTarget>

      {/* Add Entry + Water Level handled via routes */}
    </>
  );
}
