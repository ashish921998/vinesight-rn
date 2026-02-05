import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { supabase } from '@/lib/supabase';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { Worker, WorkerAttendance, WorkStatus, CapabilityLimit } from '@/types';
import { WorkerSelectSheet } from './index';
import i18n from '@/i18n';
import { limitToNumber } from '@/utils/capabilities';
import { FeatureLockCard } from '@/components/subscription/feature-lock-card';
import { useRouter } from 'expo-router';

type AttendanceStatus = WorkStatus | null;

interface CalendarAttendanceTabProps {
  workers: Worker[];
  historyWeeks: CapabilityLimit;
}

export function CalendarAttendanceTab({ workers, historyWeeks }: CalendarAttendanceTabProps) {
  const colors = useThemeColors();
  const m3 = useM3();
  const UI = useMemo(
    () => ({
      bg: m3.colorScheme.background,
      surface: colors.surface[100],
      surfaceSoft: colorWithOpacity(colors.surface[100], 0.9),
      border: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: m3.colorScheme.onSurface,
      muted: m3.colorScheme.onSurfaceVariant,
      accent: m3.colorScheme.secondary,
    }),
    [colors, m3],
  );
  const router = useRouter();
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    workers.length > 0 && workers[0].id !== undefined ? workers[0].id : null,
  );
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<WorkerAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [workerSheetVisible, setWorkerSheetVisible] = useState(false);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
  const maxHistoryWeeks = limitToNumber(historyWeeks);
  const earliestAllowed = maxHistoryWeeks
    ? new Date(Date.now() - maxHistoryWeeks * 7 * 24 * 60 * 60 * 1000)
    : null;

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

      if (earliestAllowed && monthEnd < earliestAllowed) {
        setAttendanceData([]);
        return;
      }

      const adjustedStart =
        earliestAllowed && monthStart < earliestAllowed ? earliestAllowed : monthStart;

      const startDate = adjustedStart.toISOString().split('T')[0];
      const endDate = monthEnd.toISOString().split('T')[0];

      const records = await fetchAttendanceForWorker(selectedWorkerId, startDate, endDate);
      setAttendanceData(records);
    } catch {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.failedToLoadAttendance'));
    } finally {
      setLoading(false);
    }
  }, [selectedWorkerId, calendarMonth, earliestAllowed]);

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

  const canNavigatePrev = (() => {
    if (!earliestAllowed) return true;
    const prevMonth = new Date(calendarMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthEnd = new Date(prevMonth);
    prevMonthEnd.setMonth(prevMonthEnd.getMonth() + 1);
    prevMonthEnd.setDate(0);
    return prevMonthEnd >= earliestAllowed;
  })();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: UI.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing[6] }}
    >
      {maxHistoryWeeks !== null && (
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}>
          <FeatureLockCard
            title={i18n.t('subscription.locks.attendance.title')}
            description={i18n.t('subscription.locks.attendance.description', {
              weeks: maxHistoryWeeks,
            })}
            ctaLabel={i18n.t('subscription.locks.cta')}
            featureKey="attendance"
            onUpgrade={() => router.push('/paywall?source=attendance')}
          />
        </View>
      )}
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <View
          style={{
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            backgroundColor: UI.surface,
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
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
              borderRadius: borderRadius['2xl'],
              borderWidth: 1,
              marginTop: spacing[2],
              backgroundColor: colors.white,
              borderColor: UI.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <UiSymbol name="person" size={16} color={UI.primary} />
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
            <UiSymbol name="chevron.down" size={14} color={UI.muted} />
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: UI.border,
              marginVertical: spacing[3],
            }}
          />

          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              onPress={() => {
                if (!canNavigatePrev) return;
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
                setCalendarMonth(newMonth);
              }}
              disabled={!canNavigatePrev}
              style={{
                width: 36,
                height: 36,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: UI.primarySoft,
                opacity: canNavigatePrev ? 1 : 0.4,
              }}
            >
              <UiSymbol name="chevron.left" size={20} color={UI.primary} />
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
                  width: 36,
                  height: 36,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: UI.primarySoft,
                }}
              >
                <UiSymbol name="chevron.right" size={20} color={UI.primary} />
              </Pressable>
            </View>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: UI.border,
              marginVertical: spacing[3],
            }}
          />

          {loading ? (
            <View style={{ paddingVertical: spacing[8], alignItems: 'center' }}>
              <ActivityIndicator size="small" color={UI.primary} />
            </View>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  paddingBottom: spacing[2],
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
                        color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: spacing[2] }}>
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
                                    ? m3.colorScheme.onSurface
                                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.35),
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
                                      backgroundColor: colors.warning,
                                    }}
                                  />
                                )}
                                {status === 'absent' && (
                                  <View
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: borderRadius.full,
                                      backgroundColor: m3.colorScheme.error,
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

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing[6],
                  marginTop: spacing[3],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: borderRadius.full,
                      backgroundColor: colors.success,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: UI.text,
                    }}
                  >
                    Full Day
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: borderRadius.full,
                      backgroundColor: colors.warning,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: UI.text,
                    }}
                  >
                    Half Day
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: borderRadius.full,
                      backgroundColor: m3.colorScheme.error,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: UI.text,
                    }}
                  >
                    Absent
                  </Text>
                </View>
              </View>
            </>
          )}
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
