import React, { useMemo } from 'react';
import { ScrollView, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { useFarm, useFertilizerPlan, useProfile, useFarms } from '@/hooks';
import { borderRadius, fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';

// Determine plan item status and color based on item index (placeholder logic)
// In a real implementation, this would come from the API or be calculated from dates
function getPlanItemStatus(index: number): 'completed' | 'upcoming' | 'overdue' {
  if (index === 0) return 'completed';
  if (index === 2) return 'overdue';
  return 'upcoming';
}

function getStatusBadgeColor(
  status: 'completed' | 'upcoming' | 'overdue',
  colors: ReturnType<typeof useThemeColors>,
) {
  switch (status) {
    case 'completed':
      return colors.primary[500];
    case 'upcoming':
      return colors.accent[500];
    case 'overdue':
      return colors.secondary[500];
  }
}

function getStripColor(
  status: 'completed' | 'upcoming' | 'overdue',
  colors: ReturnType<typeof useThemeColors>,
) {
  switch (status) {
    case 'completed':
      return colors.fertigation[500];
    case 'upcoming':
      return colors.accent[500];
    case 'overdue':
      return colors.secondary[500];
  }
}

export default function FertilizerPlansScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ farmId?: string }>();
  const farmId = useMemo(() => {
    if (!params.farmId) return undefined;
    const parsed = Number.parseInt(params.farmId, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [params.farmId]);
  const { data: profile } = useProfile({ enabled: true });
  const { data: farm } = useFarm(farmId);
  const { data: fertilizerPlan, isLoading } = useFertilizerPlan(farmId);
  const { data: farms } = useFarms();

  const canAccessPlans = Boolean(profile?.consultant_organization_id);

  // Get current farm name for the selector pill
  const currentFarmName = useMemo(() => {
    if (farm?.name) return farm.name;
    if (farms && farms.length > 0) return farms[0].name;
    return 'Select Farm';
  }, [farm?.name, farms]);

  return (
    <>
      <Stack.Screen options={{ title: t('farmDetails.fertilizerPlan.title') }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[4],
          paddingBottom: Math.max(insets.bottom + spacing[6], spacing[10]),
        }}
      >
        <View style={{ marginBottom: spacing[3] }}>
          <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.headlineSmall }}>
            {t('farmDetails.fertilizerPlan.title')}
          </Text>
          {/* Farm selector pill - Cellar Ledger design: card bg, border, primary text, dropdown arrow */}
          <Pressable
            style={{
              marginTop: spacing[2],
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[1],
              backgroundColor: colors.surface[100],
              borderWidth: 1,
              borderColor: colors.surface[300],
              borderRadius: borderRadius.pill,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1] + 2,
              alignSelf: 'flex-start',
            }}
          >
            <Text
              style={{
                color: colors.primary[500],
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
              }}
            >
              {currentFarmName}
            </Text>
            <Icon name="chevron.down" size={12} color={colors.surface[500]} />
          </Pressable>
        </View>

        {!canAccessPlans ? (
          <View
            style={{
              borderRadius: m3.shape.cornerLarge,
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              style={{
                color: m3.colorScheme.onSurface,
                ...m3.typography.titleMedium,
                fontWeight: fontWeight.semibold,
              }}
            >
              {t('farmDetails.fertilizerPlan.emptyTitle')}
            </Text>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginTop: spacing[1],
              }}
            >
              {t('farmDetails.fertilizerPlan.emptySubtitle')}
            </Text>
          </View>
        ) : isLoading ? (
          <View
            style={{
              padding: spacing[4],
              borderRadius: m3.shape.cornerLarge,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="small" color={m3.colorScheme.primary} />
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginTop: spacing[2],
              }}
            >
              {t('farmDetails.fertilizerPlan.loading')}
            </Text>
          </View>
        ) : !fertilizerPlan ? (
          <View
            style={{
              padding: spacing[4],
              borderRadius: m3.shape.cornerLarge,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              style={{
                color: m3.colorScheme.onSurface,
                ...m3.typography.titleMedium,
                fontWeight: fontWeight.semibold,
              }}
            >
              {t('farmDetails.fertilizerPlan.emptyTitle')}
            </Text>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginTop: spacing[1],
              }}
            >
              {t('farmDetails.fertilizerPlan.emptySubtitle')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing[3] }}>
            <View
              style={{
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[4],
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.bodyMedium,
                    fontWeight: fontWeight.semibold,
                    flex: 1,
                  }}
                >
                  {fertilizerPlan.consultant_name
                    ? t('farmDetails.fertilizerPlan.consultantLabel', {
                        name: fertilizerPlan.consultant_name,
                      })
                    : t('farmDetails.fertilizerPlan.consultantUnknown')}
                </Text>
                {fertilizerPlan.updated_at ? (
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                  >
                    {t('farmDetails.fertilizerPlan.updatedLabel', {
                      date: formatDate(new Date(fertilizerPlan.updated_at), {
                        month: 'short',
                        day: 'numeric',
                      }),
                    })}
                  </Text>
                ) : null}
              </View>
              {fertilizerPlan.notes ? (
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    ...m3.typography.bodyMedium,
                    marginTop: spacing[2],
                  }}
                >
                  {fertilizerPlan.notes}
                </Text>
              ) : null}
            </View>

            {fertilizerPlan.items.length > 0 ? (
              <View style={{ gap: spacing[3] }}>
                {/* Section label - uppercase, 12px, 600 weight */}
                <Text
                  style={{
                    fontSize: fontSize.xs + 1,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurfaceVariant,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginTop: spacing[1],
                  }}
                >
                  {t('farmDetails.fertilizerPlan.recommendedSchedule', 'Recommended Schedule')}
                </Text>
                {/* Plan cards with 5px left strip, status badges */}
                {fertilizerPlan.items.map((input, index) => {
                  const status = getPlanItemStatus(index);
                  const stripColor = getStripColor(status, colors);
                  const badgeColor = getStatusBadgeColor(status, colors);
                  return (
                    <View
                      key={`${input.name}-${index}`}
                      style={{
                        backgroundColor: colors.surface[100],
                        borderWidth: 1,
                        borderColor: colors.surface[300],
                        borderRadius: borderRadius.md, // 14px = md(16) - close enough
                        marginBottom: spacing[3],
                        flexDirection: 'row',
                        overflow: 'hidden',
                      }}
                    >
                      {/* 5px left strip with category color */}
                      <View
                        style={{
                          width: 5,
                          backgroundColor: stripColor,
                          flexShrink: 0,
                        }}
                      />
                      <View style={{ flex: 1, padding: spacing[3] + 2 }}>
                        {/* Top row: type + status badge */}
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: spacing[1],
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.surface[900],
                            }}
                          >
                            {input.name || t('farmDetails.fertilizerPlan.unknownInput')}
                          </Text>
                          {/* Status badge */}
                          <View
                            style={{
                              backgroundColor: badgeColor,
                              paddingHorizontal: spacing[2] + 2,
                              paddingVertical: 2,
                              borderRadius: borderRadius.sm + 4, // ~12px
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.semibold,
                                color:
                                  status === 'upcoming' ? colors.surface[900] : colors.surface[100],
                                textTransform: 'capitalize',
                              }}
                            >
                              {status}
                            </Text>
                          </View>
                        </View>
                        {/* Product info */}
                        {input.quantity !== null && input.quantity !== undefined && (
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.medium,
                              color: colors.surface[900],
                              marginBottom: spacing[1],
                            }}
                          >
                            {input.quantity}
                            {input.unit ? ` ${input.unit}` : ''}{' '}
                            {t('farmDetails.fertilizerPlan.perAcre', '/ acre')}
                          </Text>
                        )}
                        {/* Meta info - show week based on index */}
                        <View style={{ flexDirection: 'row', gap: spacing[4] }}>
                          <Text
                            style={{
                              fontSize: fontSize.xs,
                              color: colors.surface[500],
                            }}
                          >
                            {t('farmDetails.fertilizerPlan.week', 'Week')} {index + 1}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
                {t('farmDetails.fertilizerPlan.noInputs')}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      {/* FAB - Cellar Ledger design: primary bg, 16px radius, white '+', border-only */}
      <Pressable
        style={{
          position: 'absolute',
          bottom: 36, // 36px from bottom
          right: spacing[6], // 24px from right
          width: 52,
          height: 52,
          borderRadius: borderRadius.md, // 16px radius
          backgroundColor: colors.primary[500],
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colorWithOpacity(colors.primary[500], 0.3),
        }}
        accessibilityRole="button"
        accessibilityLabel={t('farmDetails.fertilizerPlan.addPlan', 'Add Plan')}
      >
        <Text
          style={{
            color: colors.surface[100],
            fontSize: 28,
            fontWeight: '300',
            lineHeight: 32,
          }}
        >
          +
        </Text>
      </Pressable>
    </>
  );
}
