import { baseTabLabelKey } from '@/components/navigation/tab-definitions';

describe('baseTabLabelKey', () => {
  it('relabels the base destinations to Home/Farms in Simplified mode', () => {
    expect(baseTabLabelKey('index', false, 'tabs.dashboard')).toBe('tabs.home');
    expect(baseTabLabelKey('explore', false, 'tabs.explore')).toBe('tabs.farms');
  });

  it('keeps Dashboard/Farming labels in Detailed mode', () => {
    expect(baseTabLabelKey('index', true, 'tabs.dashboard')).toBe('tabs.dashboard');
    expect(baseTabLabelKey('explore', true, 'tabs.explore')).toBe('tabs.explore');
  });

  it('falls back to the tab title key for non-base tabs in either mode', () => {
    expect(baseTabLabelKey('workers', false, 'tabs.workers')).toBe('tabs.workers');
    expect(baseTabLabelKey('tools', true, 'tabs.tools')).toBe('tabs.tools');
  });
});
