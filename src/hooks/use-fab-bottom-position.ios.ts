import { useFabBottomInset } from './use-fab-bottom-inset';
import { spacing } from '@/styles/theme';

export function useFabBottomPosition(): number {
  const fabBottomInset = useFabBottomInset();
  return spacing[14] + fabBottomInset;
}
