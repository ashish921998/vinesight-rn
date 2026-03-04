import { nativeUiContractManifest } from '@/native/contracts/index';

describe('native UI phase 0 contracts', () => {
  it('pins version and platforms', () => {
    expect(nativeUiContractManifest.version).toBe(1);

    const platformFrameworks = new Map(
      nativeUiContractManifest.platforms.map((item) => [item.platform, item.framework]),
    );

    expect(platformFrameworks.get('ios')).toBe('swiftui');
    expect(platformFrameworks.get('android')).toBe('jetpack_compose');
  });

  it('defines required tab shell for native navigation parity', () => {
    expect(nativeUiContractManifest.tabs).toEqual([
      'home',
      'farms',
      'tools',
      'workers',
      'settings',
    ]);
  });

  it('maintains unique route IDs and paths', () => {
    const ids = nativeUiContractManifest.routes.map((route) => route.id);
    const paths = nativeUiContractManifest.routes.map((route) => route.path);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('contains p0 auth bootstrap routes', () => {
    const p0RouteIds = nativeUiContractManifest.routes
      .filter((route) => route.nativePriority === 'p0')
      .map((route) => route.id);

    expect(p0RouteIds).toEqual(
      expect.arrayContaining([
        'auth.login',
        'auth.phone_login',
        'auth.otp_verification',
        'tabs.home',
      ]),
    );
  });

  it('keeps analytics contract event names unique', () => {
    const events = nativeUiContractManifest.analytics.requiredEvents;
    expect(new Set(events).size).toBe(events.length);
  });

  it('contains session fields required by native auth bootstrap', () => {
    expect(nativeUiContractManifest.auth.requiredSessionFields).toEqual(
      expect.arrayContaining(['userId', 'phone', 'accessToken', 'refreshToken', 'expiresAt']),
    );
  });
});
