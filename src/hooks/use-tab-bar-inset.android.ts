import * as React from 'react';
// expo-router 56 bundles react-navigation; import the tab-bar-height context from its
// bundled copy so the context instance matches the one expo-router's <Tabs> provides.
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FALLBACK_TAB_BAR_HEIGHT = 56;

export function useTabBarInset() {
  const height = React.useContext(BottomTabBarHeightContext);
  const { bottom } = useSafeAreaInsets();

  if (height === undefined) {
    return FALLBACK_TAB_BAR_HEIGHT + bottom;
  }

  return height + bottom;
}
