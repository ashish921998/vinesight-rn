import { baseTabIconKey, baseTabLabelKey } from '@/components/navigation/tab-definitions';

describe('baseTabLabelKey', () => {
  it('labels the base destinations Home / Farming (same in both modes)', () => {
    expect(baseTabLabelKey('index', 'tabs.dashboard')).toBe('tabs.home');
    expect(baseTabLabelKey('explore', 'tabs.explore')).toBe('tabs.explore');
  });

  it('falls back to the tab title key for non-base tabs', () => {
    expect(baseTabLabelKey('workers', 'tabs.workers')).toBe('tabs.workers');
    expect(baseTabLabelKey('tools', 'tabs.tools')).toBe('tabs.tools');
  });
});

describe('baseTabIconKey', () => {
  it('maps the base destinations to home / tractor (same in both modes)', () => {
    expect(baseTabIconKey('index')).toBe('home');
    expect(baseTabIconKey('explore')).toBe('tractor');
  });

  it('defaults to home for any other route', () => {
    expect(baseTabIconKey('workers')).toBe('home');
  });
});
