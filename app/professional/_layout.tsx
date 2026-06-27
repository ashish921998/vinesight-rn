import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';

export default function ProfessionalLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [hasRedirected, setHasRedirected] = useState(false);

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
    <Stack screenOptions={{ headerBackTitle: t('common.back') }}>
      {/* The delegated add-log composer is a full-screen modal, matching the farmer flow. */}
      <Stack.Screen
        name="log/add"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
    </Stack>
  );
}
