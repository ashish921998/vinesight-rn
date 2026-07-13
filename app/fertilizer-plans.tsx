import React, { useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import {
  useFarm,
  useFertilizerPlans,
  useConsultantLink,
  useFarms,
  useFarmAreaAcres,
} from '@/hooks';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import {
  PlanSchedule,
  PreviousPlanCard,
  SectionLabel,
  PlanByline,
} from '@/components/screens/fertilizer-plan-card';
import { resolveFertigationPrefill } from '@/constants/fertilizer-units';
import { useModalStore } from '@/stores';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';

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
  const { isLinked: hasConsultantLink, isLoading: isProfileLoading } = useConsultantLink();
  const { data: farm } = useFarm(farmId);
  // Fallback area in canonical acres for plans whose `farm_area_acres`
  // snapshot is null (created before the snapshot column existed). Per
  // the FertilizerPlan type, null snapshots fall back to current farm area.
  // Uses the shared hook so resolution (incl. the useAuthStore fallback on a
  // cold profile) stays consistent with the other screens.
  const { farmAreaAcres: currentFarmAreaAcres } = useFarmAreaAcres(farm?.area);
  const { data: fertilizerPlans, isLoading } = useFertilizerPlans(farmId);
  const { data: farms, isLoading: isFarmsLoading } = useFarms();
  const { setAddEntry } = useModalStore();

  // Two paths to this screen: a consultant (has consultant_organization_id)
  // reviewing a client's farm, or the farm owner viewing plans sent to them.
  // The owner check (`farms`) is the normal farmer path — without it, farmers
  // are locked out of plans they received.
  const hasConsultantAccess = !isProfileLoading && hasConsultantLink;
  const hasFarmAccess = !isFarmsLoading && Boolean(farmId && farms?.some((f) => f.id === farmId));
  const canAccessPlans = hasConsultantLink || hasFarmAccess;
  // Grant access as soon as EITHER side proves it (so a consultant isn't blocked
  // on `farms` loading, and a farmer isn't blocked on `profile`). Only defer the
  // denial state until both queries have resolved, so it never flashes early.
  const accessResolved =
    hasConsultantAccess || hasFarmAccess || (!isProfileLoading && !isFarmsLoading);

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

  /**
   * One-tap "Log this" handler: converts the plan item's canonical prescription
   * into the fertigation form's natural chip via the kernel (issue #197).
   * ppm items are excluded at the ScheduleItemCard level — this callback is
   * only wired to non-ppm items. The planItemId rides along so the submitted
   * record links back to the prescription.
   */
  const handleLogPlanItem = useCallback(
    (item: FertilizerPlanItem) => {
      // Plan doses are per-acre by contract; resolveFertigationPrefill converts
      // the stored unit string into the form's vocabulary while preserving per_acre.
      // Unknown/verbatim units (e.g. 'banana/acre') pass through unchanged.
      const prefill = resolveFertigationPrefill(item.unit);
      setAddEntry({
        initialLogType: 'fertigation',
        initialFarmId: farmId ?? null,
        logPrefill: {
          fertigationItems: [
            {
              name: item.name,
              quantity: item.quantity ?? null,
              unit: prefill.unit,
              quantityBasis: prefill.quantityBasis,
              planItemId: item.id,
            },
          ],
        },
      });
      router.push({
        pathname: '/add-entry',
        params: {
          tabs: 'log',
          initialTab: 'log',
          farmId: farmId !== undefined ? String(farmId) : undefined,
          initialLogType: 'fertigation',
          lockFarmSelection: 'true',
        },
      });
    },
    [farmId, router, setAddEntry],
  );

  // Farm name shown as the header subtitle (null hides the subtitle line).
  const currentFarmName = useMemo(() => {
    if (farm?.name) return farm.name;
    // Fall back to finding farm by farmId in the farms list
    if (farmId && farms && farms.length > 0) {
      const matchingFarm = farms.find((f) => f.id === farmId);
      if (matchingFarm) return matchingFarm.name;
    }
    return null;
  }, [farm?.name, farmId, farms]);

  // Org initials for the plan-header avatar (e.g. "Acme Agro" → "AA").
  // Cheap enough to derive on every render; memoizing a value derived from the
  // plans array trips react-hooks/preserve-manual-memoization.
  const consultantName = currentPlan?.consultant_name?.trim() || null;
  const consultantInitials = consultantName
    ? consultantName
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('')
    : null;

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
            {currentFarmName ? (
              <Text
                numberOfLines={1}
                style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.labelSmall }}
              >
                {currentFarmName}
              </Text>
            ) : null}
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
              padding: spacing[6],
              borderRadius: m3.shape.cornerLarge,
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: borderRadius.full,
                backgroundColor: m3.colorScheme.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[3],
              }}
            >
              <Symbol name="leaf.fill" size={26} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={{
                color: m3.colorScheme.onSurface,
                ...m3.typography.titleMedium,
                fontWeight: fontWeight.semibold,
                textAlign: 'center',
              }}
            >
              {t('farmDetails.fertilizerPlan.emptyTitle')}
            </Text>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginTop: spacing[1],
                textAlign: 'center',
              }}
            >
              {t('farmDetails.fertilizerPlan.emptySubtitle')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing[3] }}>
            {/* Consultant identity header: who this plan is from, before what it says. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: borderRadius.full,
                  backgroundColor: m3.colorScheme.primaryContainer,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {consultantInitials ? (
                  <Text
                    style={{
                      color: m3.colorScheme.primary,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {consultantInitials}
                  </Text>
                ) : (
                  <Symbol name="building.2.fill" size={20} color={m3.colorScheme.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.titleMedium,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {currentPlan.consultant_name
                    ? t('farmDetails.fertilizerPlan.consultantLabel', {
                        name: currentPlan.consultant_name,
                      })
                    : t('farmDetails.fertilizerPlan.consultantUnknown')}
                </Text>
                <PlanByline plan={currentPlan} m3={m3} t={t} />
              </View>
            </View>

            {currentPlan.notes ? (
              <View
                style={{
                  borderRadius: m3.shape.cornerLarge,
                  padding: spacing[4],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <SectionLabel color={m3.colorScheme.onSurfaceVariant}>
                  {t('farmDetails.fertilizerPlan.noteFromConsultant', 'Note from your consultant')}
                </SectionLabel>
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    ...m3.typography.bodyMedium,
                    marginTop: spacing[2],
                  }}
                >
                  {currentPlan.notes}
                </Text>
              </View>
            ) : null}

            {/* One-tap logging is the farm owner's action: consultant-only
                reviewers (plan link, no farm ownership) must not enter the
                add-entry flow for a farm that isn't theirs. */}
            <PlanSchedule
              plan={currentPlan}
              m3={m3}
              t={t}
              areaAcres={currentPlan.farm_area_acres ?? currentFarmAreaAcres}
              onLogItem={hasFarmAccess ? handleLogPlanItem : undefined}
            />

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
                    areaAcres={plan.farm_area_acres ?? currentFarmAreaAcres}
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
