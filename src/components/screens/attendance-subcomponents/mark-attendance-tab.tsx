import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
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
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTabBarInset, isAndroid } from '@/hooks';
import { WorkerSelectSheet, FarmSelectSheet } from './index';
import { formatDate as formatDateLocalized } from '@/i18n/format';
import { normalizeDate, addDays } from '@/utils/worker-analytics';

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

const _getStatusDisplay = (
  status: AttendanceStatus,
  t: (key: string) => string,
  m3Theme: ReturnType<typeof useM3>,
  colors: ReturnType<typeof useThemeColors>,
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
        bgColor: colorWithOpacity(colors.warning, 0.18),
        badgeColor: colors.warning,
        badgeTextColor: m3Theme.colorScheme.onWarning,
        textColor: colors.warning,
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
  isTourActive: _isTourActive = false,
  onBottomActionBarVisibilityChange,
}: MarkAttendanceTabProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();

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

  // Original date range state
  const [rangeStart, setRangeStart] = useState<Date>(() => normalizeDate(new Date()));

  // NEW: Single date for the redesigned UI
  const [selectedDate, setSelectedDate] = useState<Date>(() => normalizeDate(new Date()));

  const _rangeEnd = useMemo(() => addDays(rangeStart, rangeLength - 1), [rangeStart, rangeLength]);

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
        } else if (farms.length > 0) {
          setSelectedFarmIds([farms[0].id!]);
        }
        prevWorkerIdRef.current = workerId;
      }

      setCellData(newCellData);
    } catch {
      Alert.alert(t('common.error'), t('common.errors.failedToLoadAttendanceData'));
    } finally {
      setLoading(false);
    }
  }, [selectedWorker, dateRange, farms, t]);

  React.useEffect(() => {
    loadSavedRange();
  }, [loadSavedRange]);

  React.useEffect(() => {
    if (isRangeLoaded) {
      loadAttendance();
    }
  }, [loadAttendance, isRangeLoaded]);

  const _handleDayCellClick = (date: Date) => {
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
      const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
      const nextStatus = STATUS_CYCLE[nextIndex];

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

  const _handleQuickAction = (status: AttendanceStatus) => {
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

  const _handleCopyFromYesterday = async () => {
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
          newMap.set(key, {
            ...current,
            status: yesterdayRecord.work_status as AttendanceStatus,
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

  // Keep rangeStart in sync with selectedDate so attendance data is always loaded
  React.useEffect(() => {
    const rangeEnd = addDays(rangeStart, rangeLength - 1);
    if (selectedDate < rangeStart || selectedDate > rangeEnd) {
      const newStart = normalizeDate(addDays(selectedDate, -Math.floor(rangeLength / 2)));
      setRangeStart(newStart);
      saveRange(newStart, rangeLength);
    }
  }, [selectedDate, rangeStart, rangeLength]);

  // NEW: Handle date navigation
  const handleDateNavigation = (dir: 'prev' | 'next') => {
    const newDate = dir === 'prev' ? addDays(selectedDate, -1) : addDays(selectedDate, 1);
    setSelectedDate(normalizeDate(newDate));
  };

  // NEW: Handle worker attendance change - now writes to canonical cellData
  const handleWorkerAttendanceChange = (workerId: number, status: AttendanceStatus) => {
    if (workerId === undefined) return;
    triggerHaptic();
    const dateStr = formatDate(selectedDate);
    const key = getCellKey(workerId, dateStr);

    setCellData((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(key);
      newMap.set(key, {
        workerId,
        date: dateStr,
        status,
        workType: null,
        farmIds: selectedFarmIds,
        existingRecordId: current?.existingRecordId,
        isModified: true,
      });
      return newMap;
    });
  };

  // NEW: Handle Mark All Present - now writes to canonical cellData
  const handleMarkAllPresent = () => {
    triggerHapticMedium();
    const dateStr = formatDate(selectedDate);
    setCellData((prev) => {
      const newMap = new Map(prev);
      workers.forEach((w) => {
        if (w.id != null) {
          const key = getCellKey(w.id, dateStr);
          const current = newMap.get(key);
          newMap.set(key, {
            workerId: w.id,
            date: dateStr,
            status: 'full_day',
            workType: null,
            farmIds: selectedFarmIds,
            existingRecordId: current?.existingRecordId,
            isModified: true,
          });
        }
      });
      return newMap;
    });
  };

  // NEW: Helper to get initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  // NEW: Format date for display
  const formatDisplayDate = (date: Date) =>
    formatDateLocalized(date, { day: 'numeric', month: 'short', year: 'numeric' });

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

  const _handleWorkerSelect = () => {
    if (workers.length === 0) return;
    setWorkerSheetVisible(true);
  };

  const _handleDateRangeChange = (type: 'from' | 'to', event: unknown, date?: Date) => {
    if ((event as { type: string }).type === 'dismissed') {
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

  const _confirmPickerDate = () => {
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

  const _isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const _getDayName = (date: Date): string => {
    return formatDateLocalized(date, { weekday: 'short' });
  };

  const _formatShortDate = (date: Date) => {
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
        {/* NEW: Date Navigator */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing[3],
            backgroundColor: m3.surface.surfaceContainerLow,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            marginBottom: spacing[2],
          }}
        >
          <Pressable
            onPress={() => handleDateNavigation('prev')}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: borderRadius.sm,
              backgroundColor: m3.colorScheme.surface,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 18, color: m3.colorScheme.primary, fontWeight: '600' }}>
              ‹
            </Text>
          </Pressable>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {formatDisplayDate(selectedDate)}
          </Text>
          <Pressable
            onPress={() => handleDateNavigation('next')}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: borderRadius.sm,
              backgroundColor: m3.colorScheme.surface,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 18, color: m3.colorScheme.primary, fontWeight: '600' }}>
              ›
            </Text>
          </Pressable>
        </View>

        {/* NEW: Summary Pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
            marginBottom: spacing[3],
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success }}
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('attendance.mark.workersCount', { count: workers.length })}
          </Text>
        </View>

        {/* NEW: Worker List */}
        {workers.map((worker) => {
          if (worker.id === undefined) return null;
          const dateStr = formatDate(selectedDate);
          const key = getCellKey(worker.id, dateStr);
          const cell = cellData.get(key);
          const status = cell?.status ?? null;
          const avatarBg = colors.labour ? colors.labour[500] : '#7A5E8E';
          return (
            <View
              key={worker.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing[3],
                backgroundColor: m3.surface.surfaceContainerLow,
                borderRadius: borderRadius.md,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                marginBottom: spacing[2],
                gap: spacing[3],
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: avatarBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#FFFFFF' }}
                >
                  {getInitials(worker.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                  numberOfLines={1}
                >
                  {worker.name}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    marginTop: 2,
                  }}
                >
                  {worker.daily_rate
                    ? t('attendance.mark.dailyRate', { rate: worker.daily_rate })
                    : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[1] }}>
                <Pressable
                  onPress={() =>
                    worker.id !== undefined && handleWorkerAttendanceChange(worker.id, 'full_day')
                  }
                  style={{
                    paddingHorizontal: spacing[2] + 2,
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.pill,
                    backgroundColor:
                      status === 'full_day' ? '#4F7A5A' : m3.surface.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: status === 'full_day' ? '#4F7A5A' : m3.colorScheme.outlineVariant,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: status === 'full_day' ? '#FFFFFF' : '#4F7A5A',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.xs - 1,
                      fontWeight: fontWeight.bold,
                      color: status === 'full_day' ? '#FFFFFF' : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.mark.full')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    worker.id !== undefined && handleWorkerAttendanceChange(worker.id, 'half_day')
                  }
                  style={{
                    paddingHorizontal: spacing[2] + 2,
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.pill,
                    backgroundColor:
                      status === 'half_day' ? '#C58A2B' : m3.surface.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: status === 'half_day' ? '#C58A2B' : m3.colorScheme.outlineVariant,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: status === 'half_day' ? '#FFFFFF' : '#C58A2B',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.xs - 1,
                      fontWeight: fontWeight.bold,
                      color: status === 'half_day' ? '#FFFFFF' : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.mark.half')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    worker.id !== undefined && handleWorkerAttendanceChange(worker.id, 'absent')
                  }
                  style={{
                    paddingHorizontal: spacing[2] + 2,
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.pill,
                    backgroundColor:
                      status === 'absent' ? '#B84C3A' : m3.surface.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor: status === 'absent' ? '#B84C3A' : m3.colorScheme.outlineVariant,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: status === 'absent' ? '#FFFFFF' : '#B84C3A',
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.xs - 1,
                      fontWeight: fontWeight.bold,
                      color: status === 'absent' ? '#FFFFFF' : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.mark.absent')}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* NEW: Mark All Present - sticky at bottom */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: actionBarBottom,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          backgroundColor: m3.colorScheme.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: m3.colorScheme.outlineVariant,
        }}
      >
        <Pressable
          onPress={handleMarkAllPresent}
          style={{
            paddingVertical: spacing[3] + 2,
            borderRadius: borderRadius.sm,
            backgroundColor: m3.colorScheme.primary,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onPrimary,
            }}
          >
            {t('attendance.mark.markAllPresent')}
          </Text>
        </Pressable>
      </View>

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
                borderRadius: 3,
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
