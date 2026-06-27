import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { useFarm, useFertilizerPlan, useProfile, useFarms } from '@/hooks';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';

export default function FertilizerPlansScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
    // Fall back to finding farm by farmId in the farms list
    if (farmId && farms && farms.length > 0) {
      const matchingFarm = farms.find((f) => f.id === farmId);
      if (matchingFarm) return matchingFarm.name;
    }
    return t('farmDetails.fertilizerPlan.selectFarm', 'Select Farm');
  }, [farm?.name, farmId, farms, t]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {t('farmDetails.fertilizerPlan.title')}
            </Text>
          </View>

          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>
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
          {/* Farm selector pill - display only (no farm switching mechanism available) */}
          <View
            style={{
              marginTop: spacing[2],
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[1],
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: m3.surface.s300,
              borderRadius: borderRadius.pill,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1] + 2,
              alignSelf: 'flex-start',
            }}
          >
            <Text
              style={{
                color: m3.primary.p500,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
              }}
            >
              {currentFarmName}
            </Text>
          </View>
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
              {fertilizerPlan.title ? (
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.titleMedium,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[2],
                  }}
                >
                  {fertilizerPlan.title}
                </Text>
              ) : null}
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
                  return (
                    <View
                      key={`${input.name}-${index}`}
                      style={{
                        backgroundColor: m3.surface.s100,
                        borderWidth: 1,
                        borderColor: m3.surface.s300,
                        borderRadius: borderRadius.md, // 14px = md(16) - close enough
                        marginBottom: spacing[3],
                        flexDirection: 'row',
                        overflow: 'hidden',
                      }}
                    >
                      {/* 5px left strip */}
                      <View
                        style={{
                          width: 5,
                          backgroundColor: m3.primary.p500,
                          flexShrink: 0,
                        }}
                      />
                      <View style={{ flex: 1, padding: spacing[3] + 2 }}>
                        {/* Top row: item name */}
                        <View
                          style={{
                            marginBottom: spacing[1],
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: m3.surface.s900,
                            }}
                          >
                            {input.name || t('farmDetails.fertilizerPlan.unknownInput')}
                          </Text>
                        </View>
                        {/* Product info */}
                        {input.quantity !== null && input.quantity !== undefined && (
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.medium,
                              color: m3.surface.s900,
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
                              color: m3.surface.s500,
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
    </>
  );
}
