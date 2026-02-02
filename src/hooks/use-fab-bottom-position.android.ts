import { useTabBarInset } from './use-tab-bar-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useFabBottomPosition(): number {
  const tabBarInset = useTabBarInset();
  const { bottom } = useSafeAreaInsets();
  // Position relative to tab bar top: subtract paddingTop(8) + paddingBottom from total height
  const tabBarPaddingTop = 8;
  const tabBarPaddingBottom = Math.max(bottom + 12, 20);
  return tabBarInset - tabBarPaddingBottom - tabBarPaddingTop;
}
