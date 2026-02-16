import { isAndroid } from './use-platform';

import { useFabBottomPosition as useFabBottomPositionAndroid } from './use-fab-bottom-position.android';
import { useFabBottomPosition as useFabBottomPositionIOS } from './use-fab-bottom-position.ios';

export const useFabBottomPosition = isAndroid
  ? useFabBottomPositionAndroid
  : useFabBottomPositionIOS;
