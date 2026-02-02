import { useTabBarInset } from './use-tab-bar-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/styles/theme';

export function useFabBottomPosition(): number {
  const tabBarInset = useTabBarInset();
  const { bottom } = useSafeAreaInsets();
  // Position relative to tab bar top: subtract paddingTop(8) + paddingBottom from total height
  const tabBarPaddingTop = spacing[2];
  const tabBarPaddingBottom = Math.max(bottom + spacing[3], spacing[5]);
  return tabBarInset - tabBarPaddingBottom - tabBarPaddingTop;
}
