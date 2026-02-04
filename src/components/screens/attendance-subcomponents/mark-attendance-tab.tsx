import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { supabase } from '@/lib/supabase';
import type { Farm, Worker, WorkerAttendance, WorkerAttendanceInsert, WorkStatus } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { WorkerSelectSheet, FarmSelectSheet } from './index';
import { formatDate as formatDateLocalized } from '@/i18n/format';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

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
        badgeTextColor: m3Theme.colorScheme.onPrimary,
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
}

export function MarkAttendanceTab({
  workers,
  farms,
  selectedWorkerIndex,
  onWorkerIndexChange,
  onSaveSuccess,
}: MarkAttendanceTabProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();

  const tabBarInset = useTabBarInset();
  const bottomActionBarHeight = 88;
  const isAndroid = Platform.OS === 'android';
  const actionBarBottom = isAndroid ? 0 : tabBarInset;
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFarmIds, setSelectedFarmIds] = useState<number[]>([]);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);
  const [farmSheetVisible, setFarmSheetVisible] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const prevWorkerIdRef = useRef<number | undefined>(undefined);
  const rangeInitWorkerIdRef = useRef<number | undefined>(undefined);

  const safeIndex = Math.min(selectedWorkerIndex, Math.max(0, workers.length - 1));
  const selectedWorker = workers[safeIndex];

  const normalizeDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const [rangeStart, setRangeStart] = useState<Date>(() => normalizeDate(new Date()));

  const rangeEnd = useMemo(() => addDays(rangeStart, 6), [rangeStart]);

  const dateRange = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart]);

  const getNextAttendanceStart = React.useCallback(async (workerId: number) => {
    const latestDate = await fetchLatestAttendanceDate(workerId);
    if (!latestDate) {
      return normalizeDate(new Date());
    }

    const parsed = new Date(`${latestDate}T00:00:00`);
    return addDays(parsed, 1);
  }, []);

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

    if (rangeInitWorkerIdRef.current !== workerId) {
      const nextStart = await getNextAttendanceStart(workerId);
      rangeInitWorkerIdRef.current = workerId;
      if (nextStart) {
        setRangeStart(nextStart);
        return;
      }
    }

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
  }, [selectedWorker, dateRange, farms, t, getNextAttendanceStart]);

  React.useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleDayCellClick = (date: Date) => {
    if (!selectedWorker) return;
    const workerId = selectedWorker.id;
    if (workerId === undefined) return;
    const dateStr = formatDate(date);
    const key = getCellKey(workerId, dateStr);

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

  const handleQuickAction = (status: AttendanceStatus) => {
    if (!selectedWorker) return;
    const workerId = selectedWorker.id;
    if (workerId === undefined) return;

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

  const hasModifications = useMemo(() => {
    return Array.from(cellData.values()).some((cell) => cell.isModified);
  }, [cellData]);

  const handleSaveAndNext = async () => {
    if (!hasModifications) {
      goToNextWorker();
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
      Alert.alert(
        t('attendance.alerts.partialErrorTitle'),
        t('attendance.alerts.partialErrorBody', { count: errors.length }),
      );
      prevWorkerIdRef.current = undefined;
      setSaving(false);
      loadAttendance();
      return;
    }

    Alert.alert(
      t('attendance.alerts.savedTitle'),
      t('attendance.alerts.savedBody', { name: selectedWorker?.name ?? '' }),
    );
    onSaveSuccess();

    setCellData((prev) => {
      const newMap = new Map(prev);
      for (const [key, cell] of newMap) {
        if (cell.isModified) {
          newMap.set(key, { ...cell, isModified: false });
        }
      }
      return newMap;
    });

    setSaving(false);
    goToNextWorker();
  };

  const goToNextWorker = () => {
    if (selectedWorkerIndex < workers.length - 1) {
      onWorkerIndexChange(selectedWorkerIndex + 1);
    } else {
      Alert.alert(t('attendance.alerts.completeTitle'), t('attendance.alerts.completeBody'));
    }
  };

  const handleWorkerSelect = () => {
    if (workers.length === 0) return;
    setWorkerSheetVisible(true);
  };

  const handleDateRangeChange = (type: 'from' | 'to', event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      if (Platform.OS === 'android') {
        if (type === 'from') setShowFromPicker(false);
        if (type === 'to') setShowToPicker(false);
      }
      return;
    }

    if (date) {
      const normalized = normalizeDate(date);
      if (type === 'from') {
        setRangeStart(normalized);
      } else {
        setRangeStart(addDays(normalized, -6));
      }
    }

    if (Platform.OS === 'android') {
      if (type === 'from') setShowFromPicker(false);
      if (type === 'to') setShowToPicker(false);
    }
  };

  const isIos = Platform.OS === 'ios';
  const activePickerType: 'from' | 'to' | null = showFromPicker
    ? 'from'
    : showToPicker
      ? 'to'
      : null;
  const closePickers = () => {
    setShowFromPicker(false);
    setShowToPicker(false);
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
          paddingBottom: bottomActionBarHeight + actionBarBottom + spacing[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}>
          <View
            style={{
              borderRadius: m3.shape.cornerLarge,
              padding: spacing[3],
              backgroundColor: m3.surface.surfaceContainerLow,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurfaceVariant,
              }}
            >
              {t('attendance.filters.label')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
              <Pressable
                onPress={handleWorkerSelect}
                accessibilityRole="button"
                accessibilityLabel={t('attendance.a11y.selectWorkerButton')}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: m3.shape.cornerMedium,
                  borderWidth: 1,
                  backgroundColor: m3.surface.surfaceContainerLowest,
                  borderColor: m3.colorScheme.outlineVariant,
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <UiSymbol name="person" size={16} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.filters.worker')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {selectedWorker?.name || t('attendance.filters.allWorkers')}
                  </Text>
                  <UiSymbol
                    name="chevron.down"
                    size={14}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)}
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
                  paddingVertical: spacing[2],
                  borderRadius: m3.shape.cornerMedium,
                  borderWidth: 1,
                  backgroundColor: m3.surface.surfaceContainerLowest,
                  borderColor: m3.colorScheme.outlineVariant,
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <UiSymbol name="leaf" size={16} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('attendance.filters.farms')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {selectedFarmIds.length > 0
                      ? t('attendance.filters.farmsSelected', { count: selectedFarmIds.length })
                      : t('attendance.filters.allFarms')}
                  </Text>
                  <UiSymbol
                    name="chevron.down"
                    size={14}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8)}
                  />
                </View>
              </Pressable>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: m3.colorScheme.outlineVariant,
                opacity: 0.6,
                marginVertical: spacing[3],
              }}
            />

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
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
              >
                {t('attendance.dateRange.label')}
              </Text>
              <View
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  backgroundColor: hasModifications
                    ? colorWithOpacity(m3.colorScheme.warning, 0.18)
                    : m3.colorScheme.primaryContainer,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    color: hasModifications ? m3.colorScheme.warning : m3.colorScheme.primary,
                  }}
                >
                  {hasModifications
                    ? t('attendance.week.unsavedChanges')
                    : t('attendance.week.upToDate')}
                </Text>
              </View>
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
                  paddingVertical: spacing[2],
                  borderRadius: m3.shape.cornerMedium,
                  borderWidth: 1,
                  backgroundColor: m3.surface.surfaceContainerLowest,
                  borderColor: m3.colorScheme.outlineVariant,
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
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('common.from')}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
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
                  paddingVertical: spacing[2],
                  borderRadius: m3.shape.cornerMedium,
                  borderWidth: 1,
                  backgroundColor: m3.surface.surfaceContainerLowest,
                  borderColor: m3.colorScheme.outlineVariant,
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
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurfaceVariant,
                  }}
                >
                  {t('common.to')}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {formatShortDate(rangeEnd)}
                </Text>
              </Pressable>
            </View>

            {isIos ? (
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
                        value={activePickerType === 'from' ? rangeStart : rangeEnd}
                        mode="date"
                        display="spinner"
                        onChange={(event, date) =>
                          handleDateRangeChange(activePickerType, event, date)
                        }
                        textColor={m3.colorScheme.onSurface}
                        style={{ height: 200 }}
                      />
                      <Pressable
                        onPress={closePickers}
                        style={{
                          marginTop: spacing[3],
                          paddingVertical: spacing[3],
                          borderRadius: m3.shape.cornerMedium,
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

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing[2],
                marginBottom: spacing[3],
              }}
            >
              {selectedWorker && selectedWorker.id
                ? (() => {
                    const workerId = selectedWorker.id;
                    return dateRange.map((date) => {
                      const dateStr = formatDate(date);
                      const key = getCellKey(workerId, dateStr);
                      const cell = cellData.get(key);
                      const statusInfo = getStatusDisplay(cell?.status ?? null, t, m3, colors);
                      const isTodayDate = isToday(date);
                      const hasStatus = cell?.status !== null;
                      const isIdleToday = isTodayDate && !hasStatus;

                      return (
                        <Pressable
                          key={dateStr}
                          onPress={() => handleDayCellClick(date)}
                          accessibilityRole="button"
                          accessibilityLabel={t('attendance.a11y.dayStatus', {
                            day: getDayName(date),
                            date: date.getDate(),
                            status: statusInfo.fullLabel,
                          })}
                          style={{
                            width: '13%',
                            aspectRatio: 0.5,
                            borderRadius: m3.shape.cornerMedium,
                            borderWidth: 1,
                            borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.7),
                            backgroundColor: hasStatus
                              ? statusInfo.bgColor
                              : isIdleToday
                                ? colorWithOpacity(m3.colorScheme.primary, 0.08)
                                : m3.surface.surfaceContainerLowest,
                            overflow: 'hidden',
                          }}
                        >
                          {({ pressed }) => (
                            <View
                              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: fontWeight.semibold,
                                  textTransform: 'uppercase',
                                  color: isTodayDate
                                    ? m3.colorScheme.primary
                                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
                                }}
                              >
                                {getDayName(date)}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: fontWeight.bold,
                                  marginTop: 2,
                                  color: isTodayDate
                                    ? m3.colorScheme.primary
                                    : m3.colorScheme.onSurface,
                                }}
                              >
                                {date.getDate()}
                              </Text>
                              <View
                                style={{
                                  marginTop: spacing[1],
                                  width: 38,
                                  height: 38,
                                  borderRadius: borderRadius.full,
                                  backgroundColor: hasStatus
                                    ? statusInfo.badgeColor
                                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 15,
                                    lineHeight: 16,
                                    fontWeight: fontWeight.bold,
                                    textAlign: 'center',
                                    ...(Platform.OS === 'android'
                                      ? { includeFontPadding: false, textAlignVertical: 'center' }
                                      : null),
                                    color: hasStatus
                                      ? statusInfo.badgeTextColor
                                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
                                  }}
                                >
                                  {statusInfo.label}
                                </Text>
                              </View>
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
                      );
                    });
                  })()
                : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                gap: spacing[3],
              }}
            >
              <Pressable
                onPress={() => handleQuickAction('full_day')}
                accessibilityRole="button"
                accessibilityLabel={t('attendance.a11y.setAllFullDay')}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: m3.shape.cornerMedium,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  overflow: 'hidden',
                }}
              >
                {({ pressed }) => (
                  <>
                    <UiSymbol
                      name="checkmark.circle.fill"
                      size={16}
                      color={m3.colorScheme.primary}
                    />
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                        marginLeft: spacing[2],
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {t('attendance.quickActions.allFull')}
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
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleQuickAction('half_day')}
                accessibilityRole="button"
                accessibilityLabel={t('attendance.a11y.setAllHalfDay')}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: m3.shape.cornerMedium,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.warning, 0.18),
                  overflow: 'hidden',
                }}
              >
                {({ pressed }) => (
                  <>
                    <UiSymbol name="clock.fill" size={16} color={m3.colorScheme.warning} />
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                        marginLeft: spacing[2],
                        color: m3.colorScheme.warning,
                      }}
                    >
                      {t('attendance.quickActions.allHalf')}
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
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleQuickAction('absent')}
                accessibilityRole="button"
                accessibilityLabel={t('attendance.a11y.setAllAbsent')}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: m3.shape.cornerMedium,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
                  overflow: 'hidden',
                }}
              >
                {({ pressed }) => (
                  <>
                    <UiSymbol name="xmark.circle.fill" size={16} color={m3.colorScheme.error} />
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                        marginLeft: spacing[2],
                        color: m3.colorScheme.error,
                      }}
                    >
                      {t('attendance.quickActions.allOff')}
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
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: actionBarBottom,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: spacing[3],
          backgroundColor: m3.surface.surfaceContainerLow,
          borderTopWidth: 1,
          borderTopColor: m3.colorScheme.outlineVariant,
        }}
      >
        <Pressable
          onPress={handleSaveAndNext}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={
            saving
              ? t('attendance.a11y.savingAttendance')
              : hasModifications
                ? selectedWorkerIndex < workers.length - 1
                  ? t('attendance.a11y.saveAndNextWorker')
                  : t('attendance.a11y.saveAndFinish')
                : selectedWorkerIndex < workers.length - 1
                  ? t('attendance.a11y.goToNextWorker')
                  : t('attendance.buttons.done')
          }
          style={{
            borderRadius: m3.shape.cornerLarge,
            paddingVertical: spacing[4],
            backgroundColor: m3.colorScheme.primary,
            overflow: 'hidden',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {({ pressed }) => (
            <>
              {saving ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ActivityIndicator size="small" color={m3.colorScheme.onPrimary} />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.onPrimary,
                      marginLeft: spacing[2],
                    }}
                  >
                    {t('attendance.buttons.saving')}
                  </Text>
                </View>
              ) : hasModifications ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <UiSymbol
                    name="checkmark.circle.fill"
                    size={20}
                    color={m3.colorScheme.onPrimary}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.onPrimary,
                      marginLeft: spacing[2],
                    }}
                  >
                    {selectedWorkerIndex < workers.length - 1
                      ? t('attendance.buttons.saveAndNext')
                      : t('attendance.buttons.saveAndFinish')}
                  </Text>
                </View>
              ) : (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.onPrimary,
                    }}
                  >
                    {selectedWorkerIndex < workers.length - 1
                      ? t('attendance.buttons.nextWorker')
                      : t('attendance.buttons.done')}
                  </Text>
                </View>
              )}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor:
                      pressed && !saving
                        ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                  },
                ]}
              />
            </>
          )}
        </Pressable>
      </View>

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

async function fetchLatestAttendanceDate(workerId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('worker_attendance')
    .select('date')
    .eq('worker_id', workerId)
    .order('date', { ascending: false })
    .limit(1);

  if (error) {
    return null;
  }

  return data?.[0]?.date ?? null;
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
