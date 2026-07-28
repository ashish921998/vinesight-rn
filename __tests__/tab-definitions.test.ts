import { BASE_TABS, DETAILED_TABS } from '@/components/navigation/tab-definitions';

describe('BASE_TABS', () => {
  it('gives each base destination one label shared across modes', () => {
    const index = BASE_TABS.find((t) => t.name === 'index');
    const explore = BASE_TABS.find((t) => t.name === 'explore');

    // No mode-dependent Dashboard/Home or Farms/Explore swap — a single title.
    expect(index?.titleKey).toBe('tabs.home');
    expect(explore?.titleKey).toBe('tabs.explore');
  });

  it('exposes the expected inactive and selected Ionicons pairs', () => {
    expect(Object.fromEntries(BASE_TABS.map((tab) => [tab.name, tab.ion]))).toEqual({
      index: ['home-outline', 'home'],
      explore: ['leaf-outline', 'leaf'],
    });
  });
});

describe('DETAILED_TABS', () => {
  it('carries the title and icon pair for each detailed tab', () => {
    const workers = DETAILED_TABS.find((t) => t.name === 'workers');
    const tools = DETAILED_TABS.find((t) => t.name === 'tools');

    expect(workers?.titleKey).toBe('tabs.workers');
    expect(workers?.ion).toEqual(['people-outline', 'people']);
    expect(tools?.titleKey).toBe('tabs.tools');
    expect(tools?.ion).toEqual(['build-outline', 'build']);
  });
});
