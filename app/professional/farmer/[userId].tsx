import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';
import { formatNumber } from '@/i18n/format';

export default function ProfessionalFarmer() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const m3 = useM3();
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useProfessionalWorkspace();

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }
  if (isError) {
    return (
      <Pressable onPress={() => void refetch()} style={{ padding: spacing[4] }}>
        <Text style={{ color: m3.colorScheme.error }}>{t('professional.errors.farmer')}</Text>
      </Pressable>
    );
  }

  const farmer = data?.clients.find((client) => client.user_id === userId);
  if (!farmer) {
    return (
      <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}>
        <Text style={{ color: m3.colorScheme.error }}>{t('professional.unavailableFarmer')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen options={{ title: farmer.full_name }} />
      <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[5] }}>
        {farmer.phone ?? t('professional.farmerAccount')}
      </Text>
      <FlatList
        data={farmer.farms}
        keyExtractor={(farm) => String(farm.id)}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.crop}, ${formatNumber(item.area)} acres`}
            onPress={() =>
              router.push({
                pathname: '/professional/farm/[farmId]',
                params: { farmId: item.id, userId: farmer.user_id },
              })
            }
            style={{
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainer,
              borderRadius: borderRadius.xl,
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
              {item.name}
            </Text>
            <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
              {item.crop} · {t('farmDetails.header.areaAcres', { value: formatNumber(item.area) })}{' '}
              · {item.region}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
