/**
 * WeekStrip — horizontal 7-day date selector.
 * Shows the week ending at the selected day (or today), with a marker dot on
 * days that already have saved logs. Tapping a day selects it; the calendar
 * button hands off to a full date picker for anything outside the window.
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

  // Window of 7 days ending at the latest selectable day, shifted back when
  // the selected date (picked via the full calendar) falls outside it.
  const windowEnd =
    selectedDay.getTime() < addDays(latestDay, -6).getTime() ? selectedDay : latestDay;

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(windowEnd, index - 6);
      return { date, iso: toSupabaseDateString(date) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEnd.getTime()]);

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
        {onOpenPicker && (
          <Pressable
            onPress={onOpenPicker}
            accessibilityRole="button"
            accessibilityLabel={t('entryForm.pickDate', { defaultValue: 'Pick date' })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
            }}
          >
            <AppIcon name="calendar" size={14} color={m3.colorScheme.primary} />
            <Text
              style={{
                marginLeft: 6,
                fontSize: fontSize.xs,
                fontWeight: '700',
                color: m3.colorScheme.primary,
              }}
            >
              {t('entryForm.pickDate', { defaultValue: 'Pick date' })}
            </Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {days.map(({ date, iso }) => {
          const isSelected = iso === selectedIso;
          const isDisabled = date.getTime() > latestDay.getTime();
          const hasLogs = markedDates?.has(iso) ?? false;
          return (
            <Pressable
              key={iso}
              disabled={isDisabled}
              onPress={() => onSelectDate(date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              accessibilityLabel={formatDate(date, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 8,
                borderRadius: radius.md,
                backgroundColor: isSelected ? m3.colorScheme.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize['2xs'],
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: isSelected
                    ? colorWithOpacity(m3.colorScheme.onPrimary, 0.8)
                    : isDisabled
                      ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.35)
                      : m3.colorScheme.onSurfaceVariant,
                }}
              >
                {formatDate(date, { weekday: 'short' })}
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: fontSize.base,
                  fontWeight: '700',
                  color: isSelected
                    ? m3.colorScheme.onPrimary
                    : isDisabled
                      ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.35)
                      : m3.colorScheme.onSurface,
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
