import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

export default function ProfessionalFarmer() {
  const { userId } = useLocalSearchParams<{ userId: string }>(); const router = useRouter(); const m3 = useM3();
  const { data } = useProfessionalWorkspace(); const farmer = data?.clients.find((c) => c.user_id === userId);
  if (!farmer) return <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}><Text style={{ color: m3.colorScheme.error }}>This farmer is no longer available. Refresh the directory.</Text></View>;
  return <View style={{ flex: 1, padding: spacing[4], backgroundColor: m3.colorScheme.background }}><Stack.Screen options={{ title: farmer.full_name }} />
    <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[5] }}>{farmer.phone ?? 'Farmer account'}</Text>
    <FlatList data={farmer.farms} keyExtractor={(f) => String(f.id)} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: '/professional/farm/[farmId]', params: { farmId: item.id, userId: farmer.user_id } })} style={{ padding: spacing[4], backgroundColor: m3.surface.surfaceContainer, borderRadius: borderRadius.xl, marginBottom: spacing[3] }}><Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: m3.colorScheme.onSurface }}>{item.name}</Text><Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>{item.crop} · {item.area} acres · {item.region}</Text></Pressable>} />
  </View>;
}
