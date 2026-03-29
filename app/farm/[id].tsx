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
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
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
} from '@/types';
import type { TaskReminder } from '@/types/task';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { isGrapeCrop } from '@/utils/crop';

import { useModalStore } from '@/stores';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { triggerHapticWarning, triggerHapticSuccess, triggerHapticMedium } from '@/utils/haptics';
import { decodeTaskPlanFromDescription } from '@/utils/task-plan';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { telemetry } from '@/services/telemetry';
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

function formatDdMmmYyyy(date: Date, locale?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);
  const day =
    parts.find((part) => part.type === 'day')?.value ?? String(date.getDate()).padStart(2, '0');
  const month =
    parts.find((part) => part.type === 'month')?.value ??
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? String(date.getFullYear());
  return `${day} ${month} ${year}`;
}

export default function FarmDetailScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t, i18n } = useTranslation();

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
    refetch: refetchRecords,
  } = useFarmRecords(farmId);

  const { data: tasks, refetch: refetchTasks } = useTasks(farmId);
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
  const [selectedTab, setSelectedTab] = useState<'activities' | 'tasks'>('activities');
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
    if (
      guidedTourStatus === 'in_progress' &&
      guidedTourStep === 'add_log' &&
      selectedTab !== 'activities'
    ) {
      setSelectedTab('activities');
    }
  }, [guidedTourStatus, guidedTourStep, selectedTab]);

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
  const showFab = isAndroid;
  const bottomBarHeight = showFab ? 0 : 72 + insets.bottom;
  const handleBackNavigation = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace('/(tabs)/farms');
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
        color: colors.task[500],
      },
    ];
    if (profile?.consultant_organization_id) {
      actions.push({
        id: 'fertilizer-plans',
        titleKey: 'farmDetails.fertilizerPlan.title',
        icon: 'leaf.fill',
        color: colors.fertigation[500],
      });
    }
    return actions;
  }, [colors.fertigation, colors.task, m3, profile?.consultant_organization_id]);

  // Calculate stats
  const totalRecords = useMemo(
    () =>
      (irrigationRecords?.length || 0) +
      (sprayRecords?.length || 0) +
      (harvestRecords?.length || 0) +
      (expenseRecords?.length || 0) +
      (fertigationRecords?.length || 0),
    [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords],
  );

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
  const { data: earliestSafeHarvest, refetch: refetchEarliestSafeHarvest } =
    useEarliestSafeHarvestForSeason(farmId, activeSeasonRecord?.id ?? null);
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
  const isBetweenSeasons = useMemo(() => {
    if (activeSeasonRecord) return false;
    if (!minimumSeasonStartDate) return false;
    return formatLocalDate(new Date()) < formatLocalDate(minimumSeasonStartDate);
  }, [activeSeasonRecord, minimumSeasonStartDate]);

  // "Days after pruning" should always be based on the pruning date.
  const daysSincePruning = useMemo(() => {
    if (!farm?.date_of_pruning) return null;
    const pruningDate = parseDbDateToLocalDate(farm.date_of_pruning);
    if (!pruningDate) return null;
    const today = new Date();
    const diffTime = today.getTime() - pruningDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }, [farm?.date_of_pruning]);

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

  const formatWaterUsage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return t('farmDetails.water.noIrrigationLoggedYet');
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return t('farmDetails.water.mmUsed', { value: value.toFixed(digits) });
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
            Alert.alert(t('common.success'), t('farmDetails.seasons.alerts.reviewQueuedSuccess'));
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
    setShowActiveSeasonTargetPicker(true);
  };

  const _clearActiveSeasonTargetHarvestDate = () => {
    if (isSavingActiveSeasonTargetDate) return;
    void saveActiveSeasonTargetHarvestDate(null);
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
      data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
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

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords]);

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

  const handleAddActivity = () => {
    if (!farm?.id) return;
    if (!activeSeasonRecord) {
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
    router.push({
      pathname: '/log-entry/add',
      params: {
        farmId: farm.id.toString(),
      },
    });
  };

  const handleAddTask = () => {
    if (!farm?.id) return;
    if (!activeSeasonRecord) {
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
    router.push({
      pathname: '/add-entry',
      params: {
        farmId: farm.id.toString(),
        initialTab: 'task',
        tabs: 'log,task',
      },
    });
  };

  const handleEditActivity = (log: (typeof recentLogs)[number]) => {
    if (!farm) return;
    setEditActivity({
      farm,
      logType: log.type,
      record: log.data,
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
                router.replace('/(tabs)/farms');
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
    );
  }

  if (!farm) {
    return (
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
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: farm.name,
          headerStyle: { backgroundColor: m3.colorScheme.surface },
          headerTintColor: m3.colorScheme.onSurface,
          headerBackVisible: false,
          headerBackTitle: '',
          // @ts-expect-error headerBackTitleVisible is supported at runtime but not in type definitions
          headerBackTitleVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          headerLeft: () => (
            <Pressable
              onPress={handleBackNavigation}
              style={{
                marginLeft: spacing[1],
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: m3.surface.surfaceContainerHigh,
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
                      StyleSheet.absoluteFillObject,
                      {
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleOpenFarmActions}
              style={{
                marginRight: spacing[2],
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: m3.surface.surfaceContainerHigh,
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
                      StyleSheet.absoluteFillObject,
                      {
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>
          ),
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  color: m3.colorScheme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
              >
                {farm.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.xs }}>
                  {farm.crop_variety || farm.crop}
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    fontSize: fontSize.xs,
                    marginHorizontal: spacing[1],
                  }}
                >
                  •
                </Text>
                <View
                  style={{
                    backgroundColor: m3.colorScheme.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.full,
                  }}
                >
                  <UiSymbol name="resize" size={10} color={m3.colorScheme.onPrimary} />
                  <Text
                    style={{
                      color: m3.colorScheme.onPrimary,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      marginLeft: spacing[1],
                    }}
                  >
                    {farm.area != null
                      ? t('farmDetails.header.areaAcres', { value: farm.area.toFixed(1) })
                      : t('farmDetails.header.areaAcresUnknown')}
                  </Text>
                </View>
              </View>
            </View>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
        <ScrollView
          style={{ flex: 1 }}
          scrollEnabled={!isGuidedAddLogStep}
          contentContainerStyle={{
            paddingTop: 0,
            paddingBottom: bottomBarHeight + spacing[6],
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
          {/* Farm Identity Card - Green Primary Background */}
          <View
            style={{
              marginHorizontal: 0,
              borderBottomLeftRadius: borderRadius.lg,
              borderBottomRightRadius: borderRadius.lg,
              overflow: 'hidden',
              backgroundColor: m3.colorScheme.primary,
              paddingHorizontal: spacing[5],
              paddingTop: spacing[3],
            }}
          >
            {/* Farm Name & Variety */}
            <View style={{ paddingBottom: spacing[4] }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {/* Farm Icon Circle */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colorWithOpacity('#ffffff', 0.14),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UiSymbol name="leaf.fill" size={24} color={colorWithOpacity('#ffffff', 0.9)} />
                </View>

                {/* Farm Text Info */}
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#ffffff',
                      fontSize: 22,
                      fontWeight: fontWeight.semibold,
                      lineHeight: 28,
                    }}
                  >
                    {farm.name}
                  </Text>
                  <Text
                    style={{
                      color: colorWithOpacity('#ffffff', 0.65),
                      fontSize: 14,
                      lineHeight: 20,
                      marginTop: 2,
                    }}
                  >
                    {farm.crop_variety || farm.crop}
                  </Text>
                  {farm.area != null && (
                    <View
                      style={{
                        marginTop: spacing[1],
                        backgroundColor: colorWithOpacity('#ffffff', 0.14),
                        alignSelf: 'flex-start',
                        paddingHorizontal: spacing[2] + 2,
                        paddingVertical: 2,
                        borderRadius: borderRadius.full,
                      }}
                    >
                      <Text
                        style={{
                          color: colorWithOpacity('#ffffff', 0.85),
                          fontSize: 12,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        {farm.area.toFixed(1)} acres
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions Button */}
                <Pressable
                  onPress={handleOpenFarmActions}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('farmDetails.a11y.openFarmActions')}
                >
                  {({ pressed }) => (
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity('#ffffff', pressed ? 0.2 : 0.12),
                      }}
                    >
                      <UiSymbol
                        name="ellipsis"
                        size={18}
                        color={colorWithOpacity('#ffffff', 0.9)}
                      />
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Season Status Row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing[3],
                }}
              >
                <UiSymbol
                  name={
                    activeSeasonRecord ? 'calendar.badge.clock' : 'calendar.badge.exclamationmark'
                  }
                  size={12}
                  color={colorWithOpacity('#ffffff', 0.65)}
                />
                <Text
                  style={{
                    marginLeft: spacing[1],
                    color: activeSeasonRecord ? colorWithOpacity('#ffffff', 0.65) : colors.warning,
                    fontSize: 12,
                  }}
                >
                  {activeSeasonRecord
                    ? t('farmDetails.seasons.statusActive', {
                        start: (() => {
                          const parsed = parseDbDateToLocalDate(activeSeasonRecord.start_date);
                          return parsed
                            ? formatDate(parsed, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : activeSeasonRecord.start_date;
                        })(),
                      })
                    : t('farmDetails.seasons.statusNone')}
                </Text>
                {daysSincePruning !== null && (
                  <View
                    style={{
                      marginLeft: spacing[2],
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing[2],
                      paddingVertical: 2,
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(colors.warning, 0.25),
                    }}
                  >
                    <UiSymbol
                      name="cut-outline"
                      size={10}
                      color={colorWithOpacity('#ffffff', 0.9)}
                    />
                    <Text
                      style={{
                        color: colorWithOpacity('#ffffff', 0.9),
                        fontSize: 11,
                        fontWeight: fontWeight.bold,
                        marginLeft: spacing[1],
                      }}
                    >
                      {daysSincePruning}d
                    </Text>
                  </View>
                )}
                {isBetweenSeasons && (
                  <View
                    style={{
                      marginLeft: spacing[2],
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing[2],
                      paddingVertical: 2,
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity('#ffffff', 0.14),
                    }}
                  >
                    <UiSymbol name="calendar" size={10} color={colorWithOpacity('#ffffff', 0.85)} />
                    <Text
                      style={{
                        color: colorWithOpacity('#ffffff', 0.85),
                        fontSize: 11,
                        fontWeight: fontWeight.bold,
                        marginLeft: spacing[1],
                      }}
                    >
                      {t('farmDetails.seasons.betweenSeasonsBadge')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Target Harvest Date (for grape farms with active season) */}
              {isGrapeFarm && activeSeasonRecord && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: spacing[2],
                  }}
                >
                  <UiSymbol name="calendar" size={12} color={colorWithOpacity('#ffffff', 0.65)} />
                  <Text
                    style={{
                      marginLeft: spacing[1],
                      color: colorWithOpacity('#ffffff', 0.65),
                      fontSize: 12,
                      flex: 1,
                    }}
                  >
                    Target:{' '}
                    {(() => {
                      const raw = activeSeasonRecord.target_harvest_date;
                      if (!raw) return '—';
                      const parsed = parseDbDateToLocalDate(raw);
                      return parsed ? formatDdMmmYyyy(parsed, i18n.language) : raw;
                    })()}
                  </Text>
                  <Pressable
                    onPress={openActiveSeasonTargetEditor}
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: 2,
                      backgroundColor: colorWithOpacity('#ffffff', 0.14),
                      borderRadius: borderRadius.full,
                    }}
                    accessibilityRole="button"
                    disabled={isSavingActiveSeasonTargetDate}
                  >
                    <Text
                      style={{
                        color: colorWithOpacity('#ffffff', 0.85),
                        fontSize: 11,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      Edit
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Safe Harvest Date */}
              {isGrapeFarm && earliestSafeHarvest?.earliestDate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] }}>
                  <UiSymbol
                    name="shield-checkered"
                    size={14}
                    color={colorWithOpacity('#ffffff', 0.7)}
                  />
                  <Text
                    style={{
                      color: colorWithOpacity('#ffffff', 0.7),
                      fontSize: 12,
                      marginLeft: spacing[1],
                    }}
                  >
                    Safe harvest: {earliestSafeHarvestDateLabel}
                  </Text>
                </View>
              ) : null}

              {/* Review Required Badge */}
              {needsSeasonReview ? (
                <View
                  style={{
                    marginTop: spacing[2],
                    alignSelf: 'flex-start',
                    backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.25),
                    borderRadius: borderRadius.full,
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                  }}
                >
                  <Text
                    style={{
                      color: colorWithOpacity('#ffffff', 0.9),
                      fontSize: 11,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {t('farmDetails.seasons.reviewRequiredBadge')}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Season Metrics Row */}
            <View style={{ flexDirection: 'row', gap: spacing[2], paddingBottom: spacing[4] }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colorWithOpacity('#ffffff', 0.08),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.12),
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: fontWeight.bold,
                    lineHeight: 24,
                  }}
                >
                  {totalRecords}
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity('#ffffff', 0.6),
                    fontSize: 12,
                    lineHeight: 16,
                    marginTop: 2,
                  }}
                >
                  Log Entries
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colorWithOpacity('#ffffff', 0.08),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.12),
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: fontWeight.bold,
                    lineHeight: 24,
                  }}
                >
                  {farm.remaining_water ? farm.remaining_water.toFixed(1) : '--'}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: fontWeight.medium,
                      color: colorWithOpacity('#ffffff', 0.7),
                    }}
                  >
                    mm
                  </Text>
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity('#ffffff', 0.6),
                    fontSize: 12,
                    lineHeight: 16,
                    marginTop: 2,
                  }}
                >
                  Soil Water
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colorWithOpacity('#ffffff', 0.08),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.12),
                  borderRadius: borderRadius.md,
                  padding: spacing[3],
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: fontWeight.bold,
                    lineHeight: 24,
                  }}
                >
                  {daysSincePruning !== null ? daysSincePruning : '--'}
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity('#ffffff', 0.6),
                    fontSize: 12,
                    lineHeight: 16,
                    marginTop: 2,
                  }}
                >
                  Days Pruned
                </Text>
              </View>
            </View>

            {/* Weather Strip - Horizontal with dividers */}
            {weather && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopWidth: 1,
                  borderTopColor: colorWithOpacity('#ffffff', 0.12),
                  paddingTop: spacing[3],
                  paddingBottom: spacing[4],
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing[3] }}
                >
                  <UiSymbol name="calendar" size={14} color={colorWithOpacity('#ffffff', 0.65)} />
                  <Text
                    style={{
                      marginLeft: spacing[1],
                      color: colorWithOpacity('#ffffff', 0.75),
                      fontSize: 13,
                    }}
                  >
                    Since{' '}
                    {(() => {
                      if (farm?.date_of_pruning) {
                        const parsed = parseDbDateToLocalDate(farm.date_of_pruning);
                        return parsed ? formatDate(parsed, { month: 'short', day: 'numeric' }) : '';
                      }
                      return activeSeasonRecord
                        ? formatDate(
                            parseDbDateToLocalDate(activeSeasonRecord.start_date) ?? new Date(),
                            { month: 'short', day: 'numeric' },
                          )
                        : '—';
                    })()}
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: colorWithOpacity('#ffffff', 0.18),
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[3],
                  }}
                >
                  <UiSymbol
                    name="partly-sunny"
                    size={14}
                    color={colorWithOpacity('#ffffff', 0.65)}
                  />
                  <Text
                    style={{
                      marginLeft: spacing[1],
                      color: colorWithOpacity('#ffffff', 0.75),
                      fontSize: 13,
                    }}
                  >
                    {weather.current.condition}
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    height: 16,
                    backgroundColor: colorWithOpacity('#ffffff', 0.18),
                  }}
                />
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: spacing[3] }}
                >
                  <UiSymbol
                    name="thermometer"
                    size={14}
                    color={colorWithOpacity('#ffffff', 0.65)}
                  />
                  <Text
                    style={{
                      marginLeft: spacing[1],
                      color: colorWithOpacity('#ffffff', 0.75),
                      fontSize: 13,
                    }}
                  >
                    {weather.current.temperature}°C
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Stats Grid - 2-column with 40x40 icon circles */}
          <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[6] }}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              {/* Log Entries Card */}
              <Pressable
                style={({ pressed: _pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                  borderRadius: borderRadius.md,
                  padding: spacing[4],
                })}
                onPress={() => {
                  if (!farmIdParam) return;
                  router.push(`/logs?farmId=${encodeURIComponent(farmIdParam)}`);
                }}
                accessibilityRole="button"
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[2],
                  }}
                >
                  <UiSymbol name="document-text" size={20} color={m3.colorScheme.primary} />
                </View>
                <Text
                  style={{
                    color: colors.surface[900],
                    fontSize: 20,
                    fontWeight: fontWeight.bold,
                    lineHeight: 26,
                  }}
                >
                  {totalRecords}
                </Text>
                <Text
                  style={{
                    color: colors.surface[500],
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  Log Entries
                </Text>
                <Text
                  style={{
                    color: colors.surface[400],
                    fontSize: 11,
                    lineHeight: 14,
                    marginTop: 2,
                  }}
                >
                  Total records
                </Text>
              </Pressable>

              {/* Soil Water Card */}
              <Pressable
                style={({ pressed: _pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                  borderRadius: borderRadius.md,
                  padding: spacing[4],
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
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colorWithOpacity(colors.irrigation[500], 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[2],
                  }}
                >
                  <UiSymbol name="water" size={20} color={colors.irrigation[500]} />
                </View>
                <Text
                  style={{
                    color: colors.surface[900],
                    fontSize: 20,
                    fontWeight: fontWeight.bold,
                    lineHeight: 26,
                  }}
                >
                  {farm.remaining_water ? farm.remaining_water.toFixed(1) : '--'}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: fontWeight.medium,
                      color: colors.surface[500],
                    }}
                  >
                    mm
                  </Text>
                </Text>
                <Text
                  style={{
                    color: colors.surface[500],
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  Soil Water
                </Text>
                <Text
                  style={{
                    color: colors.surface[400],
                    fontSize: 11,
                    lineHeight: 14,
                    marginTop: 2,
                  }}
                >
                  {waterUsageCaption}
                </Text>
              </Pressable>
            </View>
          </View>

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
                            borderRadius: 20,
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
                            color: colors.surface[500],
                            fontSize: 11,
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
                            StyleSheet.absoluteFillObject,
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

          {/* Tabs - Segmented Control */}
          <View style={{ paddingHorizontal: spacing[5], marginTop: spacing[6] }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: colors.surface[200],
                borderRadius: borderRadius.sm,
                borderWidth: 1,
                borderColor: colors.surface[300],
                padding: 3,
              }}
            >
              {(['activities', 'tasks'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => setSelectedTab(tab)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    tab === 'activities'
                      ? t('farmDetails.a11y.showActivities')
                      : t('farmDetails.a11y.showTasks')
                  }
                >
                  {({ pressed }) => {
                    const selected = selectedTab === tab;
                    const isFirst = tab === 'activities';
                    const isLast = tab === 'tasks';
                    return (
                      <View
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: spacing[2] + 1,
                          paddingHorizontal: spacing[2],
                          backgroundColor: selected
                            ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                            : 'transparent',
                          borderRadius:
                            isFirst && isLast
                              ? borderRadius.sm
                              : isFirst
                                ? borderRadius.sm - 1
                                : isLast
                                  ? borderRadius.sm - 1
                                  : 0,
                          ...(selected
                            ? {
                                borderTopLeftRadius: isFirst ? borderRadius.sm - 1 : 0,
                                borderBottomLeftRadius: isFirst ? borderRadius.sm - 1 : 0,
                                borderTopRightRadius: isLast ? borderRadius.sm - 1 : 0,
                                borderBottomRightRadius: isLast ? borderRadius.sm - 1 : 0,
                                overflow: 'hidden',
                              }
                            : null),
                        }}
                      >
                        <Text
                          numberOfLines={isAndroid ? 2 : 1}
                          ellipsizeMode={isAndroid ? 'clip' : 'tail'}
                          style={{
                            width: '100%',
                            flexShrink: 1,
                            fontSize: 14,
                            fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
                            color: selected ? colors.surface[900] : colors.surface[500],
                            textAlign: 'center',
                            maxWidth: '100%',
                          }}
                        >
                          {tab === 'activities'
                            ? t('farmDetails.tabs.activities')
                            : t('farmDetails.tabs.tasks')}
                        </Text>
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
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
                    );
                  }}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tab Content */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[4],
              paddingBottom: spacing[8] + (showFab ? spacing[16] : bottomBarHeight + spacing[6]),
            }}
          >
            {selectedTab === 'activities' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: spacing[3],
                  }}
                >
                  <View style={{ flexShrink: 1, paddingRight: spacing[3], flexDirection: 'row' }}>
                    <Text
                      style={{
                        ...m3.typography.titleMedium,
                        color: m3.colorScheme.onSurface,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.tabs.activities')}
                    </Text>
                    <View
                      style={{
                        marginLeft: spacing[2],
                        alignSelf: 'center',
                        borderRadius: borderRadius.full,
                        backgroundColor: m3.surface.surfaceContainerHigh,
                        paddingHorizontal: spacing[2],
                        paddingVertical: 2,
                      }}
                    >
                      <Text
                        style={{
                          ...m3.typography.labelSmall,
                          color: m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {hasActiveLogTypeFilters
                          ? `${recentLogs.length} ${t('common.filtered', { defaultValue: 'filtered' })}`
                          : `${recentLogs.length}`}
                      </Text>
                    </View>
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
                      flexDirection: 'row',
                      alignItems: 'center',
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

                {/* Filter Chips */}
                <View style={{ marginBottom: spacing[4] }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[2] }}
                  >
                    <Pressable
                      onPress={() => setSelectedLogTypes([])}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        minHeight: 36,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1] + 1,
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
                    {LOG_TYPES.filter((lt) => lt.id !== 'note').map((logType) => {
                      const isSelected = selectedLogTypes.includes(logType.id);
                      return (
                        <Pressable
                          key={logType.id}
                          onPress={() => toggleLogTypeFilter(logType.id)}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            minHeight: 36,
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[1] + 1,
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
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          minHeight: 36,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[1] + 1,
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

                {/* Recent Activity Rows */}
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
                        onDelete={() => handleDeleteActivity(log)}
                        onPress={() => handleEditActivity(log)}
                      />
                    ))}
                  </View>
                ) : (
                  <View
                    style={{
                      borderRadius: m3.shape.cornerLarge,
                      alignItems: 'center',
                      padding: spacing[10],
                      backgroundColor: m3.surface.surfaceContainerLow,
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing[4],
                        backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                      }}
                    >
                      <UiSymbol
                        name="doc.text"
                        size={32}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                      />
                    </View>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {selectedLogTypes.length > 0
                        ? t('farmDetails.activities.empty.filteredTitle')
                        : t('farmDetails.activities.empty.title')}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        fontSize: fontSize.sm,
                        textAlign: 'center',
                        marginTop: spacing[1],
                      }}
                    >
                      {selectedLogTypes.length > 0
                        ? t('farmDetails.activities.empty.filteredSubtitle')
                        : t('farmDetails.activities.empty.subtitle')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {farm?.id ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      marginBottom: spacing[3],
                    }}
                  >
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
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[1],
                        borderRadius: m3.shape.cornerMedium,
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
                {tasks && tasks.length > 0 ? (
                  <View style={{ gap: spacing[3] }}>
                    {tasks.map((task) => (
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
                ) : (
                  <View
                    style={{
                      borderRadius: m3.shape.cornerLarge,
                      alignItems: 'center',
                      padding: spacing[10],
                      backgroundColor: m3.surface.surfaceContainerLow,
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing[4],
                        backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                      }}
                    >
                      <UiSymbol
                        name="checkbox-outline"
                        size={32}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                      />
                    </View>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.tasks.empty.title')}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        fontSize: fontSize.sm,
                        textAlign: 'center',
                        marginTop: spacing[1],
                      }}
                    >
                      {showFab
                        ? t('farmDetails.tasks.empty.subtitleAndroid')
                        : t('farmDetails.tasks.empty.subtitleIos')}
                    </Text>
                  </View>
                )}
              </>
            )}
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
                    Alert.alert(
                      t('common.success'),
                      t('farmDetails.seasons.alerts.reviewQueuedSuccess'),
                    );
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
            StyleSheet.absoluteFillObject,
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

      {/* Primary action */}
      {showFab ? (
        <GuidedTourTarget
          targetId={
            selectedTab === 'activities'
              ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY
              : GUIDED_TOUR_TARGET_IDS.INACTIVE_TASK_TARGET
          }
          style={{
            position: 'absolute',
            bottom: spacing[6] + insets.bottom,
            right: spacing[6],
            width: 56,
            height: 56,
          }}
        >
          <Pressable
            onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
            accessibilityRole="button"
            accessibilityLabel={
              selectedTab === 'activities'
                ? t('farmDetails.actions.addActivity')
                : t('tasks.cta.addTask')
            }
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
                    StyleSheet.absoluteFillObject,
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
      ) : (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: Math.max(insets.bottom, spacing[3]),
            backgroundColor: m3.surface.surfaceContainerLow,
            borderTopWidth: 1,
            borderTopColor: m3.colorScheme.outlineVariant,
          }}
        >
          <GuidedTourTarget
            targetId={
              selectedTab === 'activities'
                ? GUIDED_TOUR_TARGET_IDS.ADD_LOG_PRIMARY
                : GUIDED_TOUR_TARGET_IDS.INACTIVE_TASK_TARGET
            }
          >
            <Button
              title={
                selectedTab === 'activities'
                  ? t('farmDetails.actions.addActivity')
                  : t('tasks.cta.addTask')
              }
              onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
            />
          </GuidedTourTarget>
        </View>
      )}

      {/* Add Entry + Water Level handled via routes */}
    </>
  );
}
