import { isAndroid } from './use-platform';

import { useTabBarInset as useTabBarInsetAndroid } from './use-tab-bar-inset.android';
import { useTabBarInset as useTabBarInsetIOS } from './use-tab-bar-inset.ios';

export const useTabBarInset = isAndroid ? useTabBarInsetAndroid : useTabBarInsetIOS;
