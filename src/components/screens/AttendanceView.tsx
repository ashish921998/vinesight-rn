import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
        className="flex-1 items-center justify-center p-8"
        style={{ backgroundColor: '#f2f2f7' }}
      >
        <View
          className="w-24 h-24 rounded-3xl items-center justify-center mb-4"
          style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
        >
          <Ionicons name="people-outline" size={48} color="#408059" />
        </View>
        <Text className="text-lg font-bold text-center" style={{ color: '#000000' }}>
          No Active Workers
        </Text>
        <Text className="text-sm text-center mt-2" style={{ color: '#8e8e93' }}>
          Add workers in the Workers tab to start tracking attendance.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
      <LinearGradient
        colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
        style={{ height: 200, position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Tab Selector - Gradient Style */}
        <View className="mx-4 mt-4">
          <View
            className="rounded-2xl p-1.5"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          >
            <View className="flex-row overflow-hidden rounded-xl">
              <TouchableOpacity
                onPress={() => setActiveTab('mark')}
                activeOpacity={0.7}
                className={`flex-1 flex-row items-center justify-center py-3 transition-all ${
                  activeTab === 'mark' ? '' : 'bg-transparent'
                }`}
                style={activeTab === 'mark' ? { backgroundColor: '#408059' } : {}}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={activeTab === 'mark' ? '#FFFFFF' : '#8e8e93'}
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
                style={activeTab === 'calendar' ? { backgroundColor: '#408059' } : {}}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={activeTab === 'calendar' ? '#FFFFFF' : '#8e8e93'}
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
    return date.toISOString().split('T')[0];
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
          existingRecordId: record.id!,
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

    goToNextWorker();
    setSaving(false);
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#408059" />
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
      style={{ backgroundColor: '#f2f2f7' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Filter Bar */}
      <View className="mx-4 mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-2.5 rounded-2xl"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            >
              <Ionicons name="person-outline" size={16} color="#408059" />
              <Text className="text-sm font-semibold ml-2" style={{ color: '#000000' }}>
                {selectedWorker?.name || 'All Workers'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#8e8e93" className="ml-1" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-2.5 rounded-2xl"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
            >
              <Ionicons name="leaf-outline" size={16} color="#408059" />
              <Text className="text-sm font-semibold ml-2" style={{ color: '#000000' }}>
                {selectedFarmIds.length > 0
                  ? `${selectedFarmIds.length} farm${selectedFarmIds.length > 1 ? 's' : ''}`
                  : 'All Farms'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#8e8e93" className="ml-1" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Week Days Grid */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xs font-bold uppercase" style={{ color: '#8e8e93' }}>
              {formatDate(dateRange[0])}
            </Text>
            <TouchableOpacity
              className="px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
            >
              <Text className="text-xs font-bold" style={{ color: '#408059' }}>
                This Week
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap">
            {dateRange.map((date) => {
              const dateStr = formatDate(date);
              const key = getCellKey(selectedWorker?.id || 0, dateStr);
              const cell = cellData.get(key);
              const statusInfo = getStatusDisplay(cell?.status ?? null);
              const modified = cell?.isModified ?? false;
              const isTodayDate = isToday(date);

              return (
                <TouchableOpacity
                  key={dateStr}
                  onPress={() => handleDayCellClick(date)}
                  activeOpacity={0.7}
                  className={`w-[30%] aspect-square items-center justify-center mb-3 rounded-2xl ${isTodayDate ? '' : ''}`}
                  style={{
                    backgroundColor: isTodayDate
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(249, 250, 251, 0.8)',
                    ...(modified ? { backgroundColor: statusInfo.bgColor } : {}),
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold uppercase mb-1"
                    style={{ color: isTodayDate ? '#2563EB' : '#9CA3AF' }}
                  >
                    {getDayName(date)}
                  </Text>
                  <Text
                    className={`text-lg font-bold ${isTodayDate ? 'text-blue-600' : 'text-gray-900'}`}
                  >
                    {date.getDate()}
                  </Text>
                  <View
                    className={`mt-1 px-2 py-0.5 rounded-full ${modified ? '' : 'bg-transparent'}`}
                    style={modified ? { backgroundColor: statusInfo.badgeColor } : {}}
                  >
                    <Text
                      className={`text-xs font-bold ${modified ? 'text-white' : 'text-transparent'}`}
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
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            onPress={() => handleQuickAction('full_day')}
            activeOpacity={0.7}
            className="flex-1 py-3 rounded-2xl flex-row items-center justify-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
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
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
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
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
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
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={goToPrevWorker}
              activeOpacity={0.7}
              disabled={selectedWorkerIndex === 0}
              className="w-12 h-12 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  selectedWorkerIndex === 0 ? 'rgba(229, 231, 235, 0.5)' : 'rgba(64, 128, 89, 0.1)',
              }}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={selectedWorkerIndex === 0 ? '#D1D5DB' : '#408059'}
              />
            </TouchableOpacity>

            <View className="flex-1 mx-4 items-center">
              <Text className="text-lg font-bold" style={{ color: '#000000' }}>
                {selectedWorker?.name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="wallet-outline" size={14} color="#408059" />
                <Text className="text-sm font-semibold ml-1" style={{ color: '#8e8e93' }}>
                  ₹{selectedWorker?.daily_rate}/day
                </Text>
              </View>
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
                    : 'rgba(64, 128, 89, 0.1)',
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={selectedWorkerIndex === workers.length - 1 ? '#D1D5DB' : '#408059'}
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
          style={{ backgroundColor: '#408059', opacity: saving ? 0.6 : 1 }}
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

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  const handleWorkerSelect = () => {
    if (workers.length === 0) return;

    const buttons = workers.map((worker) => ({
      text: worker.name,
      onPress: () => setSelectedWorkerId(worker.id!),
      style: 'default' as const,
    }));

    Alert.alert('Select Worker', 'Choose a worker to view attendance', [
      ...buttons,
      { text: 'Cancel', style: 'cancel' as const },
    ]);
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
      style={{ backgroundColor: '#f2f2f7' }}
      showsVerticalScrollIndicator={false}
    >
      {/* Filter Bar */}
      <View className="mx-4 mt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={handleWorkerSelect}
            activeOpacity={0.7}
            className="flex-row items-center px-4 py-2.5 rounded-2xl"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          >
            <Ionicons name="person-outline" size={16} color="#408059" />
            <Text className="text-sm font-semibold ml-2" style={{ color: '#000000' }}>
              {selectedWorker?.name || 'All Workers'}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#8e8e93" className="ml-1" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Month Navigation */}
      <View className="mx-4 mt-4">
        <View className="rounded-3xl p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => {
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCalendarMonth(newMonth);
              }}
              activeOpacity={0.7}
              className="w-10 h-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
            >
              <Ionicons name="chevron-back" size={22} color="#408059" />
            </TouchableOpacity>

            <Text className="text-lg font-bold" style={{ color: '#000000' }}>
              {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>

            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date())}
                activeOpacity={0.7}
                className="px-3 py-1.5 rounded-full mr-2"
                style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
              >
                <Text className="text-xs font-bold" style={{ color: '#408059' }}>
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
                style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
              >
                <Ionicons name="chevron-forward" size={22} color="#408059" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Calendar */}
      <View className="mx-4 mt-4">
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
        >
          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#408059" />
            </View>
          ) : (
            <>
              <View
                className="flex-row pb-3 border-b"
                style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
              >
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
                            backgroundColor: isTodayDate ? 'rgba(64, 128, 89, 0.1)' : 'transparent',
                          }}
                        >
                          <Text
                            className={`text-sm font-semibold ${isTodayDate ? 'text-[#408059]' : isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}`}
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
        <View className="rounded-3xl p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
          <View className="flex-row items-center justify-center gap-6">
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} />
              <Text className="text-sm font-semibold" style={{ color: '#000000' }}>
                Full Day
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              <Text className="text-sm font-semibold" style={{ color: '#000000' }}>
                Half Day
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <Text className="text-sm font-semibold" style={{ color: '#000000' }}>
                Absent
              </Text>
            </View>
          </View>
        </View>
      </View>
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
