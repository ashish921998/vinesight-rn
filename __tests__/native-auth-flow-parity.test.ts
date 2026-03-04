import {
  assertNativeAuthFlowParity,
  listContractAuthRouteIds,
  nativeAuthFlowNodes,
  nativeAuthInitialRouteId,
  resolveNextAuthRoute,
  type NativeAuthRouteId,
} from '@/native/shell';

describe('native auth flow parity', () => {
  it('keeps native auth flow aligned with auth routes in contract', () => {
    expect(() => assertNativeAuthFlowParity()).not.toThrow();
  });

  it('keeps initial auth route part of the flow', () => {
    expect(nativeAuthFlowNodes.some((node) => node.routeId === nativeAuthInitialRouteId)).toBe(
      true,
    );
  });

  it('returns contract auth route IDs', () => {
    expect(listContractAuthRouteIds()).toEqual([
      'auth.login',
      'auth.otp_verification',
      'auth.phone_login',
      'auth.profile_completion',
    ]);
  });

  it('resolves OTP sent transition from entry routes', () => {
    const routes: readonly NativeAuthRouteId[] = ['auth.login', 'auth.phone_login'];
    routes.forEach((route) => {
      expect(resolveNextAuthRoute(route, { type: 'otp_sent' })).toBe('auth.otp_verification');
    });
  });

  it('resolves OTP verified transition to profile completion when needed', () => {
    expect(
      resolveNextAuthRoute('auth.otp_verification', {
        type: 'otp_verified',
        hasCompleteProfile: false,
      }),
    ).toBe('auth.profile_completion');
  });

  it('resolves OTP verified transition to home when profile is complete', () => {
    expect(
      resolveNextAuthRoute('auth.otp_verification', {
        type: 'otp_verified',
        hasCompleteProfile: true,
      }),
    ).toBe('tabs.home');
  });
});
