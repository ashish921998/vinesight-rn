import {
  androidComposeRegistry,
  assertAllShellRegistriesParity,
  assertRegistryParityWithContract,
  iosSwiftUiRegistry,
} from '@/native/shell';

describe('native shell parity', () => {
  it('keeps iOS registry aligned with contract', () => {
    expect(() => assertRegistryParityWithContract(iosSwiftUiRegistry)).not.toThrow();
  });

  it('keeps Android registry aligned with contract', () => {
    expect(() => assertRegistryParityWithContract(androidComposeRegistry)).not.toThrow();
  });

  it('checks all registries at once', () => {
    expect(() => assertAllShellRegistriesParity()).not.toThrow();
  });

  it('fails when routes drift', () => {
    const drifted = {
      ...iosSwiftUiRegistry,
      routeIds: iosSwiftUiRegistry.routeIds.filter((id) => id !== 'auth.login'),
    };

    expect(() => assertRegistryParityWithContract(drifted)).toThrow('ios routes mismatch');
  });
});
