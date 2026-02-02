import { useTabBarInset } from './use-tab-bar-inset';
import { spacing } from '@/styles/theme';

export function useFabBottomPosition(): number {
  const tabBarInset = useTabBarInset();
  const gap = spacing[4];
  return Math.max(0, tabBarInset + gap);
}
