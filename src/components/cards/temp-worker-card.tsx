import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3 } from '@/styles/use-theme';
import { parseDbDateToLocalDate } from '@/utils/date';
import type { TemporaryWorkerEntry } from '@/types';
import { colors } from '@/styles/theme';

interface TempWorkerCardProps {
  entry: TemporaryWorkerEntry;
  onDelete?: () => void;
}

export function TempWorkerCard({ entry, onDelete }: TempWorkerCardProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const currency = useCurrency();

  const parsedDate = parseDbDateToLocalDate(entry.date);
  const displayDate = parsedDate
    ? formatDate(parsedDate, { month: 'short', day: 'numeric' })
    : entry.date;
  const displayAmount = formatCurrency(entry.amount_paid, currency);
  const displayHours = `${entry.hours_worked} hrs`;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: m3.shape.cornerMedium,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: m3.surface.surfaceContainerLow,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
  };

  const iconContainerStyle: ViewStyle = {
    width: spacing[10],
    height: spacing[10],
    minWidth: spacing[10],
    minHeight: spacing[10],
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    backgroundColor: colorWithOpacity(colors.warning, 0.14),
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
  };

  const nameTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const metaContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  const metaTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const separatorTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    marginHorizontal: spacing[1],
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
  };

  return (
    <View style={containerStyle}>
      <View style={iconContainerStyle}>
        <UiSymbol name="person.badge.clock" size={18} color={colors.warning} />
      </View>
      <View style={contentContainerStyle}>
        <Text style={nameTextStyle} numberOfLines={1}>
          {entry.name}
        </Text>
        <View style={metaContainerStyle}>
          <Text style={metaTextStyle}>{displayAmount}</Text>
          <Text style={separatorTextStyle}>·</Text>
          <Text style={metaTextStyle}>{displayHours}</Text>
          <Text style={separatorTextStyle}>·</Text>
          <Text style={metaTextStyle}>{displayDate}</Text>
        </View>
      </View>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: m3.shape.cornerMedium,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed
              ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
              : 'transparent',
          })}
        >
          <UiSymbol name="trash" size={16} color={m3.colorScheme.error} />
        </Pressable>
      )}
    </View>
  );
}
