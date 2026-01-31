import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { supabase } from '@/lib/supabase';
import type { Farm, Worker, WorkerAttendance, WorkerAttendanceInsert, WorkStatus } from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { WorkerSelectSheet, FarmSelectSheet } from './index';

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

const UI = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceSoft: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  primary: '#2F6B4F',
  primarySoft: 'rgba(47, 107, 79, 0.12)',
  text: '#0F172A',
  muted: '#6B7280',
  accent: '#2563EB',
};

const getStatusDisplay = (status: AttendanceStatus) => {
  switch (status) {
    case 'full_day':
      return {
        label: 'F',
        bgColor: '#DCFCE7',
        badgeColor: '#22C55E',
        textColor: '#166534',
        fullLabel: 'Full Day',
      };
    case 'half_day':
      return {
        label: 'H',
        bgColor: '#FEF3C7',
        badgeColor: '#F59E0B',
        textColor: '#B45309',
        fullLabel: 'Half Day',
      };
    case 'absent':
      return {
        label: 'A',
        bgColor: '#FEE2E2',
        badgeColor: '#EF4444',
        textColor: '#B91C1C',
        fullLabel: 'Absent',
      };
    default:
      return {
        label: '-',
        bgColor: '#F9FAFB',
        badgeColor: '#E5E7EB',
        textColor: '#6B7280',
        fullLabel: 'Not Set',
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
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFarmIds, setSelectedFarmIds] = useState<number[]>([]);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);
  const [farmSheetVisible, setFarmSheetVisible] = useState(false);

  const prevWorkerIdRef = useRef<number | undefined>(undefined);

  const safeIndex = Math.min(selectedWorkerIndex, Math.max(0, workers.length - 1));
  const selectedWorker = workers[safeIndex];

  const dateRange = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const offset = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - offset);
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return date;
    });
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

    setLoading(true);
    try {
      const newCellData = new Map<string, CellData>();
      const startDate = formatDate(dateRange[0]);
      const endDate = formatDate(dateRange[dateRange.length - 1]);

      const workerId = selectedWorker?.id;
      if (workerId === undefined) return;

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
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedWorker, dateRange, farms]);

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
      Alert.alert('Error', 'Please select at least one farm');
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
      Alert.alert('Partial Error', `Saved with ${errors.length} error(s). Reloading...`);
      prevWorkerIdRef.current = undefined;
      setSaving(false);
      loadAttendance();
      return;
    }

    Alert.alert('Success', `Saved attendance for ${selectedWorker?.name}`);
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
      Alert.alert('Complete', 'All workers completed!');
    }
  };

  const goToPrevWorker = () => {
    if (selectedWorkerIndex > 0) {
      onWorkerIndexChange(selectedWorkerIndex - 1);
    }
  };

  const handleWorkerSelect = () => {
    if (workers.length === 0) return;
    setWorkerSheetVisible(true);
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
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  const formatShortDate = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${month} ${date.getDate()}`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={UI.primary} />
      </View>
    );
  }

  if (!selectedWorker) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>No workers available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: UI.bg }} showsVerticalScrollIndicator={false}>
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: UI.muted,
            }}
          >
            Attendance
          </Text>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              marginTop: spacing[1],
              color: UI.text,
            }}
          >
            Mark daily status quickly
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] }}>
            <UiSymbol name="info.circle" size={16} color={UI.muted} />
            <Text style={{ fontSize: fontSize.xs, marginLeft: spacing[2], color: UI.muted }}>
              Tap a day to cycle Full • Half • Absent • Clear
            </Text>
          </View>
        </View>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: UI.muted,
            }}
          >
            Filters
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
            <Pressable
              onPress={handleWorkerSelect}
              style={{
                flex: 1,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderRadius: borderRadius['2xl'],
                borderWidth: 1,
                backgroundColor: colors.white,
                borderColor: UI.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol name="person" size={16} color={UI.primary} />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: UI.muted,
                  }}
                >
                  Worker
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: UI.text }}
                >
                  {selectedWorker?.name || 'All Workers'}
                </Text>
                <UiSymbol name="chevron.down" size={14} color={UI.muted} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => setFarmSheetVisible(true)}
              style={{
                flex: 1,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderRadius: borderRadius['2xl'],
                borderWidth: 1,
                backgroundColor: colors.white,
                borderColor: UI.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UiSymbol name="leaf" size={16} color={UI.primary} />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: UI.muted,
                  }}
                >
                  Farms
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: UI.text }}
                >
                  {selectedFarmIds.length > 0 ? `${selectedFarmIds.length} selected` : 'All Farms'}
                </Text>
                <UiSymbol name="chevron.down" size={14} color={UI.muted} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing[4],
            }}
          >
            <View>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  color: UI.muted,
                }}
              >
                This Week
              </Text>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginTop: spacing[1],
                  color: UI.text,
                }}
              >
                {formatShortDate(dateRange[0])} - {formatShortDate(dateRange[dateRange.length - 1])}
              </Text>
            </View>
            <Pressable
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: 6,
                borderRadius: borderRadius.full,
                backgroundColor: UI.primarySoft,
              }}
            >
              <Text
                style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: UI.primary }}
              >
                {hasModifications ? 'Unsaved Changes' : 'Up to Date'}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {dateRange.map((date) => {
              const dateStr = formatDate(date);
              const key = getCellKey(selectedWorker?.id || 0, dateStr);
              const cell = cellData.get(key);
              const statusInfo = getStatusDisplay(cell?.status ?? null);
              const modified = cell?.isModified ?? false;
              const isTodayDate = isToday(date);
              const hasStatus = cell?.status !== null;

              return (
                <Pressable
                  key={dateStr}
                  onPress={() => handleDayCellClick(date)}
                  style={{
                    width: '31%',
                    aspectRatio: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing[3],
                    borderRadius: borderRadius['2xl'],
                    backgroundColor: hasStatus ? statusInfo.bgColor : 'rgba(249, 250, 251, 0.9)',
                    borderWidth: isTodayDate ? 1 : 0,
                    borderColor: isTodayDate ? UI.accent : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: fontWeight.semibold,
                      textTransform: 'uppercase',
                      marginBottom: spacing[1],
                      color: isTodayDate ? UI.accent : '#9CA3AF',
                    }}
                  >
                    {getDayName(date)}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      color: isTodayDate ? '#2563EB' : '#111827',
                    }}
                  >
                    {date.getDate()}
                  </Text>
                  {modified ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: spacing[2],
                        right: spacing[2],
                        width: 8,
                        height: 8,
                        borderRadius: borderRadius.full,
                        backgroundColor: UI.primary,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      marginTop: spacing[1],
                      paddingHorizontal: spacing[2],
                      paddingVertical: 2,
                      borderRadius: borderRadius.full,
                      backgroundColor: hasStatus ? statusInfo.badgeColor : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.bold,
                        color: hasStatus ? colors.white : 'transparent',
                      }}
                    >
                      {statusInfo.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[3],
            marginBottom: spacing[4],
            flexDirection: 'row',
            gap: spacing[3],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <Pressable
            onPress={() => handleQuickAction('full_day')}
            style={{
              flex: 1,
              paddingVertical: spacing[3],
              borderRadius: borderRadius['2xl'],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
            }}
          >
            <UiSymbol name="checkmark.circle.fill" size={18} color="#22C55E" />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
                marginLeft: spacing[2],
                color: '#166534',
              }}
            >
              All Full
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleQuickAction('half_day')}
            style={{
              flex: 1,
              paddingVertical: spacing[3],
              borderRadius: borderRadius['2xl'],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
            }}
          >
            <UiSymbol name="clock.fill" size={18} color="#F59E0B" />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
                marginLeft: spacing[2],
                color: '#B45309',
              }}
            >
              All Half
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleQuickAction('absent')}
            style={{
              flex: 1,
              paddingVertical: spacing[3],
              borderRadius: borderRadius['2xl'],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
            }}
          >
            <UiSymbol name="xmark.circle.fill" size={18} color="#EF4444" />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.bold,
                marginLeft: spacing[2],
                color: '#B91C1C',
              }}
            >
              All Off
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              onPress={goToPrevWorker}
              disabled={selectedWorkerIndex === 0}
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  selectedWorkerIndex === 0 ? 'rgba(229, 231, 235, 0.5)' : UI.primarySoft,
              }}
            >
              <UiSymbol
                name="chevron.left"
                size={22}
                color={selectedWorkerIndex === 0 ? '#D1D5DB' : UI.primary}
              />
            </Pressable>

            <View style={{ flex: 1, marginHorizontal: spacing[4], alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: UI.text }}>
                {selectedWorker?.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
                <UiSymbol name="wallet.pass" size={14} color={UI.primary} />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[1],
                    color: UI.muted,
                  }}
                >
                  ₹{selectedWorker?.daily_rate}/day
                </Text>
              </View>
              <Pressable
                onPress={handleWorkerSelect}
                style={{
                  marginTop: spacing[2],
                  paddingHorizontal: spacing[3],
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  borderWidth: 1,
                  borderColor: 'rgba(47, 107, 79, 0.3)',
                }}
              >
                <Text
                  style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: UI.primary }}
                >
                  Select Worker
                </Text>
              </Pressable>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  marginTop: spacing[2],
                  color: '#9CA3AF',
                }}
              >
                {selectedWorkerIndex + 1} of {workers.length}
              </Text>
            </View>

            <Pressable
              onPress={goToNextWorker}
              disabled={selectedWorkerIndex === workers.length - 1}
              style={{
                width: 48,
                height: 48,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  selectedWorkerIndex === workers.length - 1
                    ? 'rgba(229, 231, 235, 0.5)'
                    : UI.primarySoft,
              }}
            >
              <UiSymbol
                name="chevron.right"
                size={22}
                color={selectedWorkerIndex === workers.length - 1 ? '#D1D5DB' : UI.primary}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={handleSaveAndNext}
          disabled={saving}
          style={{
            borderRadius: borderRadius['3xl'],
            paddingVertical: spacing[4],
            marginBottom: spacing[6],
            backgroundColor: UI.primary,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.bold,
                  color: colors.white,
                  marginLeft: spacing[2],
                }}
              >
                Saving...
              </Text>
            </View>
          ) : hasModifications ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <UiSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.bold,
                  color: colors.white,
                  marginLeft: spacing[2],
                }}
              >
                {selectedWorkerIndex < workers.length - 1 ? 'Save & Next' : 'Save & Finish'}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.white }}
              >
                {selectedWorkerIndex < workers.length - 1 ? 'Next Worker' : 'Done'}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      <WorkerSelectSheet
        visible={workerSheetVisible}
        title="Select Worker"
        subtitle="Choose a worker to mark attendance"
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
    </ScrollView>
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
