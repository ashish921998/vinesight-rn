export interface TabsRouteGuardInput {
  readonly authLoading: boolean;
  readonly isAuthenticated: boolean;
}

export type TabsRouteGuardResult =
  | { readonly mode: 'loading' }
  | { readonly mode: 'redirect_auth'; readonly href: '/(auth)/phone-login' }
  | { readonly mode: 'render' };

export const resolveTabsRouteGuard = (input: TabsRouteGuardInput): TabsRouteGuardResult => {
  if (input.authLoading) {
    return { mode: 'loading' };
  }

  if (!input.isAuthenticated) {
    return { mode: 'redirect_auth', href: '/(auth)/phone-login' };
  }

  return { mode: 'render' };
};
