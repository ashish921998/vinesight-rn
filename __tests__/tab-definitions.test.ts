import { BASE_TABS, DETAILED_TABS } from '@/components/navigation/tab-definitions';

describe('BASE_TABS', () => {
  it('gives each base destination one label + Android icon shared across modes', () => {
    const index = BASE_TABS.find((t) => t.name === 'index');
    const explore = BASE_TABS.find((t) => t.name === 'explore');

    // No mode-dependent Dashboard/Home or Farms/Explore swap — a single title.
    expect(index?.titleKey).toBe('tabs.home');
    expect(explore?.titleKey).toBe('tabs.explore');
    expect(index?.androidIconKey).toBe('home');
    expect(explore?.androidIconKey).toBe('tractor');
  });

  it('exposes an iOS SF pair and Ionicons pair for every base tab', () => {
    for (const tab of BASE_TABS) {
      expect(tab.sf).toHaveLength(2);
      expect(tab.ion).toHaveLength(2);
    }
  });
});

describe('DETAILED_TABS', () => {
  it('carries the Android icon key and single title for each detailed tab', () => {
    const workers = DETAILED_TABS.find((t) => t.name === 'workers');
    const tools = DETAILED_TABS.find((t) => t.name === 'tools');

    expect(workers?.titleKey).toBe('tabs.workers');
    expect(workers?.androidIconKey).toBe('workers');
    expect(tools?.titleKey).toBe('tabs.tools');
    expect(tools?.androidIconKey).toBe('tools');
  });
});
