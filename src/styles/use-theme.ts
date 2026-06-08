import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/theme-store';
import { getM3Theme } from './theme';

export const useResolvedThemeMode = () => {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme();
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
};

export const useIsDark = () => useResolvedThemeMode() === 'dark';

export const useM3 = () => {
  const isDark = useIsDark();
  return useMemo(() => getM3Theme(isDark), [isDark]);
};
