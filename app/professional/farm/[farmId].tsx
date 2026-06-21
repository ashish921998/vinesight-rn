import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useProfessionalFarmActivity } from '@/hooks/use-professional-farm-activity';
import { TimelineLogCard } from '@/components/cards/timeline-log-card';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { formatNumber } from '@/i18n/format';

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
    farmId: Number.isFinite(numericFarmId) ? numericFarmId : undefined,
  });

  if (workspace.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
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

  return (
    <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen options={{ title: farm.name }} />
      <View
        style={{
          padding: spacing[4],
          borderRadius: borderRadius.xl,
          backgroundColor: m3.surface.surfaceContainer,
        }}
      >
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {farm.name}
        </Text>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[2] }}>
          {farmer.full_name} · {farm.crop} ·{' '}
          {t('farmDetails.header.areaAcres', { value: formatNumber(farm.area) })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('professional.addLog')}
        onPress={() =>
          router.push({ pathname: '/professional/log/add', params: { farmId, userId } })
        }
        style={{
          marginTop: spacing[5],
          padding: spacing[4],
          borderRadius: borderRadius.xl,
          alignItems: 'center',
          backgroundColor: m3.colorScheme.primary,
        }}
      >
        <Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.bold }}>
          {t('professional.addLog')}
        </Text>
      </Pressable>
      <Text
        style={{
          marginTop: spacing[6],
          marginBottom: spacing[2],
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onSurface,
        }}
      >
        {t('professional.activity')}
      </Text>
      {activity.isLoading ? (
        <ActivityIndicator />
      ) : activity.isError ? (
        <Pressable onPress={() => void activity.refetch()} accessibilityRole="button">
          <Text style={{ color: m3.colorScheme.error }}>{t('professional.errors.activity')}</Text>
        </Pressable>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={activity.data ?? []}
          keyExtractor={(item) => `${item.record_type}-${item.record_data.id}`}
          ListEmptyComponent={
            <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('professional.emptyActivity')}
            </Text>
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
