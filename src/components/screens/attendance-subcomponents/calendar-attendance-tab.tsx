import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { getDataAccess } from '@/data-access';
import type { Worker, WorkerAttendance, WorkStatus } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { WorkerSelectSheet } from '@/components/modals';
import i18n from '@/i18n';

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type AttendanceStatus = WorkStatus | null;

interface CalendarAttendanceTabProps {
  workers: Worker[];
}

export function CalendarAttendanceTab({ workers }: CalendarAttendanceTabProps) {
  const m3 = useM3();
  const UI = useMemo(
    () => ({
      bg: m3.colorScheme.background,
      surface: m3.surface.s100,
      surfaceSoft: colorWithOpacity(m3.surface.s100, 0.9),
      border: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
      primary: m3.colorScheme.primary,
      primarySoft: colorWithOpacity(m3.colorScheme.primary, 0.12),
      text: m3.colorScheme.onSurface,
      muted: m3.colorScheme.onSurfaceVariant,
      accent: m3.colorScheme.secondary,
    }),
    [m3],
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

      const startDate = formatDateToYYYYMMDD(monthStart);
      const endDate = formatDateToYYYYMMDD(monthEnd);

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
    const dateStr = formatDateToYYYYMMDD(date);
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
      style={{ flex: 1, backgroundColor: UI.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing[6] }}
    >
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[2] }}>
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
              backgroundColor: m3.surface.surfaceContainerLow,
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
                const newMonth = new Date(calendarMonth);
                newMonth.setMonth(newMonth.getMonth() - 1);
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
              <Spinner size="small" color={UI.primary} />
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
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                  <View key={day} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
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
                  return calendarDays.map((day) => {
                    const status = getAttendanceForDate(day);
                    const isCurrentMonth = isSameMonth(day);
                    const isTodayDate =
                      day.getFullYear() === today.getFullYear() &&
                      day.getMonth() === today.getMonth() &&
                      day.getDate() === today.getDate();

                    return (
                      <View
                        key={day.getTime()}
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
                                      backgroundColor: m3.colorScheme.success,
                                    }}
                                  />
                                )}
                                {status === 'half_day' && (
                                  <View
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: borderRadius.full,
                                      backgroundColor: m3.colorScheme.warning,
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
                      backgroundColor: m3.colorScheme.success,
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
                      backgroundColor: m3.colorScheme.warning,
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
  const { data, error } = await getDataAccess()
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
