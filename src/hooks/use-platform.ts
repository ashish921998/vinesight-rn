import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const platform = Platform.OS as 'ios' | 'android';

export function usePlatform() {
  return {
    isIOS,
    isAndroid,
    platform,
  };
}
