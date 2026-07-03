import AsyncStorage from '@react-native-async-storage/async-storage';
import { sprayProductKey, useSprayUnitStore } from '@/stores/spray-unit-store';

beforeEach(() => {
  useSprayUnitStore.setState({ lastUsedChips: {} });
  (AsyncStorage.setItem as jest.Mock).mockClear();
});

describe('sprayProductKey', () => {
  it('prefers catalog identity over the display name', () => {
    expect(sprayProductKey('Karate', 100)).toBe('catalog:100');
  });

  it('falls back to the normalized name', () => {
    expect(sprayProductKey('  Copper Oxychloride ', null)).toBe('name:copper oxychloride');
  });

  it('returns null when there is no identity at all', () => {
    expect(sprayProductKey('   ', null)).toBeNull();
    expect(sprayProductKey(null, null)).toBeNull();
  });
});

describe('last-used chip store', () => {
  it('remembers the last chip per product', () => {
    useSprayUnitStore.getState().setLastUsedChip('catalog:100', 'ppm');
    useSprayUnitStore.getState().setLastUsedChip('name:copper', 'g/acre');

    expect(useSprayUnitStore.getState().lastUsedChips).toEqual({
      'catalog:100': 'ppm',
      'name:copper': 'g/acre',
    });
  });

  it('overwrites the previous chip for the same product', () => {
    useSprayUnitStore.getState().setLastUsedChip('catalog:100', 'ppm');
    useSprayUnitStore.getState().setLastUsedChip('catalog:100', 'mL/L');

    expect(useSprayUnitStore.getState().lastUsedChips['catalog:100']).toBe('mL/L');
  });

  it('evicts the least recently used product beyond the cap, honoring re-use', () => {
    const { setLastUsedChip } = useSprayUnitStore.getState();
    for (let i = 0; i < 200; i++) setLastUsedChip(`name:product-${i}`, 'g/L');
    // Touch the oldest entry so it becomes the most recent.
    setLastUsedChip('name:product-0', 'ppm');
    setLastUsedChip('name:one-over-cap', 'g/acre');

    const chips = useSprayUnitStore.getState().lastUsedChips;
    expect(Object.keys(chips)).toHaveLength(200);
    expect(chips['name:product-0']).toBe('ppm');
    expect(chips['name:one-over-cap']).toBe('g/acre');
    // product-1 became the least recently used and dropped.
    expect(chips['name:product-1']).toBeUndefined();
  });

  it('persists to AsyncStorage under the store key', async () => {
    useSprayUnitStore.getState().setLastUsedChip('catalog:100', 'ppm');
    await Promise.resolve();

    const writes = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
      ([key]) => key === 'vinesight-spray-unit-prefs',
    );
    expect(writes.length).toBeGreaterThan(0);
    const persisted = JSON.parse(writes[writes.length - 1][1]);
    expect(persisted.state.lastUsedChips['catalog:100']).toBe('ppm');
  });
});
