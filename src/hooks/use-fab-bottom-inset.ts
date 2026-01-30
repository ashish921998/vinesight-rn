import { Platform } from 'react-native';

import { useFabBottomInset as useFabBottomInsetAndroid } from './use-fab-bottom-inset.android';
import { useFabBottomInset as useFabBottomInsetIOS } from './use-fab-bottom-inset.ios';

export const useFabBottomInset =
  Platform.OS === 'android' ? useFabBottomInsetAndroid : useFabBottomInsetIOS;
