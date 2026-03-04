import {
  createNativeRouteBindings,
  deriveBootstrapAuthState,
  resolveBootstrapRouteId,
  resolveNativeBootstrapDecision,
  resolveRouteIdFromExpoPath,
  type NativeAuthBootstrapSnapshot,
} from '@/native/contracts/adapter';

const makeSnapshot = (
  partial: Partial<NativeAuthBootstrapSnapshot>,
): NativeAuthBootstrapSnapshot => ({
  isLoading: false,
  isAuthenticated: false,
  needsProfileCompletion: false,
  hasProfileName: false,
  isProfileLoading: false,
  ...partial,
});

describe('native bootstrap adapter', () => {
  it('returns loading state when auth bootstrap is in progress', () => {
    const snapshot = makeSnapshot({ isLoading: true });
    expect(deriveBootstrapAuthState(snapshot)).toBe('loading');
    expect(resolveBootstrapRouteId(snapshot)).toBe('splash');
  });

  it('routes unauthenticated users to phone login', () => {
    const snapshot = makeSnapshot({
      isLoading: false,
      isAuthenticated: false,
      hasProfileName: false,
    });

    expect(deriveBootstrapAuthState(snapshot)).toBe('unauthenticated');
    expect(resolveBootstrapRouteId(snapshot)).toBe('auth.phone_login');
  });

  it('routes profile-incomplete users correctly', () => {
    const snapshot = makeSnapshot({
      isAuthenticated: true,
      needsProfileCompletion: true,
      hasProfileName: false,
    });

    expect(deriveBootstrapAuthState(snapshot)).toBe('profile_incomplete');
    expect(resolveBootstrapRouteId(snapshot)).toBe('auth.profile_completion');
  });

  it('routes authenticated users with complete profiles to home tab', () => {
    const snapshot = makeSnapshot({
      isAuthenticated: true,
      needsProfileCompletion: false,
      hasProfileName: true,
    });

    expect(deriveBootstrapAuthState(snapshot)).toBe('authenticated');
    expect(resolveBootstrapRouteId(snapshot)).toBe('tabs.home');
  });

  it('resolves native bootstrap decision with concrete Expo path', () => {
    const snapshot = makeSnapshot({
      isAuthenticated: true,
      hasProfileName: true,
    });

    expect(resolveNativeBootstrapDecision(snapshot)).toEqual({
      authState: 'authenticated',
      initialRouteId: 'tabs.home',
      initialExpoPath: '/(tabs)',
    });
  });

  it('creates unique route bindings and reverse lookup', () => {
    const bindings = createNativeRouteBindings();
    const bindingIds = bindings.map((binding) => binding.id);

    expect(new Set(bindingIds).size).toBe(bindings.length);
    expect(resolveRouteIdFromExpoPath('/(auth)/phone-login')).toBe('auth.phone_login');
    expect(resolveRouteIdFromExpoPath('/does-not-exist')).toBeNull();
  });
});
