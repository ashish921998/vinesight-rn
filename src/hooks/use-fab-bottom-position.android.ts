import { useTabBarInset } from './use-tab-bar-inset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/styles/theme';
import { getAndroidBottomSystemInset } from '@/utils/android-system-bars';

export function useFabBottomPosition(): number {
  const tabBarInset = useTabBarInset();
  const { bottom } = useSafeAreaInsets();
  const bottomSystemInset = getAndroidBottomSystemInset(bottom);

  const tabBarPaddingTop = spacing[2];
  const tabBarPaddingBottom = bottomSystemInset + spacing[2];
  const computed = tabBarInset - tabBarPaddingBottom - tabBarPaddingTop;

  return Math.max(0, computed);
}
