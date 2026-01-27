import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Symbol } from '@/components/ui/Symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFarms } from '@/hooks';
import { supabase } from '@/lib/supabase';
import type { Farm, Worker, WorkerAttendance, WorkerAttendanceInsert, WorkStatus } from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface AttendanceViewProps {
  workers: Worker[];
  onSaveSuccess: () => void;
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

type AttendanceTab = 'mark' | 'calendar';

export function AttendanceView({ workers, onSaveSuccess }: AttendanceViewProps) {
  const { data: farms } = useFarms();
  const [activeTab, setActiveTab] = useState<AttendanceTab>('mark');

  const activeWorkers = useMemo(() => workers.filter((w) => w.is_active), [workers]);

  if (activeWorkers.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[8],
          backgroundColor: UI.bg,
        }}
      >
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: borderRadius['3xl'],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[4],
            backgroundColor: UI.primarySoft,
          }}
        >
          <Symbol name="person.2" size={48} color={UI.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            textAlign: 'center',
            color: UI.text,
          }}
        >
          No Active Workers
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            textAlign: 'center',
            marginTop: spacing[2],
            color: UI.muted,
          }}
        >
          Add workers in the Workers tab to start tracking attendance.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: UI.bg }}>
      <LinearGradient
        colors={['rgba(47, 107, 79, 0.12)', 'transparent']}
        style={{ height: 200, position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Tab Selector - Gradient Style */}
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: 6,
              backgroundColor: UI.surfaceSoft,
              borderColor: UI.border,
              borderWidth: 1,
            }}
          >
            <View
              style={{ flexDirection: 'row', overflow: 'hidden', borderRadius: borderRadius.xl }}
            >
              <Pressable
                onPress={() => setActiveTab('mark')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing[3],
                  backgroundColor: activeTab === 'mark' ? UI.primary : 'transparent',
                }}
              >
                <Symbol
                  name="pencil"
                  size={18}
                  color={activeTab === 'mark' ? '#FFFFFF' : UI.muted}
                />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: activeTab === 'mark' ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  Mark
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('calendar')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing[3],
                  backgroundColor: activeTab === 'calendar' ? UI.primary : 'transparent',
                }}
              >
                <Symbol
                  name="calendar"
                  size={18}
                  color={activeTab === 'calendar' ? '#FFFFFF' : UI.muted}
                />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                    color: activeTab === 'calendar' ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  Calendar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Tab Content */}
        <View style={{ flex: 1 }}>
          {activeTab === 'mark' && farms && (
            <MarkAttendanceTab
              workers={activeWorkers}
              farms={farms}
              onSaveSuccess={onSaveSuccess}
            />
          )}
          {activeTab === 'calendar' && <CalendarAttendanceTab workers={activeWorkers} />}
        </View>
      </ScrollView>
    </View>
  );
}

