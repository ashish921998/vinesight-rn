import React, { useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { useFarm, useFertilizerPlans, useProfile, useFarms } from '@/hooks';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import {
  PlanSchedule,
  PreviousPlanCard,
  SectionLabel,
  planTitle,
} from '@/components/screens/fertilizer-plan-card';

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
  const { data: profile, isLoading: isProfileLoading } = useProfile({ enabled: true });
  const { data: farm } = useFarm(farmId);
  const { data: fertilizerPlans, isLoading } = useFertilizerPlans(farmId);
  const { data: farms, isLoading: isFarmsLoading } = useFarms();

  // Two paths to this screen: a consultant (has consultant_organization_id)
  // reviewing a client's farm, or the farm owner viewing plans sent to them.
  // The owner check (`farms`) is the normal farmer path — without it, farmers
  // are locked out of plans they received.
  const canAccessPlans =
    Boolean(profile?.consultant_organization_id) ||
    Boolean(farmId && farms?.some((f) => f.id === farmId));
  // Defer the access decision until profile/farms resolve, otherwise the denial
  // state flashes before we actually know the user's access.
  const accessResolved = !isProfileLoading && !isFarmsLoading;

  const plans = fertilizerPlans ?? [];
  const currentPlan = plans[0];
  const previousPlans = plans.slice(1);

  // Older plans collapse by default; track which ones the user has expanded.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const togglePlan = useCallback((planId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }, []);

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

        {!accessResolved ? (
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
          </View>
        ) : !canAccessPlans ? (
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
        ) : !currentPlan ? (
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
            {/* Current plan - always expanded */}
            <SectionLabel color={m3.primary.p500}>
              {t('farmDetails.fertilizerPlan.currentLabel', 'Current')}
            </SectionLabel>
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
                  {planTitle(currentPlan, t)}
                </Text>
                {currentPlan.updated_at ? (
                  <Text
                    style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
                  >
                    {t('farmDetails.fertilizerPlan.updatedLabel', {
                      date: formatDate(new Date(currentPlan.updated_at), {
                        month: 'short',
                        day: 'numeric',
                      }),
                    })}
                  </Text>
                ) : null}
              </View>
              {currentPlan.notes ? (
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    ...m3.typography.bodyMedium,
                    marginTop: spacing[2],
                  }}
                >
                  {currentPlan.notes}
                </Text>
              ) : null}
            </View>
            <PlanSchedule plan={currentPlan} m3={m3} t={t} />

            {/* Previous plans - collapsible history */}
            {previousPlans.length > 0 ? (
              <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
                <SectionLabel color={m3.colorScheme.onSurfaceVariant}>
                  {t('farmDetails.fertilizerPlan.previousPlans', 'Previous plans')}
                </SectionLabel>
                {previousPlans.map((plan) => (
                  <PreviousPlanCard
                    key={plan.id}
                    plan={plan}
                    m3={m3}
                    t={t}
                    expanded={expandedIds.has(plan.id)}
                    onToggle={() => togglePlan(plan.id)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </>
  );
}
