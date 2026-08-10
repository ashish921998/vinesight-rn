/**
 * TimelineLogCard Component
 * Displays a single activity log entry with timeline styling and swipe actions
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/i18n/format';
import { getDescriptionFromData } from '@/utils/log-description';
import { getDelegatedAttribution, getSecondaryDetail } from '@/utils/activity-details';
import { useCurrency } from '@/hooks/use-currency';
import { useM3 } from '@/styles/use-theme';
import { getExpenseIconName } from '@/utils/expense-icons';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
  DailyNoteRecord,
} from '../../types';

type RecordData =
  | IrrigationRecord
  | SprayRecord
  | HarvestRecord
  | ExpenseRecord
  | FertigationRecord
  | DailyNoteRecord;

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

export const TimelineLogCard = React.memo(function TimelineLogCard({
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
  const secondaryDetail = getSecondaryDetail(type, data);
  const delegatedAttribution = getDelegatedAttribution(t, data);

  const cardStyle: ViewStyle = {
    backgroundColor: m3.surface.surfaceContainer,
    // cornerMedium (16) keeps the left accent reading as a clean vertical spine.
    // At cornerLarge (24) the thick left border curls around the corners and
    // renders as a detached floating arc.
    borderRadius: m3.shape.cornerMedium,
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.85),
    borderLeftWidth: 4,
    borderLeftColor: logType.color,
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
    <SwipeableRow
      leadingAction={
        onEdit
          ? {
              label: t('common.edit', { defaultValue: 'Edit' }),
              icon: 'pencil',
              onPress: onEdit,
            }
          : undefined
      }
      trailingAction={
        onDelete
          ? {
              label: t('common.delete'),
              icon: 'trash',
              onPress: onDelete,
            }
          : undefined
      }
    >
      {({ isOpen, close }) => (
        <Pressable
          onPress={() => {
            if (isOpen) {
              close();
            } else {
              onPress?.();
            }
          }}
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
            {delegatedAttribution && (
              <Text style={secondaryTextStyle} numberOfLines={1}>
                {delegatedAttribution}
              </Text>
            )}

            {/* Type pill */}
            <View style={typePillStyle}>
              <UiSymbol name={iconName} size={10} color={logType.color} />
              <Text style={typePillTextStyle}>{t(logType.labelKey)}</Text>
            </View>
          </View>
        </Pressable>
      )}
    </SwipeableRow>
  );
});
