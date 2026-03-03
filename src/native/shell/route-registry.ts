import { nativeUiContractManifest } from '@/native/contracts';

export interface NativeShellRegistry {
  readonly platform: 'ios' | 'android';
  readonly tabs: readonly string[];
  readonly routeIds: readonly string[];
}

export const iosSwiftUiRegistry: NativeShellRegistry = {
  platform: 'ios',
  tabs: ['home', 'farms', 'tools', 'workers', 'settings'],
  routeIds: [
    'auth.login',
    'auth.phone_login',
    'auth.otp_verification',
    'auth.profile_completion',
    'onboarding',
    'tabs.home',
    'tabs.farms',
    'tabs.tools',
    'tabs.workers',
    'tabs.settings',
  ],
};

export const androidComposeRegistry: NativeShellRegistry = {
  platform: 'android',
  tabs: ['home', 'farms', 'tools', 'workers', 'settings'],
  routeIds: [
    'auth.login',
    'auth.phone_login',
    'auth.otp_verification',
    'auth.profile_completion',
    'onboarding',
    'tabs.home',
    'tabs.farms',
    'tabs.tools',
    'tabs.workers',
    'tabs.settings',
  ],
};

const normalize = (values: readonly string[]): readonly string[] => [...values].sort();

export const assertRegistryParityWithContract = (registry: NativeShellRegistry): void => {
  const expectedTabs = normalize(nativeUiContractManifest.tabs);
  const expectedRoutes = normalize(nativeUiContractManifest.routes.map((route) => route.id));

  const actualTabs = normalize(registry.tabs);
  const actualRoutes = normalize(registry.routeIds);

  if (JSON.stringify(expectedTabs) !== JSON.stringify(actualTabs)) {
    throw new Error(
      `${registry.platform} tabs mismatch. expected=${expectedTabs.join(',')} actual=${actualTabs.join(',')}`,
    );
  }

  if (JSON.stringify(expectedRoutes) !== JSON.stringify(actualRoutes)) {
    throw new Error(
      `${registry.platform} routes mismatch. expected=${expectedRoutes.join(',')} actual=${actualRoutes.join(',')}`,
    );
  }
};

export const assertAllShellRegistriesParity = (): void => {
  assertRegistryParityWithContract(iosSwiftUiRegistry);
  assertRegistryParityWithContract(androidComposeRegistry);
};
