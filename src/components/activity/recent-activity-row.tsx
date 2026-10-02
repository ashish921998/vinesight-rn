import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/ui/app-icon';
import type { RecentActivity } from '@/hooks';
import type { LogPresentation } from '@/hooks/use-log-presentation';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { relativeDayKey } from '@/utils/date';
import { formatDate } from '@/i18n/format';

export type ActivityRowModel = Pick<
  RecentActivity,
  'id' | 'type' | 'date' | 'description' | 'farmName'
> & {
  secondaryDetail?: string;
};

interface RecentActivityRowProps {
  activity: ActivityRowModel;
  /** Only true with 2+ farms — with one farm the header already names it. */
  showFarmName: boolean;
  presentation: Record<RecentActivity['type'], LogPresentation>;
  onPress: (activity: ActivityRowModel) => void;
  /** Long-press handler — typically opens a delete confirmation. */
  onLongPress?: (activity: ActivityRowModel) => void;
}

export const RecentActivityRow = React.memo(function RecentActivityRow({
  activity,
  showFarmName,
  presentation,
  onPress,
  onLongPress,
}: RecentActivityRowProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const p = presentation[activity.type];
  const dayKey = relativeDayKey(activity.date);
  const activityDate = dayKey
    ? t(`common.${dayKey}`)
    : formatDate(activity.date, { month: 'short', day: 'numeric' });
  const detail = [
    activity.description,
    activity.secondaryDetail,
    showFarmName ? activity.farmName : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(activity)}
      onLongPress={onLongPress ? () => onLongPress(activity) : undefined}
      onAccessibilityAction={
        onLongPress
          ? (event) => {
              if (event.nativeEvent.actionName === 'delete') onLongPress(activity);
            }
          : undefined
      }
      accessibilityActions={
        onLongPress
          ? [
              {
                name: 'delete',
                label: t('dashboard.a11y.deleteActivity', { type: p.label }),
              },
            ]
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.recentActivity.editActivity', {
        label: `${p.label}${detail ? `, ${detail}` : ''}, ${activityDate}`,
      })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        borderRadius: borderRadius.md,
        backgroundColor: pressed ? m3.surface.s200 : m3.surface.s100,
        borderWidth: 1,
        borderColor: m3.surface.s200,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          backgroundColor: colorWithOpacity(p.color, 0.12),
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AppIcon name={p.icon} size={20} color={p.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s900,
            }}
          >
            {p.label}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontSize: fontSize.xs,
              color: m3.surface.s500,
              flexShrink: 0,
            }}
          >
            {activityDate}
          </Text>
        </View>
        {detail ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 1,
              fontSize: fontSize.sm,
              color: m3.surface.s500,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
