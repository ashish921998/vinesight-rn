import {
  assertNativeTabsFlowParity,
  listContractTabIds,
  resolveNextTabsRouteId,
  resolveTabFromRouteId,
  resolveTabsRouteId,
} from '@/native/shell';

describe('native tabs flow parity', () => {
  it('keeps tabs flow aligned with contract tabs and routes', () => {
    expect(() => assertNativeTabsFlowParity()).not.toThrow();
  });

  it('returns tab IDs from contract', () => {
    expect(listContractTabIds()).toEqual(['home', 'farms', 'tools', 'workers', 'settings']);
  });

  it('resolves tab route IDs and reverse mapping', () => {
    expect(resolveTabsRouteId('home')).toBe('tabs.home');
    expect(resolveTabsRouteId('workers')).toBe('tabs.workers');
    expect(resolveTabFromRouteId('tabs.settings')).toBe('settings');
  });

  it('resolves select and reset transitions', () => {
    expect(
      resolveNextTabsRouteId('tabs.home', { type: 'select_tab', tabId: 'tools' }),
    ).toBe('tabs.tools');
    expect(resolveNextTabsRouteId('tabs.tools', { type: 'reset_home' })).toBe('tabs.home');
  });
});