function MarkAttendanceTab({
  workers,
  farms,
  onSaveSuccess,
}: {
  workers: Worker[];
  farms: Farm[];
  onSaveSuccess: () => void;
}) {
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState(0);
  const [cellData, setCellData] = useState<Map<string, CellData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFarmIds, setSelectedFarmIds] = useState<number[]>([]);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);
  const [farmSheetVisible, setFarmSheetVisible] = useState(false);

  const prevWorkerIdRef = useRef<number | undefined>(undefined);

  const safeIndex = Math.min(selectedWorkerIndex, Math.max(0, workers.length - 1));
  const selectedWorker = workers[safeIndex];

  const todayString = new Date().toDateString();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayString]);

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

      for (const date of dateRange) {
        const dateStr = formatDate(date);
        const key = getCellKey(selectedWorker.id!, dateStr);
        newCellData.set(key, {
          workerId: selectedWorker.id!,
          date: dateStr,
          status: null,
          workType: null,
          farmIds: [],
          isModified: false,
        });
      }

      const records = await fetchAttendanceForWorker(selectedWorker.id!, startDate, endDate);

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

      const workerChanged = prevWorkerIdRef.current !== selectedWorker.id!;
      if (workerChanged) {
        const recordWithFarms = records.find((r) => r.farm_ids && r.farm_ids.length > 0);
        if (recordWithFarms) {
          setSelectedFarmIds(recordWithFarms.farm_ids || []);
        } else if (farms.length > 0) {
          setSelectedFarmIds([farms[0].id!]);
        }
        prevWorkerIdRef.current = selectedWorker.id!;
      }

      setCellData(newCellData);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading attendance:', error);
      }
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
    const dateStr = formatDate(date);
    const key = getCellKey(selectedWorker.id!, dateStr);

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

    setCellData((prev) => {
      const newMap = new Map(prev);
      for (const date of dateRange) {
        const dateStr = formatDate(date);
        const key = getCellKey(selectedWorker.id!, dateStr);
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
      if (__DEV__) {
        console.error('Attendance save partial failures:', errors);
      }
      Alert.alert('Partial Error', `Saved with ${errors.length} error(s). Reloading...`);
      prevWorkerIdRef.current = undefined;
      setSaving(false);
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
      setSelectedWorkerIndex(selectedWorkerIndex + 1);
    } else {
      Alert.alert('Complete', 'All workers completed!');
    }
  };

  const goToPrevWorker = () => {
    if (selectedWorkerIndex > 0) {
      setSelectedWorkerIndex(selectedWorkerIndex - 1);
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
      {/* Intro */}
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
            <Symbol name="info.circle" size={16} color={UI.muted} />
            <Text style={{ fontSize: fontSize.xs, marginLeft: spacing[2], color: UI.muted }}>
              Tap a day to cycle Full • Half • Absent • Clear
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Bar */}
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
                <Symbol name="person" size={16} color={UI.primary} />
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
                <Symbol name="chevron.down" size={14} color={UI.muted} />
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
                <Symbol name="leaf" size={16} color={UI.primary} />
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
                <Symbol name="chevron.down" size={14} color={UI.muted} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Week Days Grid */}
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

        {/* Quick Actions */}
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
            <Symbol name="checkmark.circle.fill" size={18} color="#22C55E" />
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
            <Symbol name="clock.fill" size={18} color="#F59E0B" />
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
            <Symbol name="xmark.circle.fill" size={18} color="#EF4444" />
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

        {/* Worker Selector */}
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
              <Symbol
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
                <Symbol name="wallet.pass" size={14} color={UI.primary} />
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
              <Symbol
                name="chevron.right"
                size={22}
                color={selectedWorkerIndex === workers.length - 1 ? '#D1D5DB' : UI.primary}
              />
            </Pressable>
          </View>
        </View>

        {/* Save Button */}
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
              <Symbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
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
          if (index >= 0) setSelectedWorkerIndex(index);
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

function CalendarAttendanceTab({ workers }: { workers: Worker[] }) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    workers.length > 0 ? workers[0].id! : null,
  );
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<WorkerAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  const handleWorkerSelect = () => {
    if (workers.length === 0) return;
    setWorkerSheetVisible(true);
  };

  const loadCalendarAttendance = React.useCallback(async () => {
    if (!selectedWorkerId) return;

    setLoading(true);
    try {
      const monthStart = new Date(calendarMonth);
      monthStart.setDate(1);
      const monthEnd = new Date(calendarMonth);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);

      const startDate = monthStart.toISOString().split('T')[0];
      const endDate = monthEnd.toISOString().split('T')[0];

      const records = await fetchAttendanceForWorker(selectedWorkerId, startDate, endDate);
      setAttendanceData(records);
    } catch (error) {
      if (__DEV__) {
        console.error('Error loading calendar attendance:', error);
      }
      Alert.alert('Error', 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [selectedWorkerId, calendarMonth]);

  React.useEffect(() => {
    loadCalendarAttendance();
  }, [loadCalendarAttendance]);

  const calendarDays = useMemo(() => {
    const monthStart = new Date(calendarMonth);
    monthStart.setDate(1);
    const monthEnd = new Date(calendarMonth);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0);

    const firstDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    const days: Date[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(new Date(0));
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(calendarMonth);
      date.setDate(i);
      days.push(date);
    }

    return days;
  }, [calendarMonth]);

  const getAttendanceForDate = (date: Date): AttendanceStatus => {
    if (!date.getTime()) return null;
    const dateStr = date.toISOString().split('T')[0];
    const record = attendanceData.find((r) => r.date === dateStr);
    return record ? (record.work_status as AttendanceStatus) : null;
  };

  const isSameMonth = (date: Date): boolean => {
    return (
      date.getMonth() === calendarMonth.getMonth() &&
      date.getFullYear() === calendarMonth.getFullYear()
    );
  };

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: UI.bg }} showsVerticalScrollIndicator={false}>
      {/* Filter Bar */}
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
            Worker
          </Text>
          <Pressable
            onPress={handleWorkerSelect}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              borderRadius: borderRadius['2xl'],
              borderWidth: 1,
              marginTop: spacing[3],
              backgroundColor: colors.white,
              borderColor: UI.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Symbol name="person" size={16} color={UI.primary} />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: UI.text,
                }}
              >
                {selectedWorker?.name || 'All Workers'}
              </Text>
            </View>
            <Symbol name="chevron.down" size={14} color={UI.muted} />
          </Pressable>
        </View>
      </View>

      {/* Month Navigation */}
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
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              onPress={() => {
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCalendarMonth(newMonth);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: UI.primarySoft,
              }}
            >
              <Symbol name="chevron.left" size={22} color={UI.primary} />
            </Pressable>

            <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: UI.text }}>
              {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => setCalendarMonth(new Date())}
                style={{
                  paddingHorizontal: spacing[3],
                  paddingVertical: 6,
                  borderRadius: borderRadius.full,
                  marginRight: spacing[2],
                  backgroundColor: UI.primarySoft,
                }}
              >
                <Text
                  style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: UI.primary }}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const newMonth = new Date(calendarMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setCalendarMonth(newMonth);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: UI.primarySoft,
                }}
              >
                <Symbol name="chevron.right" size={22} color={UI.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Calendar */}
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
          {loading ? (
            <View style={{ paddingVertical: spacing[12], alignItems: 'center' }}>
              <ActivityIndicator size="small" color={UI.primary} />
            </View>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  paddingBottom: spacing[3],
                  borderBottomWidth: 1,
                  borderColor: UI.border,
                }}
              >
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <View key={`day-${index}`} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: fontWeight.bold,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        color: '#9CA3AF',
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: spacing[3] }}>
                {calendarDays.map((day, index) => {
                  const status = getAttendanceForDate(day);
                  const isCurrentMonth = isSameMonth(day);
                  const isTodayDate = day.getDate() === new Date().getDate() && isCurrentMonth;

                  return (
                    <View
                      key={index}
                      style={{ width: '14.28%', aspectRatio: 1, marginBottom: spacing[2] }}
                    >
                      {day.getTime() ? (
                        <View
                          style={{
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: borderRadius['2xl'],
                            backgroundColor: isTodayDate ? UI.primarySoft : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: isTodayDate
                                ? UI.primary
                                : isCurrentMonth
                                  ? '#111827'
                                  : '#D1D5DB',
                            }}
                          >
                            {day.getDate()}
                          </Text>
                          {status && isCurrentMonth && (
                            <View style={{ marginTop: 2 }}>
                              {status === 'full_day' && (
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: borderRadius.full,
                                    backgroundColor: '#22C55E',
                                  }}
                                />
                              )}
                              {status === 'half_day' && (
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: borderRadius.full,
                                    backgroundColor: '#F59E0B',
                                  }}
                                />
                              )}
                              {status === 'absent' && (
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: borderRadius.full,
                                    backgroundColor: '#EF4444',
                                  }}
                                />
                              )}
                            </View>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[6] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: UI.surfaceSoft,
            borderColor: UI.border,
            borderWidth: 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[6],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: borderRadius.full,
                  backgroundColor: '#22C55E',
                }}
              />
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: UI.text }}
              >
                Full Day
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: borderRadius.full,
                  backgroundColor: '#F59E0B',
                }}
              />
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: UI.text }}
              >
                Half Day
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: borderRadius.full,
                  backgroundColor: '#EF4444',
                }}
              />
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: UI.text }}
              >
                Absent
              </Text>
            </View>
          </View>
        </View>
      </View>
      <WorkerSelectSheet
        visible={workerSheetVisible}
        title="Select Worker"
        subtitle="Choose a worker to view attendance"
        workers={workers}
        selectedWorkerId={selectedWorkerId}
        onSelect={(workerId) => {
          setSelectedWorkerId(workerId);
          setWorkerSheetVisible(false);
        }}
        onClose={() => setWorkerSheetVisible(false)}
      />
    </ScrollView>
  );
}

