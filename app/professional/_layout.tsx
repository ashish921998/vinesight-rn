import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { fontSize } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

export default function ProfessionalLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);
  const m3 = useM3();

  // Redirect to login once the user is no longer authenticated (e.g. after
  // signing out from the professional directory). Mirrors the (tabs) guard.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !hasRedirected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasRedirected(true);
      router.replace({ pathname: '/(auth)/phone-login', params: { mode: 'signin' } });
    }
    if (isAuthenticated) {
      setHasRedirected(false);
    }
  }, [isAuthenticated, isLoading, router, hasRedirected]);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: t('common.back'),
        headerStyle: { backgroundColor: m3.colorScheme.surface },
        headerTitleStyle: {
          color: m3.colorScheme.onSurface,
          fontWeight: '600',
          fontSize: fontSize.lg,
        },
        headerTintColor: m3.colorScheme.primary,
        headerShadowVisible: false,
      }}
    >
      {/* The delegated add-log composer is a full-screen modal, matching the farmer flow. */}
      <Stack.Screen
        name="log/add"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
    </Stack>
  );
}
