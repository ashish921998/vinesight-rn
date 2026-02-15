/**
 * Platform detection hook.
 * Use instead of duplicating Platform.OS === 'ios' / isIOS across components.
 * App targets iOS and Android only.
 */

import { Platform } from 'react-native';

export function usePlatform(): {
  isIOS: boolean;
  isAndroid: boolean;
  platform: 'ios' | 'android';
} {
  return {
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    platform: Platform.OS as 'ios' | 'android',
  };
}