function WorkerSelectSheet({
  visible,
  title,
  subtitle,
  workers,
  selectedWorkerId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  workers: Worker[];
  selectedWorkerId: number | null;
  onSelect: (workerId: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: UI.surface,
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[5],
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text
                  style={{
                    color: UI.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  {title}
                </Text>
                <Text style={{ color: UI.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  {subtitle}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: UI.primarySoft,
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="xmark" size={18} color={UI.primary} />
              </Pressable>
            </View>

            <FlatList
              data={workers}
              keyExtractor={(item) => item.id?.toString() ?? item.name}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedWorkerId;
                return (
                  <Pressable
                    onPress={() => item.id && onSelect(item.id)}
                    style={{
                      backgroundColor: isSelected ? UI.primarySoft : '#F9FAFB',
                      borderColor: isSelected ? 'rgba(47, 107, 79, 0.35)' : UI.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius['2xl'],
                      marginBottom: spacing[2],
                      borderWidth: 1,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: UI.text,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {item.name}
                      </Text>
                      {item.daily_rate ? (
                        <Text
                          style={{
                            color: UI.muted,
                            fontSize: fontSize.xs,
                            marginTop: spacing[1],
                          }}
                        >
                          ₹{item.daily_rate}/day
                        </Text>
                      ) : null}
                    </View>
                    <Symbol
                      name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                      size={20}
                      color={isSelected ? UI.primary : '#D1D5DB'}
                    />
                  </Pressable>
                );
              }}
            />

            <Pressable
              onPress={onClose}
              style={{
                marginTop: spacing[3],
                paddingVertical: spacing[3],
                borderRadius: borderRadius['2xl'],
                alignItems: 'center',
                borderWidth: 1,
                borderColor: UI.border,
              }}
            >
              <Text style={{ color: UI.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function FarmSelectSheet({
  visible,
  farms,
  selectedFarmIds,
  onApply,
  onClose,
}: {
  visible: boolean;
  farms: Farm[];
  selectedFarmIds: number[];
  onApply: (farmIds: number[]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draftIds, setDraftIds] = useState<number[]>(selectedFarmIds);
  const prevVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftIds(selectedFarmIds);
    }
    prevVisibleRef.current = visible;
  }, [visible, selectedFarmIds]);

  const toggleFarm = (farmId: number) => {
    setDraftIds((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId],
    );
  };

  const handleApply = () => {
    const nextIds = draftIds.length > 0 ? draftIds : farms.map((farm) => farm.id!).filter(Boolean);
    onApply(nextIds);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => undefined}
            style={{
              backgroundColor: UI.surface,
              borderTopLeftRadius: borderRadius['3xl'],
              borderTopRightRadius: borderRadius['3xl'],
              paddingHorizontal: spacing[5],
              paddingTop: spacing[5],
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}
            >
              <View style={{ flex: 1, paddingRight: spacing[3] }}>
                <Text
                  style={{
                    color: UI.text,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Select Farms
                </Text>
                <Text style={{ color: UI.muted, fontSize: fontSize.sm, marginTop: spacing[1] }}>
                  Choose farms to apply attendance
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: UI.primarySoft,
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="xmark" size={18} color={UI.primary} />
              </Pressable>
            </View>

            <FlatList
              data={farms}
              keyExtractor={(item) => item.id?.toString() ?? item.name}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const farmId = item.id ?? 0;
                const isSelected = draftIds.includes(farmId);
                return (
                  <Pressable
                    onPress={() => item.id && toggleFarm(item.id)}
                    style={{
                      backgroundColor: isSelected ? UI.primarySoft : '#F9FAFB',
                      borderColor: isSelected ? 'rgba(47, 107, 79, 0.35)' : UI.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius['2xl'],
                      marginBottom: spacing[2],
                      borderWidth: 1,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: UI.text,
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          color: UI.muted,
                          fontSize: fontSize.xs,
                          marginTop: spacing[1],
                        }}
                      >
                        {item.region}
                      </Text>
                    </View>
                    <Symbol
                      name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                      size={20}
                      color={isSelected ? UI.primary : '#D1D5DB'}
                    />
                  </Pressable>
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
              <Pressable
                onPress={() => {
                  setDraftIds(farms.map((farm) => farm.id!).filter(Boolean));
                }}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius['2xl'],
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(47, 107, 79, 0.25)',
                }}
              >
                <Text
                  style={{ color: UI.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}
                >
                  Select All
                </Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius['2xl'],
                  alignItems: 'center',
                  backgroundColor: UI.primary,
                }}
              >
                <Text
                  style={{ color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: fontWeight.bold }}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
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
