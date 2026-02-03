/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useProfile } from '@/hooks';
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
      const cost = formatCurrency(expense.cost ?? 0, currency || 'USD');
      const expenseType = expense.type || t('common.general');
      return t('logs.expenseDescription', { cost, type: expenseType });
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
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
}: ActivityLogCardProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const currency = profile?.preferred_currency || 'INR';

  const isInteractive = Boolean(onPress);
  const logType = getLogType(type);
  const parsedDate = fromSupabaseDateString(date);
  const displayDescription = description || getDescriptionFromData(type, t, data, currency);
  const displayDate = parsedDate
    ? formatDate(parsedDate, { month: 'short', day: 'numeric' })
    : date;

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: m3.shape.cornerMedium,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: m3.surface.surfaceContainerLow,
    borderWidth: 1,
    borderColor: m3.colorScheme.outlineVariant,
    overflow: 'hidden',
  };

  const iconContainerStyle: ViewStyle = {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
    backgroundColor: colorWithOpacity(logType.color, 0.14),
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
  };

  const descriptionTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
  };

  const metaContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  };

  const farmTextStyle: TextStyle = {
    fontSize: 12,
    color: m3.colorScheme.onSurfaceVariant,
  };

  const separatorTextStyle: TextStyle = {
    fontSize: 12,
    marginHorizontal: 4,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
  };

  const dateTextStyle: TextStyle = {
    fontSize: 12,
    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
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
            <View style={iconContainerStyle}>
              <UiSymbol name={logType.icon} size={18} color={logType.color} />
            </View>

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
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
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
        )}
      </Pressable>
    );
  }

  return (
    <View style={containerStyle}>
      <View style={iconContainerStyle}>
        <UiSymbol name={logType.icon} size={18} color={logType.color} />
      </View>
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
