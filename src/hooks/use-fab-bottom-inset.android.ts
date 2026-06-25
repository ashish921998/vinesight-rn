// expo-router 56 bundles react-navigation; import the tab-bar-height util from its
// bundled copy so the React context instance matches the one expo-router's <Tabs> provides.
import { useBottomTabBarHeight } from 'expo-router/build/react-navigation/bottom-tabs';

import { spacing } from '@/styles/theme';

export function useFabBottomInset() {
  const tabBarHeight = useBottomTabBarHeight();
  return Math.max(spacing[4], tabBarHeight - 52);
}
