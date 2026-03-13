import React, { useMemo } from 'react';
import { ScrollView, View, Text, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFarm, useFertilizerPlan, useProfile } from '@/hooks';
import { borderRadius, fontWeight, spacing } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import { formatDate } from '@/i18n/format';

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

  const canAccessPlans = Boolean(profile?.consultant_organization_id);

  const formatFertilizerInput = (input: FertilizerPlanItem) => {
    const name = input.name?.trim() || t('farmDetails.fertilizerPlan.unknownInput');
    const quantity =
      typeof input.quantity === 'number' && Number.isFinite(input.quantity) ? input.quantity : null;
    if (quantity === null) return name;
    const unit = input.unit?.trim() ?? '';
    const suffix = unit ? ` ${unit}` : '';
    return `${name} • ${quantity}${suffix}`;
  };

  const subtitle = useMemo(() => {
    if (farm?.name) return `${t('farmDetails.fertilizerPlan.subtitle')} (${farm.name})`;
    return t('farmDetails.fertilizerPlan.subtitle');
  }, [farm?.name, t]);

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
        <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.headlineSmall }}>
          {t('farmDetails.fertilizerPlan.title')}
        </Text>
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            ...m3.typography.bodyMedium,
            marginTop: spacing[1],
            marginBottom: spacing[4],
          }}
        >
          {subtitle}
        </Text>

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
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing[2],
                }}
              >
                {fertilizerPlan.items.map((input, index) => (
                  <View
                    key={`${input.name}-${index}`}
                    style={{
                      paddingHorizontal: spacing[2],
                      paddingVertical: 6,
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.08),
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    }}
                  >
                    <Text style={{ color: m3.colorScheme.onSurface, ...m3.typography.labelSmall }}>
                      {formatFertilizerInput(input)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, ...m3.typography.bodyMedium }}>
                {t('farmDetails.fertilizerPlan.noInputs')}
              </Text>
            )}
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.full,
                alignSelf: 'flex-start',
                backgroundColor: colorWithOpacity(colors.fertigation[500], 0.14),
              }}
            >
              <Text style={{ color: colors.fertigation[500], fontWeight: fontWeight.semibold }}>
                {t('farmDetails.fertilizerPlan.upcomingCount', {
                  count: fertilizerPlan.items.length,
                })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}
