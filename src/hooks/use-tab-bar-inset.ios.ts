import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS NativeTabs (expo-router) does not expose a React Navigation tab bar height hook.
// Use UIKit's standard tab bar height (49pt) + safe-area bottom inset.
const IOS_NATIVE_TAB_BAR_HEIGHT = 49;

export function useTabBarInset() {
  const { bottom } = useSafeAreaInsets();
  return IOS_NATIVE_TAB_BAR_HEIGHT + bottom;
}
