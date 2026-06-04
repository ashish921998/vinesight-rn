import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { useWorker, useWorkerAttendance, useFarms, isAndroid } from '@/hooks';
import { useModalStore } from '@/stores';
import { WorkerSettlementModal } from '@/components/modals/worker-settlement-modal';
import { borderRadius, fontSize, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';
import { calculateWorkerEarnings } from '@/types';
import type { WorkStatus } from '@/types';
import { getDefaultDateRange, isDateInRange } from '@/utils/worker-analytics';

const ACCENT_COLORS = ['#355847', '#A56B4F', '#D0A14A', '#4E7384', '#7A5E8E'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayLabel(dateStr: string): { short: string; num: number } {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { short: days[d.getDay()], num: d.getDate() };
  } catch {
    return { short: '', num: 0 };
  }
}

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { setAddWorker } = useModalStore();

  const rawId = Array.isArray(id) ? id[0] : id;
  const parsedWorkerId = rawId ? Number(rawId) : undefined;
  const workerId = Number.isFinite(parsedWorkerId) ? parsedWorkerId : undefined;
  const { data: worker, isLoading: workerLoading, refetch: refetchWorker } = useWorker(workerId);
  const {
    data: attendance,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useWorkerAttendance(workerId);
  const { data: farms } = useFarms();

  const [settlementVisible, setSettlementVisible] = useState(false);

  const isLoading = workerLoading || attendanceLoading;

  const dateRange = useMemo(() => getDefaultDateRange(30), []);

  const periodAttendance = useMemo(() => {
    if (!attendance) return [];
    return attendance
      .filter((r) => isDateInRange(r.date, dateRange))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, dateRange]);

  const metrics = useMemo(() => {
    let full = 0,
      half = 0,
      absent = 0,
      earnings = 0;
    periodAttendance.forEach((r) => {
      const s = r.work_status as WorkStatus;
      if (s === 'full_day') full++;
      else if (s === 'half_day') half++;
      else if (s === 'absent') absent++;
      if (worker)
        earnings += calculateWorkerEarnings(worker, s, r.daily_rate_override ?? undefined);
    });
    return { full, half, absent, earnings };
  }, [periodAttendance, worker]);

  // 30-day strip for calendar grid
  const calendarDays = useMemo(() => {
    const map = new Map<string, WorkStatus>();
    periodAttendance.forEach((r) => map.set(r.date.slice(0, 10), r.work_status as WorkStatus));
    const days: { date: string; status: WorkStatus | null }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = localDateKey(d);
      days.push({ date: key, status: map.get(key) ?? null });
    }
    return days;
  }, [periodAttendance]);

  // By-farm breakdown using farm_ids
  const byFarm = useMemo(() => {
    const map = new Map<number, { full: number; half: number }>();
    periodAttendance.forEach((r) => {
      const farmIds = r.farm_ids ?? [];
      const s = r.work_status as WorkStatus;
      farmIds.forEach((farmId) => {
        const existing = map.get(farmId) ?? { full: 0, half: 0 };
        if (s === 'full_day') existing.full++;
        else if (s === 'half_day') existing.half++;
        map.set(farmId, existing);
      });
    });
    return Array.from(map.entries())
      .map(([farmId, counts], i) => {
        const farm = farms?.find((f) => f.id === farmId);
        return {
          farmId,
          name: farm?.name ?? `Farm ${farmId}`,
          accent: ACCENT_COLORS[i % ACCENT_COLORS.length],
          ...counts,
        };
      })
      .filter((f) => f.full + f.half > 0);
  }, [periodAttendance, farms]);

  const recentDays = useMemo(() => periodAttendance.slice(0, 6), [periodAttendance]);

  const totalFarmDays = byFarm.reduce((a, f) => a + f.full + f.half, 0);

  const cellColor = (status: WorkStatus | null) => {
    if (status === 'full_day') return colors.success;
    if (status === 'half_day') return isDark ? '#C49843' : '#D0A14A';
    if (status === 'absent') return m3.colorScheme.error;
    return isDark ? colors.surface[200] : colors.surface[200];
  };

  const cellLabel = (status: WorkStatus | null) => {
    if (status === 'full_day') return 'F';
    if (status === 'half_day') return 'H';
    if (status === 'absent') return 'A';
    return '·';
  };

  const statusBadgeProps = (status: WorkStatus | null) => {
    if (status === 'full_day')
      return {
        label: t('attendance.status.fullDay', { defaultValue: 'Full' }),
        color: colors.success,
        bg: colorWithOpacity(colors.success, isDark ? 0.18 : 0.14),
      };
    if (status === 'half_day')
      return {
        label: t('attendance.status.halfDay', { defaultValue: 'Half' }),
        color: isDark ? '#C49843' : '#D0A14A',
        bg: colorWithOpacity(isDark ? '#C49843' : '#D0A14A', 0.18),
      };
    if (status === 'absent')
      return {
        label: t('attendance.status.absent', { defaultValue: 'Absent' }),
        color: m3.colorScheme.error,
        bg: colorWithOpacity(m3.colorScheme.error, isDark ? 0.18 : 0.12),
      };
    return {
      label: t('attendance.status.off', { defaultValue: 'Off' }),
      color: colors.surface[400],
      bg: colors.surface[200],
    };
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={m3.colorScheme.primary} />
      </View>
    );
  }

  if (!worker) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <Text style={{ color: m3.colorScheme.onSurface, fontSize: fontSize.lg }}>
          {t('common.notFound', { defaultValue: 'Not found' })}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
          <Text style={{ color: m3.colorScheme.primary, fontWeight: '600' }}>
            {t('common.back', { defaultValue: 'Go back' })}
          </Text>
        </Pressable>
      </View>
    );
  }

  const initials =
    worker.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  const avatarTint = isDark ? colors.primary[400] : colors.primary[600];

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
        }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: (isAndroid ? 0 : insets.top) + spacing[2],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[2],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 0.5,
            borderBottomColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Go back' })}
          >
            <UiSymbol name="chevron.left" size={18} color={colors.surface[500]} />
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.surface[500] }}>
              {t('workers.title', { defaultValue: 'Workers' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setAddWorker({ worker });
              router.push('/add-worker');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('workers.workerCard.editA11y', {
              name: worker.name,
              defaultValue: 'Edit {{name}}',
            })}
          >
            <UiSymbol name="ellipsis" size={20} color={colors.surface[500]} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: borderRadius.full,
                backgroundColor: avatarTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xl,
                  fontWeight: '700',
                  color: '#F7F3ED',
                  letterSpacing: -0.3,
                }}
              >
                {initials}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: '700',
                  color: colors.surface[900],
                  letterSpacing: -0.3,
                }}
              >
                {worker.name}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <View
                  style={{
                    height: 22,
                    paddingHorizontal: 9,
                    borderRadius: radius.full,
                    backgroundColor: colors.surface[200],
                    borderWidth: 1,
                    borderColor: colors.surface[300],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.surface[500] }}
                  >
                    ₹{worker.daily_rate}/day
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Settlement summary card */}
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderWidth: 1,
              borderColor: colors.surface[300],
              borderRadius: radius.lg,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: colors.surface[500],
                  }}
                >
                  {t('workers.settlement.earnedWages', {
                    defaultValue: 'Earned wages · last 30 days',
                  })}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize['3xl'],
                    fontWeight: '700',
                    color: colors.surface[900],
                    letterSpacing: -0.4,
                    marginTop: 4,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  ₹{metrics.earnings.toLocaleString('en-IN')}
                </Text>
                {worker.advance_balance > 0 && (
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500], marginTop: 4 }}>
                    {t('workers.settlement.advanceBalance', {
                      defaultValue: 'Advance: ₹{{amount}}',
                      amount: worker.advance_balance.toLocaleString('en-IN'),
                    })}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setSettlementVisible(true)}
                style={({ pressed }) => ({
                  height: 40,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                  backgroundColor: m3.colorScheme.primary,
                  opacity: pressed ? 0.85 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
                accessibilityRole="button"
                accessibilityLabel={t('workers.actions.settleWorker', {
                  name: worker.name,
                  defaultValue: 'Settle wages for {{name}}',
                })}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: '600',
                    color: m3.colorScheme.onPrimary,
                  }}
                >
                  {t('workers.actions.settle', { defaultValue: 'Settle' })}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Day summary tiles */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
            {[
              {
                label: t('attendance.status.full', { defaultValue: 'Full' }),
                value: metrics.full,
                color: colors.success,
              },
              {
                label: t('attendance.status.half', { defaultValue: 'Half' }),
                value: metrics.half,
                color: isDark ? '#C49843' : '#D0A14A',
              },
              {
                label: t('attendance.status.absent', { defaultValue: 'Absent' }),
                value: metrics.absent,
                color: m3.colorScheme.error,
              },
              {
                label: t('attendance.status.off', { defaultValue: 'Off' }),
                value: Math.max(0, 30 - metrics.full - metrics.half - metrics.absent),
                color: colors.surface[400],
              },
            ].map((s) => (
              <View
                key={s.label}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                  borderRadius: radius.md,
                  padding: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: '700',
                    color: s.color,
                    fontVariant: ['tabular-nums'],
                    lineHeight: 24,
                  }}
                >
                  {s.value}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize['2xs'],
                    fontWeight: '600',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: colors.surface[500],
                    marginTop: 4,
                  }}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Month calendar */}
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderWidth: 1,
              borderColor: colors.surface[300],
              borderRadius: radius.lg,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: '600',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: colors.surface[500],
                }}
              >
                {t('workers.detail.last30Days', { defaultValue: 'Last 30 days' })}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                {calendarDays.length} days
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {calendarDays.map(({ date, status }, i) => {
                const { num } = dayLabel(date);
                const bg = cellColor(status);
                const label = cellLabel(status);
                const isOff = status === null;
                return (
                  <View
                    key={i}
                    style={{
                      width: '14.5%',
                      aspectRatio: 1,
                      borderRadius: radius.sm,
                      backgroundColor: bg,
                      borderWidth: isOff ? 1 : 0,
                      borderColor: colors.surface[300],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize['2xs'],
                        opacity: 0.85,
                        fontWeight: '500',
                        color: isOff ? colors.surface[400] : '#F7F3ED',
                      }}
                    >
                      {num}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: '700',
                        color: isOff ? colors.surface[400] : '#F7F3ED',
                        lineHeight: 13,
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              {[
                {
                  color: colors.success,
                  label: t('attendance.status.full', { defaultValue: 'Full' }),
                },
                {
                  color: isDark ? '#C49843' : '#D0A14A',
                  label: t('attendance.status.half', { defaultValue: 'Half' }),
                },
                {
                  color: m3.colorScheme.error,
                  label: t('attendance.status.absent', { defaultValue: 'Absent' }),
                },
                {
                  color: colors.surface[200],
                  label: t('attendance.status.noRecord', { defaultValue: 'No record' }),
                  border: true,
                },
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radius.xs,
                      backgroundColor: s.color,
                      borderWidth: s.border ? 1 : 0,
                      borderColor: colors.surface[300],
                    }}
                  />
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* By-farm breakdown */}
          {byFarm.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: '600',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: colors.surface[500],
                  marginBottom: 8,
                }}
              >
                {t('workers.detail.byFarm', { defaultValue: 'By farm · this period' })}
              </Text>
              <View style={{ gap: 8, marginBottom: 14 }}>
                {byFarm.map((f) => {
                  const total = f.full + f.half;
                  const pct = totalFarmDays > 0 ? total / totalFarmDays : 0;
                  return (
                    <View
                      key={f.farmId}
                      style={{
                        backgroundColor: colors.surface[100],
                        borderWidth: 1,
                        borderColor: colors.surface[300],
                        borderRadius: radius.lg,
                        padding: 12,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: radius.full,
                              backgroundColor: f.accent,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: fontSize.sm,
                                fontWeight: '600',
                                color: colors.surface[900],
                              }}
                              numberOfLines={1}
                            >
                              {f.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                color: colors.surface[500],
                                marginTop: 2,
                                fontVariant: ['tabular-nums'],
                              }}
                            >
                              {f.full} full · {f.half} half
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: '700',
                              color: colors.surface[900],
                              fontVariant: ['tabular-nums'],
                            }}
                          >
                            {total} d
                          </Text>
                          <Text style={{ fontSize: fontSize['2xs'], color: colors.surface[500] }}>
                            {Math.round(pct * 100)}%
                          </Text>
                        </View>
                      </View>
                      {/* Stacked bar */}
                      <View
                        style={{
                          marginTop: 10,
                          height: 6,
                          borderRadius: radius.full,
                          backgroundColor: colors.surface[200],
                          overflow: 'hidden',
                          flexDirection: 'row',
                        }}
                      >
                        <View style={{ flex: f.full, backgroundColor: colors.success }} />
                        <View
                          style={{ flex: f.half, backgroundColor: isDark ? '#C49843' : '#D0A14A' }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Recent days log */}
          {recentDays.length > 0 && (
            <>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: '600',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: colors.surface[500],
                  marginBottom: 8,
                }}
              >
                {t('workers.detail.recentDays', { defaultValue: 'Recent days' })}
              </Text>
              <View
                style={{
                  backgroundColor: colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  marginBottom: 14,
                }}
              >
                {recentDays.map((r, i) => {
                  const badge = statusBadgeProps(r.work_status as WorkStatus);
                  const dl = dayLabel(r.date);
                  const farmId = r.farm_ids?.[0];
                  const farm = farms?.find((f) => f.id === farmId);
                  const farmIdx = byFarm.findIndex((f) => f.farmId === farmId);
                  const fallbackFarmIdx = farms?.findIndex((f) => f.id === farmId) ?? 0;
                  const accentIndex = farmIdx >= 0 ? farmIdx : Math.max(0, fallbackFarmIdx);
                  const farmAccent = ACCENT_COLORS[accentIndex % ACCENT_COLORS.length];

                  return (
                    <View
                      key={r.id ?? i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 11,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < recentDays.length - 1 ? 1 : 0,
                        borderBottomColor: colors.surface[300],
                      }}
                    >
                      <View style={{ width: 50 }}>
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: '600',
                            color: colors.surface[900],
                          }}
                        >
                          {dl.short}
                        </Text>
                        <Text
                          style={{
                            fontSize: fontSize.xs,
                            color: colors.surface[500],
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {dl.num} {MONTH_SHORT[parseInt(r.date.slice(5, 7), 10) - 1] ?? ''}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={{
                              height: 20,
                              paddingHorizontal: 8,
                              borderRadius: radius.full,
                              backgroundColor: badge.bg,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize['2xs'],
                                fontWeight: '700',
                                color: badge.color,
                              }}
                            >
                              {badge.label}
                            </Text>
                          </View>
                          {farm && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: radius.full,
                                  backgroundColor: farmAccent,
                                }}
                              />
                              <Text
                                style={{ fontSize: fontSize.xs, color: colors.surface[500] }}
                                numberOfLines={1}
                              >
                                {farm.name}
                              </Text>
                            </View>
                          )}
                        </View>
                        {r.work_type ? (
                          <Text
                            style={{
                              fontSize: fontSize.xs,
                              color: colors.surface[400],
                              marginTop: 3,
                            }}
                            numberOfLines={1}
                          >
                            {r.work_type}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              <Pressable
                style={({ pressed }) => ({
                  width: '100%',
                  height: 44,
                  backgroundColor: pressed ? colors.surface[200] : colors.surface[100],
                  borderWidth: 1,
                  borderColor: colors.surface[300],
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
                onPress={() =>
                  workerId ? router.push(`/worker-analytics/${workerId}`) : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={t('workers.detail.viewFullHistoryA11y', {
                  defaultValue: 'View full attendance history',
                })}
              >
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.surface[500] }}
                >
                  {t('workers.detail.viewFullHistory', { defaultValue: 'View full history' })}
                </Text>
              </Pressable>
            </>
          )}

          {periodAttendance.length === 0 && !isLoading && (
            <View style={{ alignItems: 'center', padding: spacing[8] }}>
              <Text
                style={{ fontSize: fontSize.sm, color: colors.surface[500], textAlign: 'center' }}
              >
                {t('workers.detail.noAttendanceYet', {
                  defaultValue: 'No attendance recorded in the last 30 days.',
                })}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <WorkerSettlementModal
        visible={settlementVisible}
        onClose={() => setSettlementVisible(false)}
        workers={worker ? [worker] : []}
        initialWorkerId={workerId}
        onSuccess={() => {
          setSettlementVisible(false);
          refetchWorker();
          refetchAttendance();
        }}
      />
    </>
  );
}
