import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  FadeInUp,
  FadeOutUp,
} from 'react-native-reanimated';
import { triggerHaptic, triggerHapticMedium, triggerHapticSuccess } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { supabase } from '@/lib/supabase';
import type { Farm, Worker, WorkerAttendance, WorkerAttendanceInsert, WorkStatus } from '@/types';
import { borderRadius, fontSize, fontWeight, radius, shadows, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTabBarInset, isAndroid, isIOS } from '@/hooks';
import { WorkerSelectSheet, FarmSelectSheet } from '@/components/modals';
import { formatDate as formatDateLocalized } from '@/i18n/format';
import { GuidedTourTarget, GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour';
import { normalizeDate, addDays } from '@/utils/worker-analytics';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const STORAGE_KEYS = {
  ATTENDANCE_RANGE_START: 'attendance_range_start',
  ATTENDANCE_RANGE_LENGTH: 'attendance_range_length',
};

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
}

type AttendanceStatus = WorkStatus | null;

interface CellData {
  workerId: number;
  date: string;
  status: AttendanceStatus;
  workType: string | null;
  farmIds: number[];
  existingRecordId?: number;
  isModified: boolean;
}

const STATUS_CYCLE: AttendanceStatus[] = ['full_day', 'half_day', 'absent', null];

const getStatusDisplay = (
  status: AttendanceStatus,
  t: (key: string) => string,
  m3Theme: ReturnType<typeof useM3>,
): {
  label: string;
  bgColor: string;
  badgeColor: string;
  badgeTextColor: string;
  textColor: string;
  fullLabel: string;
} => {
  switch (status) {
    case 'full_day':
      return {
        label: t('attendance.status.fullDayShort'),
        bgColor: colorWithOpacity(m3Theme.colorScheme.primary, 0.12),
        badgeColor: m3Theme.colorScheme.primary,
        badgeTextColor: m3Theme.colorScheme.onPrimary,
        textColor: m3Theme.colorScheme.primary,
        fullLabel: t('attendance.status.fullDay'),
      };
    case 'half_day':
      return {
        label: t('attendance.status.halfDayShort'),
        bgColor: colorWithOpacity(m3Theme.colorScheme.warning, 0.18),
        badgeColor: m3Theme.colorScheme.warning,
        badgeTextColor: m3Theme.colorScheme.onWarning,
        textColor: m3Theme.colorScheme.warning,
        fullLabel: t('attendance.status.halfDay'),
      };
    case 'absent':
      return {
        label: t('attendance.status.absentShort'),
        bgColor: colorWithOpacity(m3Theme.colorScheme.error, 0.12),
        badgeColor: m3Theme.colorScheme.error,
        badgeTextColor: m3Theme.colorScheme.onError,
        textColor: m3Theme.colorScheme.error,
        fullLabel: t('attendance.status.absent'),
      };
    default:
      return {
        label: t('attendance.status.notSetShort'),
        bgColor: m3Theme.surface.surfaceContainerLowest,
        badgeColor: colorWithOpacity(m3Theme.colorScheme.onSurfaceVariant, 0.18),
        badgeTextColor: colorWithOpacity(m3Theme.colorScheme.onSurfaceVariant, 0.7),
        textColor: m3Theme.colorScheme.onSurfaceVariant,
        fullLabel: t('attendance.status.notSet'),
      };
  }
};

interface MarkAttendanceTabProps {
  workers: Worker[];
  farms: Farm[];
  selectedWorkerIndex: number;
  onWorkerIndexChange: (index: number) => void;
  onSaveSuccess: () => void;
  isTourActive?: boolean;
  onBottomActionBarVisibilityChange?: (visible: boolean) => void;
}

