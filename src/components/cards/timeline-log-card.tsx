/**
 * TimelineLogCard Component
 * Displays a single activity log entry with timeline styling and swipe actions
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  PanResponder,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { useM3 } from '@/styles/use-theme';
import { getExpenseIconName } from '@/utils/expense-icons';
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

interface TimelineLogCardProps {
  type: LogTypeId;
  date: string;
  description?: string;
  data?: RecordData;
  farmName?: string;
  showDate?: boolean;
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

// Generate secondary detail line
function getSecondaryDetail(
  type: LogTypeId,
  t: (key: string, options?: Record<string, unknown>) => string,
  data?: RecordData,
): string | null {
  if (!data) return null;

  switch (type) {
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      const area = irrigation.area;
      const moistureStatus = irrigation.moisture_status;
      const parts = [];
      if (area) parts.push(`${area} acres`);
      if (moistureStatus) parts.push(moistureStatus);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'spray': {
      const spray = data as SprayRecord;
      const area = spray.area;
      const weather = spray.weather;
      const parts = [];
      if (area) parts.push(`${area} acres`);
      if (weather) parts.push(weather);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      const buyer = harvest.buyer;
      const notes = harvest.notes;
      return buyer || notes || null;
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      return expense.remarks || null;
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      const area = fertigation.area;
      const waterVolume = fertigation.water_volume;
      const parts = [];
      if (area) parts.push(`${area} acres`);
      if (waterVolume) parts.push(`${waterVolume}L water`);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    default:
      return null;
  }
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export function TimelineLogCard({
  type,
  date,
  description,
  data,
  farmName,
  showDate = true,
  onPress,
  onEdit,
  onDelete,
}: TimelineLogCardProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const currency = useCurrency();
  const translateX = React.useMemo(() => new Animated.Value(0), []);
  const [isSwiped, setIsSwiped] = React.useState(false);

  const logType = getLogType(type);
  const iconName =
    type === 'expense'
      ? getExpenseIconName((data as ExpenseRecord | undefined)?.type, logType.icon)
      : logType.icon;
  const parsedDate = fromSupabaseDateString(date);
  const displayDescription = description || getDescriptionFromData(type, t, data, currency);
  const displayDate = parsedDate
    ? formatDate(parsedDate, { month: 'short', day: 'numeric' })
    : date;
  const secondaryDetail = getSecondaryDetail(type, t, data);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 5;
        },
        onPanResponderMove: (_, gestureState) => {
          const newX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, gestureState.dx));
          translateX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -SWIPE_THRESHOLD && onDelete) {
            // Swiped left - show delete
            Animated.spring(translateX, {
              toValue: -SWIPE_THRESHOLD,
              useNativeDriver: true,
              friction: 8,
            }).start();
            setIsSwiped(true);
          } else if (gestureState.dx > SWIPE_THRESHOLD && onEdit) {
            // Swiped right - show edit
            Animated.spring(translateX, {
              toValue: SWIPE_THRESHOLD,
              useNativeDriver: true,
              friction: 8,
            }).start();
            setIsSwiped(true);
          } else {
            // Reset
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }).start();
            setIsSwiped(false);
          }
        },
      }),
    [translateX, onEdit, onDelete],
  );

  const handlePress = useCallback(() => {
    if (isSwiped) {
      // Reset on press if swiped
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
      setIsSwiped(false);
    } else if (onPress) {
      onPress();
    }
  }, [isSwiped, onPress, translateX]);

  const cardStyle: ViewStyle = {
    backgroundColor: m3.surface.surfaceContainer,
    borderRadius: m3.shape.cornerLarge,
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.85),
    borderLeftWidth: 3,
    borderLeftColor: logType.color,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: 'hidden',
  };

  const contentContainerStyle: ViewStyle = {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  };

  const descriptionTextStyle: TextStyle = {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: m3.colorScheme.onSurface,
    flexShrink: 1,
  };

  const secondaryTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    color: m3.colorScheme.onSurfaceVariant,
    marginTop: spacing[1],
    lineHeight: 18,
  };

  const typePillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colorWithOpacity(logType.color, 0.16),
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    marginTop: spacing[2],
  };

  const typePillTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: logType.color,
    marginLeft: spacing[1],
  };

  return (
    <View style={{ position: 'relative' }}>
      {/* Background actions */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
        }}
      >
        {onEdit && (
          <Pressable
            onPress={() => {
              // Close swipe then call callback
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
              setIsSwiped(false);
              onEdit();
            }}
            style={{
              backgroundColor: m3.colorScheme.primary,
              borderRadius: m3.shape.cornerMedium,
              padding: spacing[2],
            }}
          >
            <UiSymbol name="pencil" size={20} color={m3.colorScheme.onPrimary} />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={() => {
              // Close swipe then call callback
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
              setIsSwiped(false);
              onDelete();
            }}
            style={{
              backgroundColor: m3.colorScheme.error,
              borderRadius: m3.shape.cornerMedium,
              padding: spacing[2],
            }}
          >
            <UiSymbol name="trash" size={20} color={m3.colorScheme.onError} />
          </Pressable>
        )}
      </View>

      {/* Swipeable card */}
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${displayDescription || t(logType.labelKey)}${farmName ? `, ${farmName}` : ''}. ${displayDate}.`}
          style={({ pressed }) => [
            cardStyle,
            {
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={contentContainerStyle}>
            {/* Top row: Description + Date */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: showDate ? 'space-between' : 'flex-start',
                alignItems: 'center',
              }}
            >
              <Text style={descriptionTextStyle} numberOfLines={1}>
                {displayDescription || t(logType.labelKey)}
              </Text>
              {showDate ? (
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6),
                    marginLeft: spacing[2],
                  }}
                >
                  {displayDate}
                </Text>
              ) : null}
            </View>

            {/* Secondary detail */}
            {secondaryDetail && (
              <Text style={secondaryTextStyle} numberOfLines={1}>
                {secondaryDetail}
              </Text>
            )}

            {/* Type pill */}
            <View style={typePillStyle}>
              <UiSymbol name={iconName} size={10} color={logType.color} />
              <Text style={typePillTextStyle}>{t(logType.labelKey)}</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
