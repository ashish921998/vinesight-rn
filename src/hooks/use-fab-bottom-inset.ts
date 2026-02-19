import { isAndroid } from './use-platform';

import { useFabBottomInset as useFabBottomInsetAndroid } from './use-fab-bottom-inset.android';
import { useFabBottomInset as useFabBottomInsetIOS } from './use-fab-bottom-inset.ios';

export const useFabBottomInset = isAndroid ? useFabBottomInsetAndroid : useFabBottomInsetIOS;
