import { buildFarmSuggestions } from '@/components/assistant/farm-suggestions';
import type { Farm } from '@/types';

// Identity translator: returns the key so we can assert on ids deterministically.
const t = (key: string) => key;

function makeFarm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 1,
    name: 'Test Farm',
    region: 'Nashik',
    area: 5,
    crop: 'grapes',
    crop_variety: 'Shiraz',
    planting_date: '2023-01-01',
    ...overrides,
  } as Farm;
}

const NOW = new Date('2024-06-01T00:00:00Z');

describe('buildFarmSuggestions', () => {
  it('returns exactly three suggestions', () => {
    expect(buildFarmSuggestions(makeFarm(), t, NOW)).toHaveLength(3);
  });

  it('falls back to a general set when no farm is active', () => {
    const ids = buildFarmSuggestions(null, t, NOW).map((s) => s.id);
    expect(ids).toEqual(['today', 'spray', 'water']);
  });

  it('always includes the "today" plan suggestion', () => {
    const ids = buildFarmSuggestions(makeFarm(), t, NOW).map((s) => s.id);
    expect(ids).toContain('today');
  });

  it('surfaces the water question first when the farm is low on water', () => {
    const farm = makeFarm({ total_tank_capacity: 1000, remaining_water: 100 });
    const ids = buildFarmSuggestions(farm, t, NOW).map((s) => s.id);
    expect(ids[0]).toBe('water');
  });

  it('does not prioritise water when the tank is comfortably full', () => {
    const farm = makeFarm({ total_tank_capacity: 1000, remaining_water: 900 });
    const ids = buildFarmSuggestions(farm, t, NOW).map((s) => s.id);
    expect(ids[0]).not.toBe('water');
  });

  it('surfaces a harvest question inside the harvest window after pruning', () => {
    // ~120 days before NOW falls within the 90–150 day harvest window.
    const farm = makeFarm({ date_of_pruning: '2024-02-02' });
    const ids = buildFarmSuggestions(farm, t, NOW).map((s) => s.id);
    expect(ids).toContain('harvest');
  });

  it('does not surface harvest right after pruning', () => {
    const farm = makeFarm({ date_of_pruning: '2024-05-20' });
    const ids = buildFarmSuggestions(farm, t, NOW).map((s) => s.id);
    expect(ids).not.toContain('harvest');
  });

  it('maps each suggestion to a translated text and an icon', () => {
    const [first] = buildFarmSuggestions(makeFarm(), t, NOW);
    expect(first.text).toBe(`assistant.home.suggestions.${first.id}`);
    expect(typeof first.icon).toBe('string');
    expect(first.icon.length).toBeGreaterThan(0);
  });
});
