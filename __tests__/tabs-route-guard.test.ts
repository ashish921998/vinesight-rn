import { resolveTabsRouteGuard } from '@/features/tabs/route-guard';

describe('tabs route guard', () => {
  it('returns loading while auth is loading', () => {
    expect(resolveTabsRouteGuard({ authLoading: true, isAuthenticated: false })).toEqual({
      mode: 'loading',
    });
  });

  it('redirects unauthenticated user to phone login', () => {
    expect(resolveTabsRouteGuard({ authLoading: false, isAuthenticated: false })).toEqual({
      mode: 'redirect_auth',
      href: '/(auth)/phone-login',
    });
  });

  it('renders tabs when authenticated', () => {
    expect(resolveTabsRouteGuard({ authLoading: false, isAuthenticated: true })).toEqual({
      mode: 'render',
    });
  });
});
