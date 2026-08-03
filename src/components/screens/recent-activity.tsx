import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@/components/ui/app-icon';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { Spinner } from '@/components/ui/spinner';
import { useLogPresentation, type RecentActivity } from '@/hooks';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { relativeDayKey } from '@/utils/date';
import { formatDate } from '@/i18n/format';

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
          {activityList.map((activity) => {
            const p = presentation[activity.type];
            const dayKey = relativeDayKey(activity.date);
            const activityDate = dayKey
              ? t(`common.${dayKey}`)
              : formatDate(activity.date, { month: 'short', day: 'numeric' });
            // Amount/detail first, farm only when the farmer has more than one.
            const detail = [activity.description, showFarmName ? activity.farmName : null]
              .filter((part) => part)
              .join(' · ');

            return (
              <Pressable
                key={activity.id}
                onPress={() => onEditActivity(activity)}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}${detail ? `, ${detail}` : ''}, ${activityDate}, ${
                  activity.farmName
                    ? t('dashboard.recentActivity.openFarm', { name: activity.farmName })
                    : t('dashboard.recentActivity.openFarmDetails')
                }`}
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
          })}
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