export function MarkAttendanceTab({
  workers,
  farms,
  selectedWorkerIndex,
  onWorkerIndexChange,
  onSaveSuccess,
  isTourActive = false,
  onBottomActionBarVisibilityChange,
}: MarkAttendanceTabProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  const tabBarInset = useTabBarInset();
  const bottomActionBarHeight = 88;
  const actionBarBottom = isAndroid ? 0 : tabBarInset;
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFarmIds, setSelectedFarmIds] = useState<number[]>([]);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);
  const [farmSheetVisible, setFarmSheetVisible] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [tempPickerDate, setTempPickerDate] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });
  const [rangeLength, setRangeLength] = useState<number>(7);
  const [isRangeLoaded, setIsRangeLoaded] = useState(false);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLoadRef = useRef(0);
  const farmsRef = useRef(farms);
  farmsRef.current = farms;

  const prevWorkerIdRef = useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const safeIndex = Math.min(selectedWorkerIndex, Math.max(0, workers.length - 1));
  const selectedWorker = workers[safeIndex];

  const [rangeStart, setRangeStart] = useState<Date>(() => normalizeDate(new Date()));

  const rangeEnd = useMemo(() => addDays(rangeStart, rangeLength - 1), [rangeStart, rangeLength]);

  const dateRange = useMemo(() => {
    return Array.from({ length: rangeLength }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, rangeLength]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ visible: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ visible: false, message: '', type: 'success' });
    }, 2500);
  }, []);

  const loadSavedRange = React.useCallback(async () => {
    try {
      const [savedStart, savedLength] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE_RANGE_START),
        AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE_RANGE_LENGTH),
      ]);

      if (savedStart) {
        const parsedStart = new Date(savedStart);
        if (!isNaN(parsedStart.getTime())) {
          setRangeStart(normalizeDate(parsedStart));
        }
      }

      if (savedLength) {
        const parsedLength = parseInt(savedLength, 10);
        if (!isNaN(parsedLength) && parsedLength >= 1 && parsedLength <= 31) {
          setRangeLength(parsedLength);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setIsRangeLoaded(true);
    }
  }, []);

  const saveRange = async (start: Date, length: number) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE_RANGE_START, start.toISOString()),
        AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE_RANGE_LENGTH, length.toString()),
      ]);
    } catch {
      // Silently fail
    }
  };

  const handleRangeStartChange = (newStart: Date) => {
    const normalized = normalizeDate(newStart);
    setRangeStart(normalized);
    saveRange(normalized, rangeLength);
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCellKey = (workerId: number, date: string) => `${workerId}-${date}`;

  const loadAttendance = React.useCallback(async () => {
    if (!selectedWorker || dateRange.length === 0) return;

    const workerId = selectedWorker?.id;
    if (workerId === undefined) return;

    const loadToken = ++latestLoadRef.current;
    setLoading(true);
    try {
      const newCellData = new Map<string, CellData>();
      const startDate = formatDate(dateRange[0]);
      const endDate = formatDate(dateRange[dateRange.length - 1]);

      for (const date of dateRange) {
        const dateStr = formatDate(date);
        const key = getCellKey(workerId, dateStr);
        newCellData.set(key, {
          workerId,
          date: dateStr,
          status: null,
          workType: null,
          farmIds: [],
          isModified: false,
        });
      }

      const records = await fetchAttendanceForWorker(workerId, startDate, endDate);

      // Ignore stale fetch results when a newer load was started.
      if (loadToken !== latestLoadRef.current) return;

      for (const record of records) {
        const key = getCellKey(record.worker_id, record.date);
        newCellData.set(key, {
          workerId: record.worker_id,
          date: record.date,
          status: record.work_status as AttendanceStatus,
          workType: record.work_type,
          farmIds: record.farm_ids || [],
          existingRecordId: record.id,
          isModified: false,
        });
      }

      const workerChanged = prevWorkerIdRef.current !== workerId;
      if (workerChanged) {
        const recordWithFarms = records.find((r) => r.farm_ids && r.farm_ids.length > 0);
        if (recordWithFarms) {
          setSelectedFarmIds(recordWithFarms.farm_ids || []);
        } else if (farmsRef.current.length > 0) {
          const firstWithId = farmsRef.current.find((f) => f.id != null);
          setSelectedFarmIds(firstWithId?.id != null ? [firstWithId.id] : []);
        }
        prevWorkerIdRef.current = workerId;
      }

      // Preserve locally modified cells that haven't been saved yet
      const validDateStrs = new Set(dateRange.map((d) => formatDate(d)));
      setCellData((prev) => {
        const merged = new Map(newCellData);
        prev.forEach((cell, key) => {
          if (cell.isModified && key.startsWith(`${workerId}-`)) {
            const datePart = key.slice(`${workerId}-`.length);
            if (validDateStrs.has(datePart)) {
              merged.set(key, cell);
            }
          }
        });
        return merged;
      });
    } catch {
      if (loadToken !== latestLoadRef.current) return;
      Alert.alert(t('common.error'), t('common.errors.failedToLoadAttendanceData'));
    } finally {
      if (loadToken === latestLoadRef.current) {
        setLoading(false);
      }
    }
  }, [selectedWorker, dateRange, t]);

  React.useEffect(() => {
    loadSavedRange();
  }, [loadSavedRange]);

  React.useEffect(() => {
    if (isRangeLoaded) {
      loadAttendance();
    }
  }, [loadAttendance, isRangeLoaded]);

  const handleDayCellClick = (date: Date) => {
    if (!selectedWorker) return;
    const workerId = selectedWorker.id;
    if (workerId === undefined) return;
    const dateStr = formatDate(date);
    const key = getCellKey(workerId, dateStr);

    triggerHaptic();

    setCellData((prev) => {
      const current = prev.get(key);
      if (!current) return prev;

      const currentIndex = STATUS_CYCLE.indexOf(current.status);
      let nextStatus: AttendanceStatus;
      if (currentIndex === -1) {
        // Unrecognized status from DB — reset to unmarked instead of defaulting to full_day
        nextStatus = null;
      } else {
        nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      }

      const newMap = new Map(prev);
      newMap.set(key, {
        ...current,
        status: nextStatus,
        farmIds: selectedFarmIds,
        isModified: true,
      });
      return newMap;
    });
  };

  const handleQuickAction = (status: AttendanceStatus) => {
    if (!selectedWorker) return;
    const workerId = selectedWorker.id;
    if (workerId === undefined) return;

    triggerHapticMedium();

    setCellData((prev) => {
      const newMap = new Map(prev);
      for (const date of dateRange) {
        const dateStr = formatDate(date);
        const key = getCellKey(workerId, dateStr);
        const current = newMap.get(key);
        if (current) {
          newMap.set(key, {
            ...current,
            status,
            farmIds: selectedFarmIds,
            isModified: true,
          });
        }
      }
      return newMap;
    });
  };

  const handleCopyFromYesterday = async () => {
    if (!selectedWorker) return;
    const workerId = selectedWorker.id;
    if (workerId === undefined) return;

    const yesterday = addDays(rangeStart, -1);
    const yesterdayStr = formatDate(yesterday);

    let yesterdayRecord: WorkerAttendance | null = null;
    try {
      const records = await fetchAttendanceForWorker(workerId, yesterdayStr, yesterdayStr);
      yesterdayRecord = records.length > 0 ? records[0] : null;
    } catch {
      showToast(t('attendance.errors.noYesterdayData'), 'error');
      return;
    }

    if (!yesterdayRecord || !yesterdayRecord.work_status) {
      showToast(t('attendance.errors.noYesterdayData'), 'error');
      return;
    }

    triggerHapticMedium();

    setCellData((prev) => {
      const newMap = new Map(prev);
      for (const date of dateRange) {
        const dateStr = formatDate(date);
        const key = getCellKey(workerId, dateStr);
        const current = newMap.get(key);
        if (current && current.status === null) {
          const copiedStatus = STATUS_CYCLE.includes(
            yesterdayRecord.work_status as AttendanceStatus,
          )
            ? (yesterdayRecord.work_status as AttendanceStatus)
            : null;
          if (copiedStatus === null) {
            continue;
          }
          newMap.set(key, {
            ...current,
            status: copiedStatus,
            workType: yesterdayRecord.work_type,
            farmIds:
              yesterdayRecord.farm_ids && yesterdayRecord.farm_ids.length > 0
                ? yesterdayRecord.farm_ids
                : selectedFarmIds,
            isModified: true,
          });
        }
      }
      return newMap;
    });

    showToast(t('attendance.success.copiedFromYesterday'), 'success');
  };

  const hasModifications = useMemo(() => {
    return Array.from(cellData.values()).some((cell) => cell.isModified);
  }, [cellData]);

  React.useEffect(() => {
    onBottomActionBarVisibilityChange?.(hasModifications);
    return () => onBottomActionBarVisibilityChange?.(false);
  }, [hasModifications, onBottomActionBarVisibilityChange]);

  const handleSave = async () => {
    if (!hasModifications) {
      return;
    }

    const modifiedCells = Array.from(cellData.values()).filter((cell) => cell.isModified);
    const invalidCells = modifiedCells.filter(
      (cell) => cell.status !== null && cell.farmIds.length === 0,
    );
    if (invalidCells.length > 0) {
      Alert.alert(t('common.error'), t('common.errors.selectAtLeastOneFarm'));
      return;
    }

    setSaving(true);
    const errors: Array<{ date: string; error: unknown }> = [];

    for (const cell of modifiedCells) {
      try {
        if (cell.existingRecordId) {
          if (cell.status === null) {
            await deleteAttendance(cell.existingRecordId);
          } else {
            await updateAttendance(cell.existingRecordId, {
              work_status: cell.status as WorkStatus,
              work_type: cell.workType || 'other',
              farm_ids: cell.farmIds,
              daily_rate_override: cell.status === 'absent' ? 0 : undefined,
            });
          }
        } else if (cell.status !== null && cell.farmIds.length > 0) {
          await createAttendance({
            worker_id: cell.workerId,
            farm_ids: cell.farmIds,
            date: cell.date,
            work_status: cell.status as WorkStatus,
            work_type: cell.workType || 'other',
            daily_rate_override: cell.status === 'absent' ? 0 : undefined,
          });
        }
      } catch (error) {
        errors.push({ date: cell.date, error });
      }
    }

    if (errors.length > 0) {
      showToast(t('attendance.alerts.partialErrorBody', { count: errors.length }), 'error');
      prevWorkerIdRef.current = undefined;
      setSaving(false);
      loadAttendance();
      return;
    }

    triggerHapticSuccess();
    showToast(t('attendance.alerts.savedBody', { name: selectedWorker?.name ?? '' }), 'success');
    onSaveSuccess();
    prevWorkerIdRef.current = undefined;
    setSaving(false);
    loadAttendance();
  };

  const handleWorkerSelect = () => {
    if (workers.length === 0) return;
    setWorkerSheetVisible(true);
  };

  const handleDateRangeChange = (type: 'from' | 'to', event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      if (isAndroid) {
        if (type === 'from') setShowFromPicker(false);
        if (type === 'to') setShowToPicker(false);
      }
      return;
    }

    if (date) {
      const normalized = normalizeDate(date);
      if (type === 'from') {
        handleRangeStartChange(normalized);
      } else {
        const newStart = addDays(normalized, -(rangeLength - 1));
        handleRangeStartChange(newStart);
      }
    }

    if (isAndroid) {
      if (type === 'from') setShowFromPicker(false);
      if (type === 'to') setShowToPicker(false);
    }
  };

  const activePickerType: 'from' | 'to' | null = showFromPicker
    ? 'from'
    : showToPicker
      ? 'to'
      : null;
  const closePickers = () => {
    setShowFromPicker(false);
    setShowToPicker(false);
    setTempPickerDate(null);
  };

  const confirmPickerDate = () => {
    if (tempPickerDate && activePickerType) {
      const normalized = normalizeDate(tempPickerDate);
      if (activePickerType === 'from') {
        handleRangeStartChange(normalized);
      } else {
        const newStart = addDays(normalized, -(rangeLength - 1));
        handleRangeStartChange(newStart);
      }
    }
    closePickers();
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getDayName = (date: Date): string => {
    return formatDateLocalized(date, { weekday: 'short' });
  };

  const formatShortDate = (date: Date) => {
    return formatDateLocalized(date, { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      </View>
    );
  }

  if (!selectedWorker) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: m3.colorScheme.surface,
          padding: spacing[6],
        }}
      >
        <UiSymbol
          name="person.2"
          size={28}
          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
        />
        <Text style={{ marginTop: spacing[3], color: m3.colorScheme.onSurfaceVariant }}>
          {t('attendance.empty.noWorkersTitle')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: bottomActionBarHeight + actionBarBottom + spacing[6],
          gap: spacing[3],
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Filters Section ── */}
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2] }}>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: spacing[2],
            }}
          >
            {t('attendance.filters.label')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Pressable
              onPress={handleWorkerSelect}
              accessibilityRole="button"
              accessibilityLabel={t('attendance.a11y.selectWorkerButton')}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                backgroundColor: m3.surface.surfaceContainerLow,
                overflow: 'hidden',
                ...(pressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null),
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UiSymbol name="person" size={14} color={m3.colorScheme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.filters.worker')}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.onSurface,
                      marginTop: 1,
                    }}
                  >
                    {selectedWorker?.name || t('attendance.filters.allWorkers')}
                  </Text>
                </View>
                <UiSymbol
                  name="chevron.down"
                  size={12}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
                />
              </View>
            </Pressable>
            <Pressable
              onPress={() => setFarmSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('attendance.a11y.selectFarmsButton')}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                backgroundColor: m3.surface.surfaceContainerLow,
                overflow: 'hidden',
                ...(pressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null),
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UiSymbol name="leaf" size={14} color={m3.colorScheme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.filters.farms')}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.onSurface,
                      marginTop: 1,
                    }}
                  >
                    {selectedFarmIds.length > 0
                      ? t('attendance.filters.farmsSelected', { count: selectedFarmIds.length })
                      : t('attendance.filters.allFarms')}
                  </Text>
                </View>
                <UiSymbol
                  name="chevron.down"
                  size={12}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5)}
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── Date Range Section ── */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing[2],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('attendance.dateRange.label')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] }}>
            <Pressable
              onPress={() => {
                setShowFromPicker(true);
                setShowToPicker(false);
              }}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                backgroundColor: m3.surface.surfaceContainerLow,
                ...(pressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null),
              })}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {t('common.from')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[1],
                  color: m3.colorScheme.onSurface,
                }}
              >
                {formatShortDate(rangeStart)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowToPicker(true);
                setShowFromPicker(false);
              }}
              style={({ pressed }) => ({
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                backgroundColor: m3.surface.surfaceContainerLow,
                ...(pressed
                  ? {
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.onSurface,
                        m3.stateLayerOpacity.pressed,
                      ),
                    }
                  : null),
              })}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {t('common.to')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[1],
                  color: m3.colorScheme.onSurface,
                }}
              >
                {formatShortDate(rangeEnd)}
              </Text>
            </Pressable>
          </View>

          {isIOS ? (
            activePickerType ? (
              <Modal transparent animationType="fade" onRequestClose={closePickers}>
                <Pressable
                  onPress={closePickers}
                  style={{
                    flex: 1,
                    backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      backgroundColor: m3.colorScheme.surface,
                      borderTopLeftRadius: borderRadius['3xl'],
                      borderTopRightRadius: borderRadius['3xl'],
                      padding: spacing[4],
                      paddingBottom: spacing[6],
                    }}
                    onStartShouldSetResponder={() => true}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: spacing[3],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          color: m3.colorScheme.onSurface,
                        }}
                      >
                        {activePickerType === 'from' ? t('common.from') : t('common.to')}
                      </Text>
                      <Pressable onPress={closePickers}>
                        <UiSymbol
                          name="xmark"
                          size={18}
                          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                        />
                      </Pressable>
                    </View>
                    <DateTimePicker
                      value={
                        tempPickerDate ?? (activePickerType === 'from' ? rangeStart : rangeEnd)
                      }
                      mode="date"
                      display="spinner"
                      onChange={(_event, date) => {
                        if (date) setTempPickerDate(date);
                      }}
                      textColor={m3.colorScheme.onSurface}
                      style={{ height: 200 }}
                    />
                    <Pressable
                      onPress={confirmPickerDate}
                      style={{
                        marginTop: spacing[3],
                        paddingVertical: spacing[3],
                        borderRadius: m3.shape.cornerMedium,
                        borderCurve: 'continuous',
                        alignItems: 'center',
                        backgroundColor: m3.colorScheme.primary,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                          color: m3.colorScheme.onPrimary,
                        }}
                      >
                        {t('common.done')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              </Modal>
            ) : null
          ) : (
            <>
              {showFromPicker && (
                <DateTimePicker
                  value={rangeStart}
                  mode="date"
                  display="default"
                  onChange={(event, date) => handleDateRangeChange('from', event, date)}
                />
              )}
              {showToPicker && (
                <DateTimePicker
                  value={rangeEnd}
                  mode="date"
                  display="default"
                  onChange={(event, date) => handleDateRangeChange('to', event, date)}
                />
              )}
            </>
          )}
        </View>

        {/* ── Day Cells Grid ── */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing[2],
            }}
          >
            {selectedWorker?.id != null
              ? (() => {
                  const workerId = selectedWorker.id;
                  return dateRange.map((date) => {
                    const dateStr = formatDate(date);
                    const key = getCellKey(workerId, dateStr);
                    const cell = cellData.get(key);
                    const statusInfo = getStatusDisplay(cell?.status ?? null, t, m3);
                    const isTodayDate = isToday(date);
                    const hasStatus = cell?.status !== null;
                    const isIdleToday = isTodayDate && !hasStatus;

                    const isFirst = dateRange.indexOf(date) === 0;

                    const cellPressable = (
                      <Pressable
                        key={dateStr}
                        onPress={() => handleDayCellClick(date)}
                        accessibilityRole="button"
                        accessibilityLabel={t('attendance.a11y.dayStatus', {
                          day: getDayName(date),
                          date: date.getDate(),
                          status: statusInfo.fullLabel,
                        })}
                        style={({ pressed }) => ({
                          flex: 1,
                          aspectRatio: 0.48,
                          borderRadius: m3.shape.cornerMedium,
                          borderCurve: 'continuous',
                          backgroundColor: hasStatus
                            ? statusInfo.bgColor
                            : isIdleToday
                              ? colorWithOpacity(m3.colorScheme.primary, 0.06)
                              : m3.surface.surfaceContainerLow,
                          overflow: 'hidden',
                          ...(isTodayDate
                            ? {
                                borderWidth: 2,
                                borderColor: colorWithOpacity(m3.colorScheme.primary, 0.4),
                              }
                            : null),
                          ...(pressed
                            ? {
                                opacity: 0.8,
                              }
                            : null),
                        })}
                      >
                        <View
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 3,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.semibold,
                              textTransform: 'uppercase',
                              letterSpacing: 0.3,
                              color: isTodayDate
                                ? m3.colorScheme.primary
                                : hasStatus
                                  ? statusInfo.textColor
                                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                            }}
                          >
                            {getDayName(date)}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.bold,
                              fontVariant: ['tabular-nums'],
                              color: isTodayDate
                                ? m3.colorScheme.primary
                                : hasStatus
                                  ? statusInfo.textColor
                                  : m3.colorScheme.onSurface,
                            }}
                          >
                            {date.getDate()}
                          </Text>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: borderRadius.full,
                              backgroundColor: hasStatus
                                ? statusInfo.badgeColor
                                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.sm,
                                lineHeight: 14,
                                fontWeight: fontWeight.bold,
                                textAlign: 'center',
                                ...(isAndroid
                                  ? { includeFontPadding: false, textAlignVertical: 'center' }
                                  : null),
                                color: hasStatus
                                  ? statusInfo.badgeTextColor
                                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.5),
                              }}
                            >
                              {statusInfo.label}
                            </Text>
                          </View>
                          {cell?.existingRecordId && (
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 4,
                                width: 5,
                                height: 5,
                                borderRadius: radius.xs,
                                backgroundColor: m3.colorScheme.primary,
                              }}
                            />
                          )}
                        </View>
                      </Pressable>
                    );

                    return isFirst ? (
                      <GuidedTourTarget
                        key={dateStr}
                        targetId={GUIDED_TOUR_TARGET_IDS.WORKERS_MARK_DAY_CELL}
                        enabled={isTourActive}
                        style={{ flex: 1 }}
                      >
                        {cellPressable}
                      </GuidedTourTarget>
                    ) : (
                      cellPressable
                    );
                  });
                })()
              : null}
          </View>
        </View>

        {/* ── Tap hint (only show during tour mode) ── */}
        {isTourActive && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={{ alignItems: 'center', marginTop: spacing[2] }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                textAlign: 'center',
              }}
            >
              {t('attendance.tapHint')}
            </Text>
          </Animated.View>
        )}

        {/* ── Quick Actions ── */}
        <View style={{ paddingHorizontal: spacing[4] }}>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[2],
            }}
          >
            <Pressable
              onPress={() => handleQuickAction('full_day')}
              accessibilityRole="button"
              accessibilityLabel={t('attendance.a11y.setAllFullDay')}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[1],
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <UiSymbol name="checkmark.circle.fill" size={15} color={m3.colorScheme.primary} />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.primary,
                }}
              >
                {t('attendance.quickActions.allFull')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAction('half_day')}
              accessibilityRole="button"
              accessibilityLabel={t('attendance.a11y.setAllHalfDay')}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[1],
                backgroundColor: colorWithOpacity(m3.colorScheme.warning, 0.12),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <UiSymbol name="clock.fill" size={15} color={m3.colorScheme.warning} />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.warning,
                }}
              >
                {t('attendance.quickActions.allHalf')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickAction('absent')}
              accessibilityRole="button"
              accessibilityLabel={t('attendance.a11y.setAllAbsent')}
              style={({ pressed }) => ({
                flex: 1,
                height: 44,
                borderRadius: m3.shape.cornerMedium,
                borderCurve: 'continuous',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[1],
                backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <UiSymbol name="xmark.circle.fill" size={15} color={m3.colorScheme.error} />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.error,
                }}
              >
                {t('attendance.quickActions.allOff')}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleCopyFromYesterday}
            accessibilityRole="button"
            accessibilityLabel={t('attendance.a11y.copyFromYesterday')}
            style={({ pressed }) => ({
              marginTop: spacing[2],
              height: 40,
              borderRadius: m3.shape.cornerMedium,
              borderCurve: 'continuous',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[2],
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              backgroundColor: 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <UiSymbol
              name="arrow.uturn.backward"
              size={14}
              color={m3.colorScheme.onSurfaceVariant}
            />
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('attendance.quickActions.copyFromYesterday')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar — only visible when there are unsaved changes ── */}
      {hasModifications && (
        <Animated.View
          entering={FadeInUp.duration(250)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: actionBarBottom + spacing[3],
            backgroundColor: m3.surface.surfaceContainerLow,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOutUp.duration(150)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[2],
              marginBottom: spacing[2],
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.xs,
                backgroundColor: m3.colorScheme.warning,
              }}
            />
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.warning,
              }}
            >
              {t('attendance.week.unsavedChanges')}
            </Text>
          </Animated.View>
          <Pressable
            onPress={handleSave}
            disabled={saving || !hasModifications}
            accessibilityRole="button"
            accessibilityLabel={
              saving ? t('attendance.a11y.savingAttendance') : t('attendance.a11y.saveAttendance')
            }
            style={({ pressed }) => ({
              borderRadius: m3.shape.cornerLarge,
              borderCurve: 'continuous',
              paddingVertical: 16,
              backgroundColor: hasModifications
                ? m3.colorScheme.primary
                : m3.colorScheme.surfaceVariant,
              overflow: 'hidden',
              transform: [{ scale: pressed && hasModifications ? 0.97 : 1 }],
              ...(hasModifications ? shadows.lg : {}),
              opacity: saving ? 0.8 : hasModifications ? 1 : 0.5,
            })}
          >
            {saving ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[2],
                }}
              >
                <ActivityIndicator size="small" color={m3.colorScheme.onPrimary} />
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.onPrimary,
                  }}
                >
                  {t('attendance.buttons.saving')}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[2],
                }}
              >
                {hasModifications && (
                  <UiSymbol
                    name="checkmark.circle.fill"
                    size={20}
                    color={m3.colorScheme.onPrimary}
                  />
                )}
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.bold,
                    color: hasModifications
                      ? m3.colorScheme.onPrimary
                      : m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('common.save')}
                </Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      )}

      <WorkerSelectSheet
        visible={workerSheetVisible}
        title={t('attendance.sheet.selectWorkerTitle')}
        subtitle={t('attendance.sheet.selectWorkerSubtitle')}
        workers={workers}
        selectedWorkerId={selectedWorker?.id ?? null}
        onSelect={(workerId) => {
          const index = workers.findIndex((worker) => worker.id === workerId);
          if (index >= 0) onWorkerIndexChange(index);
          setWorkerSheetVisible(false);
        }}
        onClose={() => setWorkerSheetVisible(false)}
      />
      <FarmSelectSheet
        visible={farmSheetVisible}
        farms={farms}
        selectedFarmIds={selectedFarmIds}
        onApply={(farmIds) => {
          setSelectedFarmIds(farmIds);
          setFarmSheetVisible(false);
        }}
        onClose={() => setFarmSheetVisible(false)}
      />

      {toast.visible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            top: spacing[4],
            left: spacing[4],
            right: spacing[4],
            paddingVertical: spacing[3],
            paddingHorizontal: spacing[4],
            borderRadius: m3.shape.cornerLarge,
            borderCurve: 'continuous',
            backgroundColor:
              toast.type === 'success' ? m3.colorScheme.primary : m3.colorScheme.error,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            zIndex: 100,
            ...shadows.lg,
          }}
        >
          <UiSymbol
            name={
              toast.type === 'success' ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'
            }
            size={20}
            color={toast.type === 'success' ? m3.colorScheme.onPrimary : m3.colorScheme.onError}
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: toast.type === 'success' ? m3.colorScheme.onPrimary : m3.colorScheme.onError,
            }}
          >
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

async function fetchAttendanceForWorker(
  workerId: number,
  startDate: string,
  endDate: string,
): Promise<WorkerAttendance[]> {
  const { data, error } = await supabase
    .from('worker_attendance')
    .select('*')
    .eq('worker_id', workerId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    throw new Error('Failed to fetch attendance');
  }

  return data || [];
}

async function createAttendance(data: WorkerAttendanceInsert): Promise<WorkerAttendance> {
  const { data: result, error } = await supabase
    .from('worker_attendance')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error('Failed to create attendance');
  }

  return result;
}

async function updateAttendance(
  id: number,
  data: Partial<WorkerAttendanceInsert>,
): Promise<WorkerAttendance> {
  const { data: result, error } = await supabase
    .from('worker_attendance')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error('Failed to update attendance');
  }

  return result;
}

async function deleteAttendance(id: number): Promise<void> {
  const { error } = await supabase.from('worker_attendance').delete().eq('id', id);

  if (error) {
    throw new Error('Failed to delete attendance');
  }
}
