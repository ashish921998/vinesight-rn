import { Platform } from 'react-native';

import { useFabBottomPosition as useFabBottomPositionAndroid } from './use-fab-bottom-position.android';
import { useFabBottomPosition as useFabBottomPositionIOS } from './use-fab-bottom-position.ios';

export const useFabBottomPosition =
  Platform.OS === 'android' ? useFabBottomPositionAndroid : useFabBottomPositionIOS;
