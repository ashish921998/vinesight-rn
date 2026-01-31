import { Platform } from 'react-native';

import { useTabBarInset as useTabBarInsetAndroid } from './use-tab-bar-inset.android';
import { useTabBarInset as useTabBarInsetIOS } from './use-tab-bar-inset.ios';

// Bottom inset required to position UI ABOVE the bottom tab bar.
// Intended for screens rendered inside the tab navigator.
export const useTabBarInset = Platform.OS === 'android' ? useTabBarInsetAndroid : useTabBarInsetIOS;
