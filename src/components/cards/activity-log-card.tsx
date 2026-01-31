/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import { m3, spacing, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
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
function getDescriptionFromData(type: LogTypeId, data?: RecordData): string {
  if (!data) return '';

  switch (type) {
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      const duration = irrigation.duration ?? 0;
      const displayDuration = Number.isInteger(duration) ? duration : duration.toFixed(1);
      return `${displayDuration}h`;
    }
    case 'spray': {
      const spray = data as SprayRecord;
      return spray.chemical || 'Spray application';
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      return `${harvest.quantity?.toFixed(1) || 0}kg - ${harvest.grade || 'N/A'}`;
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      return `₹${expense.cost?.toLocaleString() || 0} - ${expense.type || 'General'}`;
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      const fertCount = fertigation.fertilizers?.length || 0;
      return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''} applied`;
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
  const isInteractive = Boolean(onPress);
  const logType = getLogType(type);
  const parsedDate = fromSupabaseDateString(date);
  const displayDescription = description || getDescriptionFromData(type, data);
  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
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
        accessibilityLabel={`${displayDescription || logType.label}${farmName ? `, ${farmName}` : ''}. ${displayDate}.`}
      >
        {({ pressed }) => (
          <View style={containerStyle}>
            <View style={iconContainerStyle}>
              <UiSymbol name={logType.icon} size={18} color={logType.color} />
            </View>

            <View style={contentContainerStyle}>
              <Text style={descriptionTextStyle} numberOfLines={1}>
                {displayDescription || logType.label}
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
          {displayDescription || logType.label}
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
