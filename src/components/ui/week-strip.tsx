/**
 * WeekStrip — horizontal 7-day date selector.
 * Shows the Sunday-Saturday week containing the selected day, with a marker dot
 * on days that already have saved logs. Future dates stay empty because logs
 * can only be created for today or the past.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { fontSize, radius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { AppIcon } from '@/components/ui/app-icon';
import { toSupabaseDateString } from '@/types/database';

interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** ISO (yyyy-mm-dd) dates that already have saved logs — rendered with a dot. */
  markedDates?: ReadonlySet<string>;
  /** Latest selectable day. Defaults to today; later days render disabled. */
  maxDate?: Date;
  /** Opens the full date picker for dates outside the 7-day window. */
  onOpenPicker?: () => void;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function WeekStrip({
  selectedDate,
  onSelectDate,
  markedDates,
  maxDate,
  onOpenPicker,
}: WeekStripProps) {
  const m3 = useM3();
  const { t } = useTranslation();

  const latestDay = startOfDay(maxDate ?? new Date());
  const selectedDay = startOfDay(selectedDate);
  const selectedIso = toSupabaseDateString(selectedDay);

  const weekStart = addDays(selectedDay, -selectedDay.getDay());

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      return { date, iso: toSupabaseDateString(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime()]);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        {onOpenPicker ? (
          <Pressable
            onPress={onOpenPicker}
            accessibilityRole="button"
            accessibilityLabel={t('entryForm.pickDate', { defaultValue: 'Pick date' })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
            }}
          >
            <AppIcon name="calendar" size={15} color={m3.colorScheme.primary} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: '700',
                color: m3.colorScheme.primary,
              }}
            >
              {formatDate(selectedDate, { month: 'long', year: 'numeric' })}
            </Text>
            <AppIcon name="chevron-right" size={14} color={m3.colorScheme.primary} />
          </Pressable>
        ) : (
          <Text
            selectable
            style={{
              fontSize: fontSize.sm,
              fontWeight: '700',
              color: m3.colorScheme.onSurface,
            }}
          >
            {formatDate(selectedDate, { month: 'long', year: 'numeric' })}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 5, marginBottom: 2 }}>
        {days.map(({ date, iso }) => (
          <Text
            key={`weekday-${iso}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: fontSize['2xs'],
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            {formatDate(date, { weekday: 'short' })}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {days.map(({ date, iso }) => {
          const isSelected = iso === selectedIso;
          const isFuture = date.getTime() > latestDay.getTime();
          const hasLogs = markedDates?.has(iso) ?? false;

          if (isFuture) {
            return <View key={iso} style={{ flex: 1, minHeight: 54 }} />;
          }

          return (
            <Pressable
              key={iso}
              onPress={() => onSelectDate(date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={formatDate(date, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 54,
                borderRadius: radius.md,
                backgroundColor: isSelected ? m3.colorScheme.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: '700',
                  color: isSelected ? m3.colorScheme.onPrimary : m3.colorScheme.onSurface,
                }}
              >
                {date.getDate()}
              </Text>
              <View
                style={{
                  marginTop: 3,
                  width: 4,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor: hasLogs
                    ? isSelected
                      ? m3.colorScheme.onPrimary
                      : m3.colorScheme.tertiary
                    : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
