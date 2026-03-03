import { useMemo } from 'react';
import { useProfile } from '@/hooks';
import { useAuthStore } from '@/stores';
import {
  type NativeAuthBootstrapSnapshot,
  resolveNativeBootstrapDecision,
  type NativeBootstrapDecision,
} from './adapter';

const buildSnapshot = (
  isLoading: boolean,
  isAuthenticated: boolean,
  needsProfileCompletion: boolean,
  hasProfileName: boolean,
  isProfileLoading: boolean,
): NativeAuthBootstrapSnapshot => ({
  isLoading,
  isAuthenticated,
  needsProfileCompletion,
  hasProfileName,
  isProfileLoading,
});

export const useNativeBootstrapDecision = (): NativeBootstrapDecision => {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsProfileCompletion = useAuthStore((state) => state.needsProfileCompletion);
  const { data: profile, isLoading: isProfileLoading } = useProfile({ enabled: isAuthenticated });

  const hasProfileName = Boolean(profile?.full_name && profile.full_name.trim().length > 0);

  return useMemo(() => {
    const snapshot = buildSnapshot(
      isLoading,
      isAuthenticated,
      needsProfileCompletion,
      hasProfileName,
      isProfileLoading,
    );
    return resolveNativeBootstrapDecision(snapshot);
  }, [hasProfileName, isAuthenticated, isLoading, isProfileLoading, needsProfileCompletion]);
};
