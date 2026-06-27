import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReceiptLogScreen } from '@/components/screens/receipt-log-screen';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import type { DelegatedContext } from '@/services/delegated-logs';
import type { Farm } from '@/types';

export default function AddDelegatedLog() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const m3 = useM3();
  const workspaceQuery = useProfessionalWorkspace();
  const { data: workspace } = workspaceQuery;
  const farmer = workspace?.clients.find((c) => c.user_id === userId);
  const farm = farmer?.farms.find((f) => f.id === Number(farmId));

  const stackScreen = <Stack.Screen options={{ headerShown: false }} />;

  if (workspaceQuery.isLoading) {
    return (
      <>
        {stackScreen}
        <ActivityIndicator style={{ flex: 1 }} />
      </>
    );
  }
  if (workspaceQuery.isError) {
    return (
      <>
        {stackScreen}
        <View style={{ flex: 1, padding: spacing[4] }}>
          <Pressable onPress={() => void workspaceQuery.refetch()}>
            <Text style={{ color: m3.colorScheme.error }}>
              {t('professional.errors.workspace')}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }
  if (!workspace || !farmer || !farm) {
    return (
      <>
        {stackScreen}
        <View style={{ flex: 1, padding: spacing[4] }}>
          <Text>{t('professional.unavailableFarm')}</Text>
        </View>
      </>
    );
  }

  // The professional workspace exposes a subset of Farm fields (enough for the
  // shared screen: identity, area, crop). Coerce into the full Farm shape;
  // missing server-owned fields default to ''.
  const farmLike: Farm = {
    id: farm.id,
    name: farm.name,
    region: farm.region,
    area: farm.area,
    crop: farm.crop,
    crop_variety: farm.crop_variety,
    planting_date: '',
  };

  const delegatedContext: DelegatedContext = {
    organizationId: workspace.organization_id,
    organizationName: workspace.organization_name,
    clientUserId: farmer.user_id,
    clientName: farmer.full_name,
    farm: farmLike,
  };

  return (
    <>
      {stackScreen}
      <ReceiptLogScreen
        onClose={() => router.back()}
        farmId={farmLike.id}
        delegatedContext={delegatedContext}
      />
    </>
  );
}
