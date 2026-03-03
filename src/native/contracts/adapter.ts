import { nativeUiContractManifest } from './manifest';

export type BootstrapAuthState =
  | 'loading'
  | 'unauthenticated'
  | 'profile_incomplete'
  | 'authenticated';

export interface NativeAuthBootstrapSnapshot {
  readonly isLoading: boolean;
  readonly isAuthenticated: boolean;
  readonly needsProfileCompletion: boolean;
  readonly hasProfileName: boolean;
  readonly isProfileLoading: boolean;
}

export interface NativeBootstrapDecision {
  readonly authState: BootstrapAuthState;
  readonly initialRouteId: string;
  readonly initialExpoPath: string;
}

const FALLBACK_ROUTE_ID = 'auth.phone_login';

const resolveRoutePath = (routeId: string): string => {
  const matchedRoute = nativeUiContractManifest.routes.find((route) => route.id === routeId);
  return matchedRoute?.path ?? '/(auth)/phone-login';
};

export const deriveBootstrapAuthState = (
  snapshot: NativeAuthBootstrapSnapshot,
): BootstrapAuthState => {
  if (snapshot.isLoading || (snapshot.isAuthenticated && snapshot.isProfileLoading))
    return 'loading';
  if (!snapshot.isAuthenticated) return 'unauthenticated';
  if (snapshot.needsProfileCompletion || !snapshot.hasProfileName) return 'profile_incomplete';
  return 'authenticated';
};

export const resolveBootstrapRouteId = (snapshot: NativeAuthBootstrapSnapshot): string => {
  const authState = deriveBootstrapAuthState(snapshot);

  switch (authState) {
    case 'loading':
      return 'splash';
    case 'unauthenticated':
      return FALLBACK_ROUTE_ID;
    case 'profile_incomplete':
      return 'auth.profile_completion';
    case 'authenticated':
      return 'tabs.home';
    default:
      return FALLBACK_ROUTE_ID;
  }
};

export const resolveNativeBootstrapDecision = (
  snapshot: NativeAuthBootstrapSnapshot,
): NativeBootstrapDecision => {
  const initialRouteId = resolveBootstrapRouteId(snapshot);
  if (initialRouteId === 'splash') {
    return {
      authState: 'loading',
      initialRouteId,
      initialExpoPath: '/index',
    };
  }

  return {
    authState: deriveBootstrapAuthState(snapshot),
    initialRouteId,
    initialExpoPath: resolveRoutePath(initialRouteId),
  };
};

export interface NativeRouteBinding {
  readonly id: string;
  readonly expoPath: string;
}

export const createNativeRouteBindings = (): readonly NativeRouteBinding[] =>
  nativeUiContractManifest.routes.map((route) => ({
    id: route.id,
    expoPath: route.path,
  }));

export const resolveRouteIdFromExpoPath = (expoPath: string): string | null => {
  const matchedRoute = nativeUiContractManifest.routes.find((route) => route.path === expoPath);
  return matchedRoute?.id ?? null;
};
