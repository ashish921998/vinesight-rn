import { useMemo } from 'react';

import { isIOS } from './use-platform';

export function useAndroidKeyboardLift(keyboardHeight: number, insetsBottom: number): number {
  return useMemo(() => {
    if (isIOS) return 0;
    return Math.max(0, keyboardHeight - insetsBottom);
  }, [keyboardHeight, insetsBottom]);
}
