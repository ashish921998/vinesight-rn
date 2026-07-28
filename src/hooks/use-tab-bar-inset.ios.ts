import * as React from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FALLBACK_TAB_BAR_HEIGHT = 82;

export function useTabBarInset() {
  const height = React.useContext(BottomTabBarHeightContext);
  const { bottom } = useSafeAreaInsets();
  return height ?? FALLBACK_TAB_BAR_HEIGHT + bottom;
}
