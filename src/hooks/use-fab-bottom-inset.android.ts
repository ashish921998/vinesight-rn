import { useBottomTabBarHeight } from 'expo-router/js-tabs';

import { spacing } from '@/styles/theme';

export function useFabBottomInset() {
  const tabBarHeight = useBottomTabBarHeight();
  return Math.max(spacing[4], tabBarHeight - 52);
}
