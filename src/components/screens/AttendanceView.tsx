import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFarms } from '@/hooks';
import { supabase } from '@/lib/supabase';
import type { Farm, Worker, WorkerAttendance, WorkerAttendanceInsert, WorkStatus } from '@/types';

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
      <View className="flex-1 items-center justify-center p-8" style={{ backgroundColor: UI.bg }}>
        <View
          className="w-24 h-24 rounded-3xl items-center justify-center mb-4"
          style={{ backgroundColor: UI.primarySoft }}
        >
          <Ionicons name="people-outline" size={48} color={UI.primary} />
        </View>
        <Text className="text-lg font-bold text-center" style={{ color: UI.text }}>
          No Active Workers
        </Text>
        <Text className="text-sm text-center mt-2" style={{ color: UI.muted }}>
          Add workers in the Workers tab to start tracking attendance.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: UI.bg }}>
      <LinearGradient
        colors={['rgba(47, 107, 79, 0.12)', 'transparent']}
        style={{ height: 200, position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Tab Selector - Gradient Style */}
        <View className="mx-4 mt-4">
          <View
            className="rounded-2xl p-1.5"
            style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
          >
            <View className="flex-row overflow-hidden rounded-xl">
              <TouchableOpacity
                onPress={() => setActiveTab('mark')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center py-3 transition-all ${
                  activeTab === 'mark' ? '' : 'bg-transparent'
                }`}
                style={activeTab === 'mark' ? { backgroundColor: UI.primary } : {}}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={activeTab === 'mark' ? '#FFFFFF' : UI.muted}
                />
                <Text
                  className={`text-sm font-semibold ml-2 ${
                    activeTab === 'mark' ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  Mark
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('calendar')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center py-3 transition-all ${
                  activeTab === 'calendar' ? '' : 'bg-transparent'
                }`}
                style={activeTab === 'calendar' ? { backgroundColor: UI.primary } : {}}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={activeTab === 'calendar' ? '#FFFFFF' : UI.muted}
                />
                <Text
                  className={`text-sm font-semibold ml-2 ${
                    activeTab === 'calendar' ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  Calendar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tab Content */}
        <View className="flex-1">
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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={UI.primary} />
      </View>
    );
  }

  if (!selectedWorker) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>No workers available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: UI.bg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Intro */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: UI.muted }}>
            Attendance
          </Text>
          <Text className="text-xl font-bold mt-1" style={{ color: UI.text }}>
            Mark daily status quickly
          </Text>
          <View className="flex-row items-center mt-2">
            <Ionicons name="information-circle-outline" size={16} color={UI.muted} />
            <Text className="text-xs ml-2" style={{ color: UI.muted }}>
              Tap a day to cycle Full • Half • Absent • Clear
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: UI.muted }}>
            Filters
          </Text>
          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity
              onPress={handleWorkerSelect}
              activeOpacity={0.7}
              className="flex-1 px-4 py-3 rounded-2xl border"
              style={{ backgroundColor: '#FFFFFF', borderColor: UI.border }}
            >
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={16} color={UI.primary} />
                <Text className="text-xs font-semibold ml-2" style={{ color: UI.muted }}>
                  Worker
                </Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Text className="text-sm font-semibold" style={{ color: UI.text }}>
                  {selectedWorker?.name || 'All Workers'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={UI.muted} className="ml-1" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFarmSheetVisible(true)}
              activeOpacity={0.7}
              className="flex-1 px-4 py-3 rounded-2xl border"
              style={{ backgroundColor: '#FFFFFF', borderColor: UI.border }}
            >
              <View className="flex-row items-center">
                <Ionicons name="leaf-outline" size={16} color={UI.primary} />
                <Text className="text-xs font-semibold ml-2" style={{ color: UI.muted }}>
                  Farms
                </Text>
              </View>
              <View className="flex-row items-center mt-1">
                <Text className="text-sm font-semibold" style={{ color: UI.text }}>
                  {selectedFarmIds.length > 0 ? `${selectedFarmIds.length} selected` : 'All Farms'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={UI.muted} className="ml-1" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Week Days Grid */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-xs font-bold uppercase" style={{ color: UI.muted }}>
                This Week
              </Text>
              <Text className="text-sm font-semibold mt-1" style={{ color: UI.text }}>
                {formatShortDate(dateRange[0])} - {formatShortDate(dateRange[dateRange.length - 1])}
              </Text>
            </View>
            <TouchableOpacity
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: UI.primarySoft }}
            >
              <Text className="text-xs font-bold" style={{ color: UI.primary }}>
                {hasModifications ? 'Unsaved Changes' : 'Up to Date'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {dateRange.map((date) => {
              const dateStr = formatDate(date);
              const key = getCellKey(selectedWorker?.id || 0, dateStr);
              const cell = cellData.get(key);
              const statusInfo = getStatusDisplay(cell?.status ?? null);
              const modified = cell?.isModified ?? false;
              const isTodayDate = isToday(date);
              const hasStatus = cell?.status !== null;

              return (
                <TouchableOpacity
                  key={dateStr}
                  onPress={() => handleDayCellClick(date)}
                  activeOpacity={0.7}
                  className="w-[31%] aspect-square items-center justify-center mb-3 rounded-2xl relative"
                  style={{
                    backgroundColor: hasStatus ? statusInfo.bgColor : 'rgba(249, 250, 251, 0.9)',
                    borderWidth: isTodayDate ? 1 : 0,
                    borderColor: isTodayDate ? UI.accent : 'transparent',
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold uppercase mb-1"
                    style={{ color: isTodayDate ? UI.accent : '#9CA3AF' }}
                  >
                    {getDayName(date)}
                  </Text>
                  <Text
                    className={`text-lg font-bold ${isTodayDate ? 'text-blue-600' : 'text-gray-900'}`}
                  >
                    {date.getDate()}
                  </Text>
                  {modified ? (
                    <View
                      className="absolute top-2 right-2 w-2 h-2 rounded-full"
                      style={{ backgroundColor: UI.primary }}
                    />
                  ) : null}
                  <View
                    className={`mt-1 px-2 py-0.5 rounded-full ${hasStatus ? '' : 'bg-transparent'}`}
                    style={hasStatus ? { backgroundColor: statusInfo.badgeColor } : {}}
                  >
                    <Text
                      className={`text-xs font-bold ${hasStatus ? 'text-white' : 'text-transparent'}`}
                    >
                      {statusInfo.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Actions */}
        <View
          className="rounded-3xl p-3 mb-4 flex-row gap-3"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <TouchableOpacity
            onPress={() => handleQuickAction('full_day')}
            activeOpacity={0.7}
            className="flex-1 py-3 rounded-2xl flex-row items-center justify-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text className="text-sm font-bold ml-2" style={{ color: '#166534' }}>
              All Full
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleQuickAction('half_day')}
            activeOpacity={0.7}
            className="flex-1 py-3 rounded-2xl flex-row items-center justify-center"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
          >
            <Ionicons name="time" size={18} color="#F59E0B" />
            <Text className="text-sm font-bold ml-2" style={{ color: '#B45309' }}>
              All Half
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleQuickAction('absent')}
            activeOpacity={0.7}
            className="flex-1 py-3 rounded-2xl flex-row items-center justify-center"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
          >
            <Ionicons name="close-circle" size={18} color="#EF4444" />
            <Text className="text-sm font-bold ml-2" style={{ color: '#B91C1C' }}>
              All Off
            </Text>
          </TouchableOpacity>
        </View>

        {/* Worker Selector */}
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={goToPrevWorker}
              activeOpacity={0.7}
              disabled={selectedWorkerIndex === 0}
              className="w-12 h-12 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  selectedWorkerIndex === 0 ? 'rgba(229, 231, 235, 0.5)' : UI.primarySoft,
              }}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={selectedWorkerIndex === 0 ? '#D1D5DB' : UI.primary}
              />
            </TouchableOpacity>

            <View className="flex-1 mx-4 items-center">
              <Text className="text-lg font-bold" style={{ color: UI.text }}>
                {selectedWorker?.name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="wallet-outline" size={14} color={UI.primary} />
                <Text className="text-sm font-semibold ml-1" style={{ color: UI.muted }}>
                  ₹{selectedWorker?.daily_rate}/day
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleWorkerSelect}
                activeOpacity={0.7}
                className="mt-2 px-3 py-1.5 rounded-full border"
                style={{ borderColor: 'rgba(47, 107, 79, 0.3)' }}
              >
                <Text className="text-xs font-bold" style={{ color: UI.primary }}>
                  Select Worker
                </Text>
              </TouchableOpacity>
              <Text className="text-[11px] font-semibold mt-2" style={{ color: '#9CA3AF' }}>
                {selectedWorkerIndex + 1} of {workers.length}
              </Text>
            </View>

            <TouchableOpacity
              onPress={goToNextWorker}
              activeOpacity={0.7}
              disabled={selectedWorkerIndex === workers.length - 1}
              className="w-12 h-12 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  selectedWorkerIndex === workers.length - 1
                    ? 'rgba(229, 231, 235, 0.5)'
                    : UI.primarySoft,
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={selectedWorkerIndex === workers.length - 1 ? '#D1D5DB' : UI.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSaveAndNext}
          activeOpacity={0.8}
          disabled={saving}
          className="rounded-3xl py-4 mb-6"
          style={{ backgroundColor: UI.primary, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-sm font-bold text-white ml-2">Saving...</Text>
            </View>
          ) : hasModifications ? (
            <View className="flex-row items-center justify-center">
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white ml-2">
                {selectedWorkerIndex < workers.length - 1 ? 'Save & Next' : 'Save & Finish'}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center justify-center">
              <Text className="text-sm font-bold text-white">
                {selectedWorkerIndex < workers.length - 1 ? 'Next Worker' : 'Done'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
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
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: UI.bg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Filter Bar */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: UI.muted }}>
            Worker
          </Text>
          <TouchableOpacity
            onPress={handleWorkerSelect}
            activeOpacity={0.7}
            className="flex-row items-center justify-between px-4 py-3 rounded-2xl border mt-3"
            style={{ backgroundColor: '#FFFFFF', borderColor: UI.border }}
          >
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={16} color={UI.primary} />
              <Text className="text-sm font-semibold ml-2" style={{ color: UI.text }}>
                {selectedWorker?.name || 'All Workers'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={14} color={UI.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month Navigation */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => {
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCalendarMonth(newMonth);
              }}
              activeOpacity={0.7}
              className="w-10 h-10 items-center justify-center rounded-full"
              style={{ backgroundColor: UI.primarySoft }}
            >
              <Ionicons name="chevron-back" size={22} color={UI.primary} />
            </TouchableOpacity>

            <Text className="text-lg font-bold" style={{ color: UI.text }}>
              {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>

            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date())}
                activeOpacity={0.7}
                className="px-3 py-1.5 rounded-full mr-2"
                style={{ backgroundColor: UI.primarySoft }}
              >
                <Text className="text-xs font-bold" style={{ color: UI.primary }}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const newMonth = new Date(calendarMonth);
                  newMonth.setMonth(newMonth.getMonth() + 1);
                  setCalendarMonth(newMonth);
                }}
                activeOpacity={0.7}
                className="w-10 h-10 items-center justify-center rounded-full"
                style={{ backgroundColor: UI.primarySoft }}
              >
                <Ionicons name="chevron-forward" size={22} color={UI.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Calendar */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color={UI.primary} />
            </View>
          ) : (
            <>
              <View className="flex-row pb-3 border-b" style={{ borderColor: UI.border }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <View key={`day-${index}`} className="flex-1">
                    <Text
                      className="text-[11px] font-bold uppercase text-center"
                      style={{ color: '#9CA3AF' }}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="flex-row flex-wrap pt-3">
                {calendarDays.map((day, index) => {
                  const status = getAttendanceForDate(day);
                  const isCurrentMonth = isSameMonth(day);
                  const isTodayDate = day.getDate() === new Date().getDate() && isCurrentMonth;

                  return (
                    <View key={index} className="w-[14.28%] aspect-square mb-2">
                      {day.getTime() ? (
                        <View
                          className="w-full h-full items-center justify-center rounded-2xl"
                          style={{
                            backgroundColor: isTodayDate ? UI.primarySoft : 'transparent',
                          }}
                        >
                          <Text
                            className="text-sm font-semibold"
                            style={{
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
                            <View className="mt-0.5">
                              {status === 'full_day' && (
                                <View
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: '#22C55E' }}
                                />
                              )}
                              {status === 'half_day' && (
                                <View
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: '#F59E0B' }}
                                />
                              )}
                              {status === 'absent' && (
                                <View
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: '#EF4444' }}
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
      <View className="mx-4 mb-6">
        <View
          className="rounded-3xl p-4"
          style={{ backgroundColor: UI.surfaceSoft, borderColor: UI.border, borderWidth: 1 }}
        >
          <View className="flex-row items-center justify-center gap-6">
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} />
              <Text className="text-sm font-semibold" style={{ color: UI.text }}>
                Full Day
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              <Text className="text-sm font-semibold" style={{ color: UI.text }}>
                Half Day
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <Text className="text-sm font-semibold" style={{ color: UI.text }}>
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
      <Pressable
        className="flex-1"
        onPress={onClose}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="rounded-t-3xl px-5 pt-5"
            onPress={() => undefined}
            style={{ backgroundColor: UI.surface, paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold" style={{ color: UI.text }}>
                  {title}
                </Text>
                <Text className="text-sm mt-1" style={{ color: UI.muted }}>
                  {subtitle}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: UI.primarySoft }}
              >
                <Ionicons name="close" size={18} color={UI.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={workers}
              keyExtractor={(item) => item.id?.toString() ?? item.name}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedWorkerId;
                return (
                  <TouchableOpacity
                    onPress={() => item.id && onSelect(item.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between px-4 py-3 rounded-2xl mb-2 border"
                    style={{
                      backgroundColor: isSelected ? UI.primarySoft : '#F9FAFB',
                      borderColor: isSelected ? 'rgba(47, 107, 79, 0.35)' : UI.border,
                    }}
                  >
                    <View>
                      <Text className="text-base font-semibold" style={{ color: UI.text }}>
                        {item.name}
                      </Text>
                      {item.daily_rate ? (
                        <Text className="text-xs mt-1" style={{ color: UI.muted }}>
                          ₹{item.daily_rate}/day
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? UI.primary : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="mt-3 py-3 rounded-2xl items-center border"
              style={{ borderColor: UI.border }}
            >
              <Text className="text-sm font-bold" style={{ color: UI.text }}>
                Cancel
              </Text>
            </TouchableOpacity>
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
      <Pressable
        className="flex-1"
        onPress={onClose}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="rounded-t-3xl px-5 pt-5"
            onPress={() => undefined}
            style={{ backgroundColor: UI.surface, paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold" style={{ color: UI.text }}>
                  Select Farms
                </Text>
                <Text className="text-sm mt-1" style={{ color: UI.muted }}>
                  Choose farms to apply attendance
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.7}
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: UI.primarySoft }}
              >
                <Ionicons name="close" size={18} color={UI.primary} />
              </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={() => item.id && toggleFarm(item.id)}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-between px-4 py-3 rounded-2xl mb-2 border"
                    style={{
                      backgroundColor: isSelected ? UI.primarySoft : '#F9FAFB',
                      borderColor: isSelected ? 'rgba(47, 107, 79, 0.35)' : UI.border,
                    }}
                  >
                    <View>
                      <Text className="text-base font-semibold" style={{ color: UI.text }}>
                        {item.name}
                      </Text>
                      <Text className="text-xs mt-1" style={{ color: UI.muted }}>
                        {item.region}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? UI.primary : '#D1D5DB'}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <View className="flex-row gap-3 mt-3">
              <TouchableOpacity
                onPress={() => {
                  setDraftIds(farms.map((farm) => farm.id!).filter(Boolean));
                }}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center border"
                style={{ borderColor: 'rgba(47, 107, 79, 0.25)' }}
              >
                <Text className="text-sm font-bold" style={{ color: UI.primary }}>
                  Select All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApply}
                activeOpacity={0.7}
                className="flex-1 py-3 rounded-2xl items-center"
                style={{ backgroundColor: UI.primary }}
              >
                <Text className="text-sm font-bold" style={{ color: '#FFFFFF' }}>
                  Apply
                </Text>
              </TouchableOpacity>
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
