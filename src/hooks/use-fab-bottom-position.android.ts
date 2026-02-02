import { useTabBarInset } from './use-tab-bar-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/styles/theme';

export function useFabBottomPosition(): number {
  const tabBarInset = useTabBarInset();
  const { bottom } = useSafeAreaInsets();

  const tabBarPaddingTop = spacing[2];
  const tabBarPaddingBottom = Math.max(bottom + spacing[3], spacing[5]);
  const computed = tabBarInset - tabBarPaddingBottom - tabBarPaddingTop;

  return Math.max(0, computed);
}
