import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

export default function ProfessionalDirectory() {
  const router = useRouter();
  const m3 = useM3();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch, isRefetching } = useProfessionalWorkspace();
  const clients = useMemo(
    () =>
      (data?.clients ?? []).filter((c) =>
        c.full_name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data, search],
  );
  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background, padding: spacing[4] }}>
      <Stack.Screen
        options={{
          title: data?.organization_name ?? t('professional.title'),
          headerBackVisible: false,
        }}
      />
      <Text
        style={{
          fontSize: fontSize.xs,
          color: m3.colorScheme.onSurfaceVariant,
          marginBottom: spacing[3],
          textTransform: 'uppercase',
        }}
      >
        {t('professional.workspace', { role: data?.role ?? '' })}
      </Text>
      <TextInput
        accessibilityLabel={t('professional.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        placeholder={t('professional.searchPlaceholder')}
        placeholderTextColor={m3.colorScheme.onSurfaceVariant}
        style={{
          backgroundColor: m3.surface.surfaceContainer,
          color: m3.colorScheme.onSurface,
          borderRadius: borderRadius.xl,
          padding: spacing[4],
          marginBottom: spacing[4],
        }}
      />
      {isLoading ? (
        <ActivityIndicator />
      ) : isError ? (
        <Pressable accessibilityRole="button" onPress={() => refetch()}>
          <Text style={{ color: m3.colorScheme.error }}>{t('professional.errors.farmers')}</Text>
        </Pressable>
      ) : (
        <FlatList
          data={clients}
          refreshing={isRefetching}
          onRefresh={refetch}
          keyExtractor={(item) => item.user_id}
          ListEmptyComponent={
            <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('professional.emptyFarmers')}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.full_name}, ${t('professional.farmCount', { count: item.farms.length })}`}
              onPress={() =>
                router.push({
                  pathname: '/professional/farmer/[userId]',
                  params: { userId: item.user_id },
                })
              }
              style={{
                padding: spacing[4],
                borderRadius: borderRadius.xl,
                backgroundColor: m3.surface.surfaceContainer,
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
                {item.full_name}
              </Text>
              <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[1] }}>
                {t('professional.farmCount', { count: item.farms.length })}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
