import { nativeUiContractManifest } from '@/native/contracts';

export type NativeTabId = 'home' | 'farms' | 'tools' | 'workers' | 'settings';

export type NativeTabRouteId =
  | 'tabs.home'
  | 'tabs.farms'
  | 'tabs.tools'
  | 'tabs.workers'
  | 'tabs.settings';

export type NativeTabsFlowEvent =
  | { readonly type: 'select_tab'; readonly tabId: NativeTabId }
  | { readonly type: 'reset_home' };

const tabRouteMap: Record<NativeTabId, NativeTabRouteId> = {
  home: 'tabs.home',
  farms: 'tabs.farms',
  tools: 'tabs.tools',
  workers: 'tabs.workers',
  settings: 'tabs.settings',
};

export const nativeTabsDefaultTabId: NativeTabId = 'home';

export const listContractTabIds = (): readonly NativeTabId[] =>
  nativeUiContractManifest.tabs as readonly NativeTabId[];

export const resolveTabsRouteId = (tabId: NativeTabId): NativeTabRouteId => tabRouteMap[tabId];

export const resolveTabFromRouteId = (routeId: NativeTabRouteId): NativeTabId => {
  const resolved = Object.entries(tabRouteMap).find(([, value]) => value === routeId)?.[0];
  if (!resolved) {
    return nativeTabsDefaultTabId;
  }
  return resolved as NativeTabId;
};

export const resolveNextTabsRouteId = (
  currentRouteId: NativeTabRouteId,
  event: NativeTabsFlowEvent,
): NativeTabRouteId => {
  switch (event.type) {
    case 'select_tab':
      return resolveTabsRouteId(event.tabId);
    case 'reset_home':
      return tabRouteMap.home;
    default:
      return currentRouteId;
  }
};

export const assertNativeTabsFlowParity = (): void => {
  const contractTabs = new Set(nativeUiContractManifest.tabs);
  const flowTabs = new Set(Object.keys(tabRouteMap));

  if (contractTabs.size !== flowTabs.size) {
    throw new Error(`native tabs mismatch size. expected=${contractTabs.size} actual=${flowTabs.size}`);
  }

  const missingTabs = [...contractTabs].filter((tab) => !flowTabs.has(tab));
  if (missingTabs.length > 0) {
    throw new Error(`native tabs missing keys: ${missingTabs.join(',')}`);
  }

  const routeIds = new Set(nativeUiContractManifest.routes.map((route) => route.id));
  const missingRoutes = Object.values(tabRouteMap).filter((routeId) => !routeIds.has(routeId));

  if (missingRoutes.length > 0) {
    throw new Error(`native tabs missing routes in manifest: ${missingRoutes.join(',')}`);
  }
};
