/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 * Cellar Ledger design: compact list item with colored dot
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3 } from '@/styles/use-theme';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '../../types';

type RecordData =
  | IrrigationRecord
  | SprayRecord
  | HarvestRecord
  | ExpenseRecord
  | FertigationRecord;

interface ActivityLogCardProps {
  type: LogTypeId;
  date: string;
  description?: string;
  data?: RecordData;
  farmName?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Generate description from record data
function getDescriptionFromData(
  type: LogTypeId,
  t: (key: string, options?: Record<string, unknown>) => string,
  data?: RecordData,
  currency?: string,
): string {
  if (!data) return '';

  switch (type) {
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      const duration = irrigation.duration ?? 0;
      const displayDuration = formatNumber(duration, {
        maximumFractionDigits: Number.isInteger(duration) ? 0 : 1,
      });
      return t('logs.irrigationDurationHoursShort', { hours: displayDuration });
    }
    case 'spray': {
      const spray = data as SprayRecord;
      return spray.chemical || t('logs.sprayApplication');
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      const quantity = formatNumber(harvest.quantity ?? 0, { maximumFractionDigits: 1 });
      const grade = harvest.grade || t('common.na');
      return t('logs.harvestDescription', { quantityKg: quantity, grade });
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      if (!currency) return '';
      const cost = formatCurrency(expense.cost ?? 0, currency);
      const expenseType = expense.type || t('common.general');
      return t('logs.expenseDescription', { cost, type: expenseType });
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      const fertNames =
        fertigation.fertilizers?.map((f) => f.name?.trim() ?? '').filter(Boolean) ?? [];
      if (fertNames.length > 0) {
        return fertNames.join(', ');
      }
      const fertCount = fertigation.fertilizers?.length || 0;
      return t('logs.fertigationApplied', {
        count: fertCount,
        countFormatted: formatNumber(fertCount, { maximumFractionDigits: 0 }),
      });
    }
    default:
      return '';
  }
}

export function ActivityLogCard({
  type,
  date,
  description,
  data,
  farmName,
  onPress,
  onEdit,
  onDelete,
}: ActivityLogCardProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const currency = useCurrency();

  const hasActions = Boolean(onEdit || onDelete);
  const isInteractive = Boolean(onPress) && !hasActions;
  const logType = getLogType(type);
  const parsedDate = fromSupabaseDateString(date);
  const displayDescription = description || getDescriptionFromData(type, t, data, currency);
  const displayDate = parsedDate
    ? formatDate(parsedDate, { month: 'short', day: 'numeric' })
    : date;

  // Cellar Ledger: compact list item - no card wrapper, just list item styling
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    backgroundColor: m3.surface.s100, // mist-1
    borderWidth: 1,
    borderColor: m3.surface.s300, // stone-3
    overflow: 'hidden',
  };

  // Cellar Ledger: compact colored dot (8px)
  const dotContainerStyle: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    marginRight: spacing[3],
    backgroundColor: logType.color,
    flexShrink: 0,
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
  };

  // Cellar Ledger: primary text 14px/500
  const descriptionTextStyle: TextStyle = {
    fontSize: fontSize.sm, // 14px
    fontWeight: fontWeight.medium, // 500
    color: m3.surface.s900, // ink
  };

  const metaContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  // Cellar Ledger: secondary text 12px/bark
  const farmTextStyle: TextStyle = {
    fontSize: fontSize.xs, // 12px
    color: m3.surface.s500, // bark
  };

  const separatorTextStyle: TextStyle = {
    fontSize: fontSize.xs, // 12px
    marginHorizontal: 4,
    color: m3.surface.s400, // stone-5
  };

  // Cellar Ledger: time 12px/stone-5
  const dateTextStyle: TextStyle = {
    fontSize: fontSize.xs, // 12px
    color: m3.surface.s400, // stone-5
  };

  if (isInteractive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${displayDescription || t(logType.labelKey)}${farmName ? `, ${farmName}` : ''}. ${displayDate}.`}
      >
        {({ pressed }) => (
          <View style={containerStyle}>
            <View style={dotContainerStyle} />

            <View style={contentContainerStyle}>
              <Text style={descriptionTextStyle} numberOfLines={1}>
                {displayDescription || t(logType.labelKey)}
              </Text>
              <View style={metaContainerStyle}>
                {farmName && (
                  <>
                    <Text style={farmTextStyle} numberOfLines={1}>
                      {farmName}
                    </Text>
                    <Text style={separatorTextStyle}>•</Text>
                  </>
                )}
                <Text style={dateTextStyle}>{displayDate}</Text>
              </View>
            </View>

            <UiSymbol
              name="chevron.right"
              size={16}
              color={m3.surface.s400} // stone-5
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.surface.s900, 0.12)
                    : 'transparent',
                },
              ]}
            />
          </View>
        )}
      </Pressable>
    );
  }

  if (hasActions) {
    return (
      <View style={containerStyle}>
        <View style={dotContainerStyle} />
        <View style={contentContainerStyle}>
          <Text style={descriptionTextStyle} numberOfLines={1}>
            {displayDescription || t(logType.labelKey)}
          </Text>
          <View style={metaContainerStyle}>
            {farmName && (
              <>
                <Text style={farmTextStyle} numberOfLines={1}>
                  {farmName}
                </Text>
                <Text style={separatorTextStyle}>•</Text>
              </>
            )}
            <Text style={dateTextStyle}>{displayDate}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
          {onEdit && (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={t('farmDetails.a11y.editActivity', {
                type: t(logType.labelKey),
              })}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colorWithOpacity(m3.surface.s900, 0.12) : 'transparent',
              })}
            >
              <UiSymbol name="pencil" size={16} color={m3.colorScheme.primary} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={t('farmDetails.a11y.deleteActivity', {
                type: t(logType.labelKey),
              })}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colorWithOpacity(m3.surface.s900, 0.12) : 'transparent',
              })}
            >
              <UiSymbol name="trash" size={16} color={m3.colorScheme.error} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={dotContainerStyle} />
      <View style={contentContainerStyle}>
        <Text style={descriptionTextStyle} numberOfLines={1}>
          {displayDescription || t(logType.labelKey)}
        </Text>
        <View style={metaContainerStyle}>
          {farmName && (
            <>
              <Text style={farmTextStyle} numberOfLines={1}>
                {farmName}
              </Text>
              <Text style={separatorTextStyle}>•</Text>
            </>
          )}
          <Text style={dateTextStyle}>{displayDate}</Text>
        </View>
      </View>
    </View>
  );
}
