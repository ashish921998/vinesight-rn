import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Symbol as CardSymbol } from '@/components/ui/symbol';
import type { Worker, WorkerAttendance, WorkStatus } from '../../types';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';
import { calculateWorkerEarnings } from '@/types';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onCall?: (worker: Worker) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isActive?: boolean;
  /** Last 30 days of attendance records for this worker */
  attendance?: WorkerAttendance[];
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildStrip(attendance: WorkerAttendance[], days = 30): (WorkStatus | null)[] {
  const map = new Map<string, WorkStatus>();
  attendance.forEach((r) => {
    const d = r.date.slice(0, 10);
    map.set(d, r.work_status as WorkStatus);
  });

  const strip: (WorkStatus | null)[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    strip.push(map.get(localDateKey(d)) ?? null);
  }
  return strip;
}

function todayStatus(attendance: WorkerAttendance[]): WorkStatus | null {
  const today = localDateKey(new Date());
  const record = attendance.find((r) => r.date.slice(0, 10) === today);
  return record ? (record.work_status as WorkStatus) : null;
}

export function WorkerCard({
  worker,
  onPress,
  onCall: _onCall,
  onEdit,
  onDelete,
  isActive = worker.is_active,
  attendance,
}: WorkerCardProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { t } = useTranslation();

  const hasAttendance = !!attendance && attendance.length > 0;

  const strip = useMemo(() => (attendance ? buildStrip(attendance) : null), [attendance]);

  const todayStatusValue = useMemo(
    () => (attendance ? todayStatus(attendance) : null),
    [attendance],
  );

  const periodSummary = useMemo(() => {
    if (!attendance || attendance.length === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    const cutoffStr = localDateKey(cutoff);
    let full = 0,
      half = 0,
      absent = 0,
      pending = 0;
    const todayStr = localDateKey(new Date());
    attendance.forEach((r) => {
      const d = r.date.slice(0, 10);
      if (d < cutoffStr || d > todayStr) return;
      const s = r.work_status as WorkStatus;
      if (s === 'full_day') full++;
      else if (s === 'half_day') half++;
      else if (s === 'absent') absent++;
      pending += calculateWorkerEarnings(worker, s, r.daily_rate_override ?? undefined);
    });
    if (full + half + absent === 0) return null;
    return { full, half, absent, pending };
  }, [attendance, worker]);

  const initials =
    worker.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  // TODO(theming): primary[400]/primary[600] have no value-equivalent M3 token
  // (M3 only exposes primary[500] as colorScheme.primary, primary[100/800] as
  // primaryContainer, primary[300] as inversePrimary, primary[900] as
  // onPrimaryContainer). Keeping useThemeColors here to preserve exact pixels.
  // Resolve in Phase 3 when primary shades get migrated/added.
  const avatarTint = isDark ? colors.primary[400] : colors.primary[600];
  const inactiveAvatarTint = isDark ? '#7A756D' : '#A89E92';

  const todayStatusConfig = useMemo(() => {
    if (!todayStatusValue) return null;
    if (todayStatusValue === 'full_day') {
      return {
        label: t('attendance.status.fullDay', { defaultValue: 'Present' }),
        color: m3.colorScheme.success,
        bg: colorWithOpacity(m3.colorScheme.success, isDark ? 0.16 : 0.12),
      };
    }
    if (todayStatusValue === 'half_day') {
      return {
        label: t('attendance.status.halfDay', { defaultValue: 'Half day' }),
        color: isDark ? '#C49843' : '#D0A14A',
        bg: colorWithOpacity(isDark ? '#C49843' : '#D0A14A', isDark ? 0.16 : 0.14),
      };
    }
    return {
      label: t('attendance.status.absent', { defaultValue: 'Absent' }),
      color: m3.colorScheme.error,
      bg: colorWithOpacity(m3.colorScheme.error, isDark ? 0.16 : 0.1),
    };
  }, [todayStatusValue, isDark, m3, t]);

  const stripCellColor = (status: WorkStatus | null): string => {
    if (status === 'full_day') return m3.colorScheme.success;
    if (status === 'half_day') return isDark ? '#C49843' : '#D0A14A';
    if (status === 'absent') return m3.colorScheme.error;
    return isDark ? m3.surface.s300 : m3.surface.s200;
  };

  const renderCardContent = (pressed: boolean) => (
    <View
      style={{
        backgroundColor: m3.surface.s100,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: m3.surface.s300,
        overflow: 'hidden',
        padding: 14,
      }}
    >
      {/* Top row: avatar + name/rate + actions/chevron */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: isActive ? avatarTint : inactiveAvatarTint,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: '700',
              color: '#F7F3ED',
              letterSpacing: -0.2,
            }}
          >
            {initials}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                }}
                numberOfLines={1}
              >
                {worker.name}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                {t('workers.card.dailyRate', {
                  defaultValue: '₹{{rate}}/day',
                  rate: worker.daily_rate,
                })}
              </Text>
            </View>

            {/* Edit/delete actions or chevron */}
            {onEdit || onDelete ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {onEdit && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('workers.workerCard.editA11y', { name: worker.name })}
                    style={({ pressed: p }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, p ? 0.2 : 0.12),
                    })}
                  >
                    <CardSymbol name="pencil" size={16} color={m3.colorScheme.primary} />
                  </Pressable>
                )}
                {onDelete && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('workers.workerCard.deleteA11y', { name: worker.name })}
                    style={({ pressed: p }) => ({
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.error, p ? 0.2 : 0.12),
                    })}
                  >
                    <CardSymbol name="trash" size={16} color={m3.colorScheme.error} />
                  </Pressable>
                )}
              </View>
            ) : (
              <CardSymbol name="chevron.right" size={14} color={m3.surface.s400} />
            )}
          </View>

          {/* Day strip + today status badge */}
          {strip && (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 2, flex: 1 }}>
                {strip.map((s, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 14,
                      borderRadius: radius.xs,
                      backgroundColor: stripCellColor(s),
                      opacity: s === null ? 0.5 : 1,
                      borderWidth: s === null ? 1 : 0,
                      borderColor: m3.surface.s300,
                    }}
                  />
                ))}
              </View>

              {todayStatusConfig && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    height: 22,
                    paddingHorizontal: 9,
                    borderRadius: radius.full,
                    backgroundColor: todayStatusConfig.bg,
                    flexShrink: 0,
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: radius.full,
                      backgroundColor: todayStatusConfig.color,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: '600',
                      color: todayStatusConfig.color,
                    }}
                  >
                    {todayStatusConfig.label}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Bottom summary row */}
      {periodSummary && (
        <View
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: m3.surface.s300,
            borderStyle: 'dashed',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: m3.surface.s900 }}>
              {periodSummary.full}F · {periodSummary.half}H · {periodSummary.absent}A
            </Text>
            {'  '}
            {t('workers.card.thisPeriod', { defaultValue: 'this period' })}
          </Text>
          <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: m3.surface.s900 }}>
            ₹{periodSummary.pending.toLocaleString('en-IN')}{' '}
            <Text style={{ fontSize: fontSize['2xs'], fontWeight: '500', color: m3.surface.s500 }}>
              {t('workers.card.earned', { defaultValue: 'earned' })}
            </Text>
          </Text>
        </View>
      )}

      {/* Fallback when no attendance: show active/inactive status */}
      {!hasAttendance && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing[2],
            gap: spacing[2],
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: borderRadius.full,
              backgroundColor: isActive ? m3.colorScheme.success : m3.surface.s400,
            }}
          />
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: isActive ? m3.colorScheme.success : m3.surface.s400,
            }}
          >
            {isActive ? t('workers.status.active') : t('workers.status.inactive')}
          </Text>
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: pressed
              ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
              : 'transparent',
          },
        ]}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={worker.name}
        style={!isActive ? { opacity: 0.55 } : undefined}
      >
        {({ pressed }) => renderCardContent(pressed)}
      </Pressable>
    );
  }

  return renderCardContent(false);
}
