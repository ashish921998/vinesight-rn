import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { useLogPresentation, type RecentActivity } from '@/hooks';
import {
  RecentActivityRow,
  type ActivityRowModel,
} from '@/components/activity/recent-activity-row';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';

interface RecentActivityListProps {
  activities: RecentActivity[] | undefined;
  isLoading: boolean;
  hasFarms: boolean;
  /** Only true with 2+ farms — with one farm the header already names it. */
  showFarmName: boolean;
  onEditActivity: (activity: RecentActivity) => void;
  onViewAll: () => void;
}

// Compact recent-activity timeline for the home screen. Derives every log
// type's icon + color + label from the single useLogPresentation map (from the
// canonical LOG_TYPES model), so it stays in sync with the quick-action grid.
// The log TYPE is the row title — a bare "4h" or a chemical name tells a farmer
// nothing on its own — with the amount/detail as the supporting line.
export function RecentActivityList({
  activities,
  isLoading,
  hasFarms,
  showFarmName,
  onEditActivity,
  onViewAll,
}: RecentActivityListProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const presentation = useLogPresentation();
  const activityList = activities && activities.length > 0 ? activities : null;

  const handleRowPress = React.useCallback(
    (row: ActivityRowModel) => {
      const activity = activities?.find((item) => item.id === row.id);
      if (activity) onEditActivity(activity);
    },
    [activities, onEditActivity],
  );

  return (
    <View style={{ marginBottom: spacing[6] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[2],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: m3.surface.s900,
          }}
        >
          {t('dashboard.recentActivity.title')}
        </Text>
        {activityList ? (
          <Pressable
            onPress={onViewAll}
            accessibilityRole="button"
            accessibilityLabel={t('simplifiedHome.viewAll')}
            hitSlop={8}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.primary,
              }}
            >
              {t('simplifiedHome.viewAll')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View
          style={{
            borderRadius: borderRadius.md,
            padding: spacing[8],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: m3.surface.s300,
          }}
        >
          <Spinner color={m3.colorScheme.primary} />
        </View>
      ) : activityList ? (
        <View style={{ gap: spacing[1] }}>
          {activityList.map((activity) => (
            <RecentActivityRow
              key={activity.id}
              activity={activity}
              showFarmName={showFarmName}
              presentation={presentation}
              onPress={handleRowPress}
            />
          ))}
        </View>
      ) : (
        <View
          style={{
            borderRadius: borderRadius.md,
            padding: spacing[6],
            alignItems: 'center',
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: m3.surface.s300,
          }}
        >
          <SymbolIcon name="clock" size={48} color={m3.surface.s400} />
          <Text
            style={{
              textAlign: 'center',
              marginTop: spacing[3],
              fontSize: fontSize.sm,
              color: m3.surface.s500,
            }}
          >
            {hasFarms ? t('dashboard.empty.recentActivity') : t('dashboard.empty.noFarms')}
          </Text>
        </View>
      )}
    </View>
  );
}
