import { nativeUiContractManifest } from '@/native/contracts';

export type NativeAuthRouteId =
  | 'auth.login'
  | 'auth.phone_login'
  | 'auth.otp_verification'
  | 'auth.profile_completion';

export type NativeAuthPhase = 'entry' | 'verification' | 'profile';

export type NativeAuthRouteOutcome = NativeAuthRouteId | 'tabs.home';

export interface NativeAuthFlowNode {
  readonly routeId: NativeAuthRouteId;
  readonly phase: NativeAuthPhase;
  readonly canFallbackToJs: boolean;
}

export type NativeAuthFlowEvent =
  | { readonly type: 'restart' }
  | { readonly type: 'login_requested' }
  | { readonly type: 'phone_login_requested' }
  | { readonly type: 'otp_sent' }
  | { readonly type: 'otp_verified'; readonly hasCompleteProfile: boolean };

const AUTH_ROUTE_IDS: readonly NativeAuthRouteId[] = [
  'auth.login',
  'auth.phone_login',
  'auth.otp_verification',
  'auth.profile_completion',
];

export const nativeAuthInitialRouteId: NativeAuthRouteId = 'auth.phone_login';

export const nativeAuthFlowNodes: readonly NativeAuthFlowNode[] = [
  { routeId: 'auth.login', phase: 'entry', canFallbackToJs: true },
  { routeId: 'auth.phone_login', phase: 'entry', canFallbackToJs: false },
  { routeId: 'auth.otp_verification', phase: 'verification', canFallbackToJs: false },
  { routeId: 'auth.profile_completion', phase: 'profile', canFallbackToJs: false },
];

const normalize = (values: readonly string[]): readonly string[] => [...values].sort();

const isNativeAuthRouteId = (routeId: string): routeId is NativeAuthRouteId =>
  AUTH_ROUTE_IDS.includes(routeId as NativeAuthRouteId);

export const listContractAuthRouteIds = (): readonly NativeAuthRouteId[] => {
  const authRouteIds = nativeUiContractManifest.routes
    .map((route) => route.id)
    .filter((routeId): routeId is NativeAuthRouteId => isNativeAuthRouteId(routeId));

  return normalize(authRouteIds) as readonly NativeAuthRouteId[];
};

export const resolveNextAuthRoute = (
  currentRouteId: NativeAuthRouteId,
  event: NativeAuthFlowEvent,
): NativeAuthRouteOutcome => {
  switch (event.type) {
    case 'restart':
      return nativeAuthInitialRouteId;
    case 'login_requested':
      return 'auth.login';
    case 'phone_login_requested':
      return 'auth.phone_login';
    case 'otp_sent':
      if (currentRouteId === 'auth.login' || currentRouteId === 'auth.phone_login') {
        return 'auth.otp_verification';
      }
      return currentRouteId;
    case 'otp_verified':
      if (currentRouteId === 'auth.otp_verification') {
        return event.hasCompleteProfile ? 'tabs.home' : 'auth.profile_completion';
      }
      if (currentRouteId === 'auth.profile_completion') {
        return 'tabs.home';
      }
      return currentRouteId;
    default:
      return currentRouteId;
  }
};

export const assertNativeAuthFlowParity = (): void => {
  const expectedAuthRouteIds = listContractAuthRouteIds();
  const actualAuthRouteIds = normalize(nativeAuthFlowNodes.map((node) => node.routeId));

  if (JSON.stringify(expectedAuthRouteIds) !== JSON.stringify(actualAuthRouteIds)) {
    throw new Error(
      `native auth routes mismatch. expected=${expectedAuthRouteIds.join(',')} actual=${actualAuthRouteIds.join(',')}`,
    );
  }

  const hasInitial = nativeAuthFlowNodes.some((node) => node.routeId === nativeAuthInitialRouteId);

  if (!hasInitial) {
    throw new Error(`native auth initial route is missing from flow: ${nativeAuthInitialRouteId}`);
  }
};
