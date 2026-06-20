import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

export default function ProfessionalFarm() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>(); const router = useRouter(); const m3 = useM3();
  const { data } = useProfessionalWorkspace(); const farmer = data?.clients.find((c) => c.user_id === userId); const farm = farmer?.farms.find((f) => f.id === Number(farmId));
  if (!farm || !farmer) return <View style={{ flex: 1, padding: spacing[4] }}><Text>Farm access is no longer available.</Text></View>;
  return <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}><Stack.Screen options={{ title: farm.name }} />
    <View style={{ padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer }}><Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: m3.colorScheme.onSurface }}>{farm.name}</Text><Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[2] }}>{farmer.full_name} · {farm.crop} · {farm.area} acres</Text></View>
    <Pressable onPress={() => router.push({ pathname: '/professional/log/add', params: { farmId, userId } })} style={{ marginTop: spacing[5], padding: spacing[4], borderRadius: borderRadius.xl, alignItems: 'center', backgroundColor: m3.colorScheme.primary }}><Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.bold }}>Add log</Text></Pressable>
    <Text style={{ marginTop: spacing[6], fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: m3.colorScheme.onSurface }}>Activity</Text><Text style={{ marginTop: spacing[2], color: m3.colorScheme.onSurfaceVariant }}>Delegated activity appears here through the normal farm refresh after the shared read policies are deployed.</Text>
  </View>;
}
