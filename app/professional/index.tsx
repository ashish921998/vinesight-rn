import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

export default function ProfessionalDirectory() {
  const router = useRouter(); const m3 = useM3(); const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch, isRefetching } = useProfessionalWorkspace();
  const clients = useMemo(() => (data?.clients ?? []).filter((c) => c.full_name.toLowerCase().includes(search.trim().toLowerCase())), [data, search]);
  return <View style={{ flex: 1, backgroundColor: m3.colorScheme.background, padding: spacing[4] }}>
    <Stack.Screen options={{ title: data?.organization_name ?? 'Farmers', headerBackVisible: false }} />
    <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant, marginBottom: spacing[3], textTransform: 'uppercase' }}>{data?.role ?? ''} workspace</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder="Search farmers" placeholderTextColor={m3.colorScheme.onSurfaceVariant} style={{ backgroundColor: m3.surface.surfaceContainer, color: m3.colorScheme.onSurface, borderRadius: borderRadius.xl, padding: spacing[4], marginBottom: spacing[4] }} />
    {isLoading ? <ActivityIndicator /> : isError ? <Pressable onPress={() => refetch()}><Text style={{ color: m3.colorScheme.error }}>Could not load farmers. Tap to retry.</Text></Pressable> :
    <FlatList data={clients} refreshing={isRefetching} onRefresh={refetch} keyExtractor={(item) => item.user_id} ListEmptyComponent={<Text style={{ color: m3.colorScheme.onSurfaceVariant }}>No permitted active farmers.</Text>} renderItem={({ item }) =>
      <Pressable onPress={() => router.push({ pathname: '/professional/farmer/[userId]', params: { userId: item.user_id } })} style={{ padding: spacing[4], borderRadius: borderRadius.xl, backgroundColor: m3.surface.surfaceContainer, marginBottom: spacing[3] }}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: m3.colorScheme.onSurface }}>{item.full_name}</Text>
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>{item.farms.length} {item.farms.length === 1 ? 'farm' : 'farms'}</Text>
      </Pressable>} />}
  </View>;
}
