import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useFabBottomInset() {
  const { bottom } = useSafeAreaInsets();
  return bottom;
}
