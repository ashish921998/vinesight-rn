import * as React from 'react';
// expo-router 56 bundles react-navigation; import the tab-bar-height context from its
// bundled copy so the context instance matches the one expo-router's <Tabs> provides.
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAndroidBottomSystemInset } from '@/utils/android-system-bars';

// M3 NavigationBar container height is 80dp (m3.material.io/components/navigation-bar/specs).
// This is only used before the tab bar lays out; once mounted, the real measured
// height (80dp + system nav-bar inset) is provided via BottomTabBarHeightContext.
const FALLBACK_TAB_BAR_HEIGHT = 80;

export function useTabBarInset() {
  const height = React.useContext(BottomTabBarHeightContext);
  const { bottom } = useSafeAreaInsets();
  const bottomSystemInset = getAndroidBottomSystemInset(bottom);

  if (height === undefined) {
    return FALLBACK_TAB_BAR_HEIGHT + bottomSystemInset;
  }

  return height;
}
