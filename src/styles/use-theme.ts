import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/theme-store';
import { getM3Theme, getThemeColors } from './theme';

export const useResolvedThemeMode = () => {
  const mode = useThemeStore((state) => state.mode);
  const systemScheme = useColorScheme();
  if (mode === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return mode;
};

export const useIsDark = () => useResolvedThemeMode() === 'dark';

export const useThemeColors = () => {
  const isDark = useIsDark();
  return useMemo(() => getThemeColors(isDark), [isDark]);
};

export const useM3 = () => {
  const isDark = useIsDark();
  return useMemo(() => getM3Theme(isDark), [isDark]);
};

export const useThemeTokens = () => {
  const mode = useThemeStore((state) => state.mode);
  const resolvedMode = useResolvedThemeMode();
  const isDark = resolvedMode === 'dark';
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);
  const m3 = useMemo(() => getM3Theme(isDark), [isDark]);
  return { mode, resolvedMode, isDark, colors, m3 };
};
