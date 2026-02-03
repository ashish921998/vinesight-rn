import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { supabase } from '@/lib/supabase';
import type { Worker, WorkerAttendance, WorkStatus } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { WorkerSelectSheet } from './index';
import i18n from '@/i18n';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type AttendanceStatus = WorkStatus | null;

interface CalendarAttendanceTabProps {
  workers: Worker[];
}

export function CalendarAttendanceTab({ workers }: CalendarAttendanceTabProps) {
  const colors = useThemeColors();
  const ui = useMemo(
    () => ({
      bg: colors.surface[50],
      surface: colors.surface[100],
      surfaceSoft: colors.surface[100],
      border: colors.surface[200],
      primary: colors.primary[600],
      primarySoft: colorWithOpacity(colors.primary[600], 0.12),
      text: colors.surface[900],
      muted: colors.surface[600],
      accent: colors.primary[500],
    }),
    [colors],
  );
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    workers.length > 0 && workers[0].id !== undefined ? workers[0].id : null,
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
    } catch {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.failedToLoadAttendance'));
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
    <ScrollView style={{ flex: 1, backgroundColor: ui.bg }} showsVerticalScrollIndicator={false}>
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: ui.surfaceSoft,
            borderColor: ui.border,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              color: ui.muted,
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
              backgroundColor: colors.surface[100],
              borderColor: ui.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UiSymbol name="person" size={16} color={ui.primary} />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginLeft: spacing[2],
                  color: ui.text,
                }}
              >
                {selectedWorker?.name || 'All Workers'}
              </Text>
            </View>
            <UiSymbol name="chevron.down" size={14} color={ui.muted} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: ui.surfaceSoft,
            borderColor: ui.border,
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
                backgroundColor: ui.primarySoft,
              }}
            >
              <UiSymbol name="chevron.left" size={22} color={ui.primary} />
            </Pressable>

            <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: ui.text }}>
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
                  backgroundColor: ui.primarySoft,
                }}
              >
                <Text
                  style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: ui.primary }}
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
                  backgroundColor: ui.primarySoft,
                }}
              >
                <UiSymbol name="chevron.right" size={22} color={ui.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: ui.surfaceSoft,
            borderColor: ui.border,
            borderWidth: 1,
          }}
        >
          {loading ? (
            <View style={{ paddingVertical: spacing[12], alignItems: 'center' }}>
              <ActivityIndicator size="small" color={ui.primary} />
            </View>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  paddingBottom: spacing[3],
                  borderBottomWidth: 1,
                  borderColor: ui.border,
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
                        color: colors.gray[400],
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: spacing[3] }}>
                {(() => {
                  const today = new Date();
                  return calendarDays.map((day, index) => {
                    const status = getAttendanceForDate(day);
                    const isCurrentMonth = isSameMonth(day);
                    const isTodayDate =
                      day.getFullYear() === today.getFullYear() &&
                      day.getMonth() === today.getMonth() &&
                      day.getDate() === today.getDate();

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
                              backgroundColor: isTodayDate ? ui.primarySoft : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.sm,
                                fontWeight: fontWeight.semibold,
                                color: isTodayDate
                                  ? ui.primary
                                  : isCurrentMonth
                                    ? '#111827'
                                    : colors.surface[300],
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
                                      backgroundColor: colors.success,
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
                  });
                })()}
              </View>
            </>
          )}
        </View>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[6] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: ui.surfaceSoft,
            borderColor: ui.border,
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
                  backgroundColor: colors.success,
                }}
              />
              <Text
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: ui.text }}
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
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: ui.text }}
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
                style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: ui.text }}
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
