import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useHomeBackExit } from '@/hooks/use-home-back-exit';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { deriveProfessionalRole } from '@/utils/professional-role';
import { useAuthStore } from '@/stores';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

export default function ProfessionalDirectory() {
  const router = useRouter();
  const m3 = useM3();
  const { t } = useTranslation();
  // This directory is the root of the consultant experience. Block the hardware
  // back button here (and the iOS swipe gesture via gestureEnabled:false below)
  // so a stray back press can never escape into the farmer app — it behaves
  // like a home screen: "press back again to exit".
  useHomeBackExit();
  const signOut = useAuthStore((state) => state.signOut);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [search, setSearch] = useState('');

  const handleSignOut = () => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            if (__DEV__) {
              console.error('Sign out error:', error);
            }
            Alert.alert(t('common.error'), t('settings.errors.signOutFailed'));
          }
        },
      },
    ]);
  };
  const { data, isLoading, isError, refetch, isRefetching } = useProfessionalWorkspace({
    enabled: isAuthenticated,
  });
  const role = deriveProfessionalRole(data);
  const clients = useMemo(
    () =>
      (data?.clients ?? []).filter((c) =>
        (c.full_name ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data, search],
  );
  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background, padding: spacing[4] }}>
      <Stack.Screen
        options={{
          title: data?.organization_name ?? t('professional.title'),
          headerBackVisible: false,
          // Root of the professional Stack: no swipe-back escape on iOS.
          gestureEnabled: false,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.signOut')}
              onPress={handleSignOut}
              hitSlop={8}
              style={{ paddingHorizontal: spacing[2], paddingVertical: spacing[1] }}
            >
              <SymbolIcon
                name="rectangle.portrait.and.arrow.right"
                size={22}
                color={m3.colorScheme.onSurface}
              />
            </Pressable>
          ),
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
        {role.isAgronomist
          ? t('professional.scopeAssigned')
          : t('professional.scopeAll', { organization: data?.organization_name ?? '' })}
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
              {role.isAgronomist
                ? t('professional.emptyAssignedFarmers')
                : t('professional.emptyFarmers')}
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
