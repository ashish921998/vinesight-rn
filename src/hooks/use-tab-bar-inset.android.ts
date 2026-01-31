import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export function useTabBarInset() {
  return useBottomTabBarHeight();
}
