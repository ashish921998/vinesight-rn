import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/spinner';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useProfessionalFarmActivity } from '@/hooks/use-professional-farm-activity';
import { TimelineLogCard } from '@/components/cards/timeline-log-card';
import { CropIcon } from '@/components/ui/crop-icon';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { StackBackButton } from '@/components/ui';
import { getCropVisual } from '@/utils/farm-crop-visuals';
import { getLogType } from '@/constants';
import { computeEarliestSafeHarvest, type PhiRecord } from '@/services/phi-service';
import { fromSupabaseDateString } from '@/types';
import type { CropType } from '@/constants/crop-varieties';
import type { HarvestRecord, SprayRecord } from '@/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate, formatNumber } from '@/i18n/format';

const SAFE_HARVEST_COLOR = '#0b8d32';

function ActivityItemSeparator() {
  return <View style={{ height: spacing[3] }} />;
}

interface StatusChip {
  key: string;
  icon: string;
  label: string;
  color: string;
}

export default function ProfessionalFarm() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>();
  const router = useRouter();
  const m3 = useM3();
  const { t } = useTranslation();
  const workspace = useProfessionalWorkspace();
  const numericFarmId = Number(farmId);
  const farmer = workspace.data?.clients.find((client) => client.user_id === userId);
  const farm = farmer?.farms.find((candidate) => candidate.id === numericFarmId);
  const activity = useProfessionalFarmActivity({
    organizationId: workspace.data?.organization_id,
    clientUserId: farmer?.user_id,
    farmId: Number.isFinite(numericFarmId) && numericFarmId > 0 ? numericFarmId : undefined,
  });

  const activityItems = useMemo(() => activity.data ?? [], [activity.data]);

  // Agronomic metrics derived entirely from the activity feed we already fetch.
  // No backend change: each value is a direct aggregate of fields on the logs.
  const metrics = useMemo(() => {
    let harvestKg = 0;
    const sprayPhi: PhiRecord[] = [];

    for (const item of activityItems) {
      const record = item.record_data;
      if (item.record_type === 'harvest') {
        harvestKg += (record as HarvestRecord).quantity ?? 0;
      } else if (item.record_type === 'spray') {
        const spray = record as SprayRecord;
        sprayPhi.push({
          safe_harvest_date: spray.safe_harvest_date,
          phi_blocking_component: spray.phi_blocking_component,
          chemical: spray.chemical,
          date: spray.date,
        });
      }
    }

    return {
      harvestKg,
      safeHarvest: computeEarliestSafeHarvest(sprayPhi),
    };
  }, [activityItems]);

  const shortDate = (value: string | null): string | null => {
    if (!value) return null;
    const parsed = fromSupabaseDateString(value);
    return parsed ? formatDate(parsed, { month: 'short', day: 'numeric' }) : value;
  };

  // Condensed status chips — slim, so the logs stay the focus of the screen.
  const statusChips = useMemo<StatusChip[]>(() => {
    const result: StatusChip[] = [];

    const safeDate = shortDate(metrics.safeHarvest.earliestDate);
    if (safeDate) {
      result.push({
        key: 'safe',
        icon: 'checkmark.circle.fill',
        color: SAFE_HARVEST_COLOR,
        label: t('professional.metrics.safeToHarvest', { date: safeDate }),
      });
    }
    if (metrics.harvestKg > 0) {
      result.push({
        key: 'harvest',
        icon: 'basket.fill',
        color: getLogType('harvest').color,
        label: t('professional.metrics.harvested', {
          value: formatNumber(metrics.harvestKg, { maximumFractionDigits: 1 }),
        }),
      });
    }
    return result;
  }, [metrics, t]);

  if (workspace.isLoading) return <Spinner style={{ flex: 1 }} />;
  if (workspace.isError) {
    return (
      <Pressable onPress={() => void workspace.refetch()} style={{ padding: spacing[4] }}>
        <Text style={{ color: m3.colorScheme.error }}>{t('professional.errors.farm')}</Text>
      </Pressable>
    );
  }
  if (!farm || !farmer) {
    return (
      <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}>
        <Text style={{ color: m3.colorScheme.error }}>{t('professional.unavailableFarm')}</Text>
      </View>
    );
  }

  const cropVisual = getCropVisual(farm.crop as CropType);
  const varietyLabel = farm.crop_variety || farm.crop;
  // Farm name + variety now live in the nav header (reclaims vertical space),
  // so the body opens with just a slim context line: region · area.
  const metaLine = [
    farm.region,
    t('farmDetails.header.areaAcres', { value: formatNumber(farm.area) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const header = (
    <View>
      {/* Slim context line — identity (name + variety) is in the nav header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        {'iconName' in cropVisual && cropVisual.iconName ? (
          <CropIcon name={cropVisual.iconName} size={18} />
        ) : (
          <UiSymbol
            name={cropVisual.symbolName}
            size={16}
            color={m3.colorScheme.onSurfaceVariant}
          />
        )}
        {metaLine ? (
          <Text
            style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}
            numberOfLines={1}
          >
            {metaLine}
          </Text>
        ) : null}
      </View>

      {/* Condensed status chips */}
      {statusChips.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing[2],
            marginTop: spacing[3],
          }}
        >
          {statusChips.map((chip) => (
            <View
              key={chip.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                paddingVertical: 4,
                paddingHorizontal: spacing[2],
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(chip.color, 0.12),
              }}
            >
              <UiSymbol name={chip.icon} size={13} color={chip.color} />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: chip.color,
                }}
              >
                {chip.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Lab reports entry */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('professional.reports.labReports')}
        onPress={() =>
          router.push({
            pathname: '/professional/farm/[farmId]/lab-reports',
            params: { farmId, userId },
          })
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing[5],
          padding: spacing[4],
          borderRadius: borderRadius.lg,
          backgroundColor: m3.colorScheme.surface,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UiSymbol name="flask" size={18} color={m3.colorScheme.primary} />
          </View>
          <View>
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
              }}
            >
              {t('professional.reports.labReports')}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
              {t('professional.reports.labReportsSubtitle')}
            </Text>
          </View>
        </View>
        <UiSymbol name="chevron.right" size={18} color={m3.colorScheme.onSurfaceVariant} />
      </Pressable>

      {/* Pending reviews */}
      {/* Recent-activity header + add action */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing[5],
          marginBottom: spacing[3],
        }}
      >
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {t('professional.recentActivity')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('professional.addLog')}
          onPress={() =>
            router.push({ pathname: '/professional/log/add', params: { farmId, userId } })
          }
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[1],
            paddingVertical: spacing[2],
            paddingHorizontal: spacing[3],
            borderRadius: borderRadius.full,
            backgroundColor: m3.colorScheme.primary,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <UiSymbol name="plus" size={16} color={m3.colorScheme.onPrimary} />
          <Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold }}>
            {t('professional.addLog')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen
        options={{
          // Explicit back control: after a deep reload / replace the native
          // stack has no history, so the default back button won't render.
          // Fall back to the farmer screen in that case.
          headerLeft: () => (
            <StackBackButton
              fallback={{
                pathname: '/professional/farmer/[userId]',
                params: { userId },
              }}
            />
          ),
          // Header carries identity (farm name + variety) so the body can lead
          // with the logs; the farmer's name is one tap back in the stack.
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                  maxWidth: 220,
                }}
              >
                {farm.name}
              </Text>
              {varietyLabel ? (
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.onSurfaceVariant,
                    maxWidth: 220,
                  }}
                >
                  {varietyLabel}
                </Text>
              ) : null}
            </View>
          ),
        }}
      />
      {activity.isError ? (
        <View style={{ flex: 1, padding: spacing[4] }}>
          {header}
          <Pressable onPress={() => void activity.refetch()} accessibilityRole="button">
            <Text style={{ color: m3.colorScheme.error }}>{t('professional.errors.activity')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={activityItems}
          keyExtractor={(item) => `${item.record_type}-${item.record_data.id}`}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
          ListHeaderComponent={header}
          ItemSeparatorComponent={ActivityItemSeparator}
          ListFooterComponent={null}
          ListEmptyComponent={
            activity.isLoading ? (
              <Spinner style={{ marginTop: spacing[4] }} />
            ) : (
              <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
                {t('professional.emptyActivity')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <TimelineLogCard
              type={item.record_type}
              date={item.record_data.date}
              data={item.record_data}
            />
          )}
        />
      )}
    </View>
  );
}
