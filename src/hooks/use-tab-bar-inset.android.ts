import * as React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
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
