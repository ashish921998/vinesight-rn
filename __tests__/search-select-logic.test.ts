import {
  buildSearchSelectSections,
  chemicalCatalogToOptions,
  customOptionForQuery,
  filterAndRankOptions,
  normalizeSearchText,
  planItemsToOptions,
  recentItemsToOptions,
  type SearchSelectOption,
} from '@/components/ui/search-select-logic';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { ChemicalMix, ChemicalMixComponent } from '@/types/phi';

// search-select-logic reuses the per-liter dose normalizer from phi-service,
// whose module graph reaches the supabase client.
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const option = (name: string, overrides?: Partial<SearchSelectOption>): SearchSelectOption => ({
  key: name,
  name,
  selection: { kind: 'item', name, isCustom: false },
  ...overrides,
});

const recent = (overrides: Partial<RecentInputItem>): RecentInputItem => ({
  name: 'Karate',
  unit: 'ml/L',
  quantity: 2,
  ...overrides,
});

const planItem = (overrides: Partial<FertilizerPlanItem>): FertilizerPlanItem => ({
  id: 'plan-item-1',
  name: '19:19:19',
  quantity: 5,
  unit: 'kg/acre',
  application_date: null,
  application_method: null,
  application_frequency: null,
  notes: null,
  sort_order: null,
  ...overrides,
});

const component = (overrides: Partial<ChemicalMixComponent>): ChemicalMixComponent => ({
  id: 1,
  mix_id: 10,
  product_id: 100,
  product_name: 'Bavistin',
  active_ingredient: 'Carbendazim',
  dose_value: 2,
  dose_unit: 'gm',
  dose_basis: 'per_liter',
  base_tank_liters: null,
  phi_days: 30,
  phi_verified: true,
  phi_source: 'label',
  ...overrides,
});

const mix = (overrides: Partial<ChemicalMix>): ChemicalMix => ({
  id: 10,
  name: 'Downy special',
  target_problem: 'Downy mildew',
  application_mode: 'preventive',
  source_page: null,
  is_active: true,
  components: [component({})],
  ...overrides,
});

describe('normalizeSearchText', () => {
  it('is case and whitespace tolerant', () => {
    expect(normalizeSearchText('  KaRaTe   2 ')).toBe('karate 2');
  });

  it('unifies decomposed and composed Devanagari forms', () => {
    // 'यूरिया' typed with a combining vowel sign vs precomposed.
    expect(normalizeSearchText('यूरिया')).toBe(normalizeSearchText('यूरिया'));
  });
});

describe('filterAndRankOptions', () => {
  it('ranks prefix above token-prefix above substring, stable for ties', () => {
    const options = [
      option('Copper Kara'), // token prefix on 'kara'
      option('Bakara'), // substring
      option('Karate 5EC'), // prefix
      option('Karanja oil'), // prefix
    ];
    expect(filterAndRankOptions(options, 'kara').map((entry) => entry.name)).toEqual([
      'Karate 5EC',
      'Karanja oil',
      'Copper Kara',
      'Bakara',
    ]);
  });

  it('matches case- and whitespace-insensitively', () => {
    const options = [option('Karate  5EC')];
    expect(filterAndRankOptions(options, '  kArAtE ')).toHaveLength(1);
  });

  it('matches Devanagari queries against names and keywords', () => {
    const options = [
      option('युरिया'),
      option('Sulfex', { keywords: ['गंधक'] }),
      option('Bavistin'),
    ];
    expect(filterAndRankOptions(options, 'युरि').map((entry) => entry.name)).toEqual(['युरिया']);
    expect(filterAndRankOptions(options, 'गंध').map((entry) => entry.name)).toEqual(['Sulfex']);
  });

  it('ranks a name match above a keyword-only match', () => {
    const options = [option('Mancozeb mix', { keywords: ['zineb'] }), option('Zineb 75WP')];
    expect(filterAndRankOptions(options, 'zineb').map((entry) => entry.name)).toEqual([
      'Zineb 75WP',
      'Mancozeb mix',
    ]);
  });

  it('returns everything unfiltered for an empty query', () => {
    const options = [option('A'), option('B')];
    expect(filterAndRankOptions(options, '   ')).toEqual(options);
  });
});

describe('buildSearchSelectSections', () => {
  const history = [option('Karate history')];
  const plan = [option('Karate plan')];
  const catalog = [option('Karate catalog')];

  it('orders sections history → plan → catalog → custom', () => {
    const sections = buildSearchSelectSections({ query: 'karate', history, plan, catalog });
    expect(sections.map((section) => section.id)).toEqual(['history', 'plan', 'catalog', 'custom']);
  });

  it('drops empty sections (empty catalog / no plan degrade gracefully)', () => {
    const sections = buildSearchSelectSections({ query: '', history, plan: [], catalog: [] });
    expect(sections.map((section) => section.id)).toEqual(['history']);
  });

  it('drops sections whose options do not match the query', () => {
    const sections = buildSearchSelectSections({
      query: 'nomatch',
      history,
      plan,
      catalog,
      allowCustom: false,
    });
    expect(sections).toEqual([]);
  });

  it('appends the custom escape hatch whenever the query is non-empty', () => {
    const sections = buildSearchSelectSections({ query: 'Anything New', history: [] });
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('custom');
    expect(sections[0].options[0].selection).toEqual({
      kind: 'item',
      name: 'Anything New',
      isCustom: true,
    });
  });

  it('shows no custom row for an empty query or when custom is disallowed', () => {
    expect(buildSearchSelectSections({ query: '  ' }).find((s) => s.id === 'custom')).toBe(
      undefined,
    );
    expect(
      buildSearchSelectSections({ query: 'x', allowCustom: false }).find((s) => s.id === 'custom'),
    ).toBe(undefined);
  });

  it('keeps the custom row alongside matching results', () => {
    const sections = buildSearchSelectSections({ query: 'karate', history });
    expect(sections.map((section) => section.id)).toEqual(['history', 'custom']);
  });
});

describe('customOptionForQuery', () => {
  it('collapses whitespace but keeps the typed casing', () => {
    expect(customOptionForQuery('  New   Chemical ').selection).toEqual({
      kind: 'item',
      name: 'New Chemical',
      isCustom: true,
    });
  });
});

describe('recentItemsToOptions', () => {
  it('emits fully-prefilled selections carrying all identity fields', () => {
    const options = recentItemsToOptions([
      recent({
        quantityBasis: 'per_acre',
        catalogProductId: 5,
        warehouseItemId: 9,
        catalogMixId: 77,
      }),
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].selection).toEqual({
      kind: 'item',
      name: 'Karate',
      catalogProductId: 5,
      warehouseItemId: 9,
      catalogMixId: 77,
      isCustom: false,
      prefill: { quantity: 2, unit: 'ml/L', quantityBasis: 'per_acre' },
    });
  });

  it('shows the last dose and marks rows that restore a whole mix', () => {
    const options = recentItemsToOptions(
      [recent({ catalogMixId: 77 }), recent({ name: 'Solo', catalogMixId: null })],
      { mixLabel: 'मिश्रण' },
    );
    expect(options[0].detail).toBe('2 ml/L · मिश्रण');
    expect(options[1].detail).toBe('2 ml/L');
  });

  it('defaults identity fields to null for legacy rows and skips blank names', () => {
    const options = recentItemsToOptions([recent({}), recent({ name: '   ' })]);
    expect(options).toHaveLength(1);
    expect(options[0].selection.catalogProductId).toBeNull();
    expect(options[0].selection.warehouseItemId).toBeNull();
    expect(options[0].selection.catalogMixId).toBeNull();
  });
});

describe('planItemsToOptions', () => {
  it('stamps planItemId and prefills the prescribed dose', () => {
    const options = planItemsToOptions([planItem({})]);
    expect(options).toEqual([
      {
        key: 'plan:plan-item-1',
        name: '19:19:19',
        detail: '5 kg/acre',
        selection: {
          kind: 'item',
          name: '19:19:19',
          planItemId: 'plan-item-1',
          isCustom: false,
          prefill: { quantity: 5, unit: 'kg/acre' },
        },
      },
    ]);
  });

  it('skips nameless items and tolerates missing dose', () => {
    const options = planItemsToOptions([
      planItem({ id: 'a', name: '  ' }),
      planItem({ id: 'b', name: 'Urea', quantity: null, unit: null }),
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].detail).toBeNull();
  });
});

describe('chemicalCatalogToOptions', () => {
  it('lists mixes first, whole-mix selections without item prefill', () => {
    const options = chemicalCatalogToOptions([mix({})]);
    expect(options[0]).toMatchObject({
      key: 'mix:10',
      name: 'Downy special',
      detail: 'Downy mildew',
      selection: { kind: 'mix', name: 'Downy special', catalogMixId: 10, isCustom: false },
    });
    expect(options[0].selection.prefill).toBeUndefined();
  });

  it('makes mixes findable by component product name and active ingredient', () => {
    const options = chemicalCatalogToOptions([mix({})]);
    expect(filterAndRankOptions([options[0]], 'carbendazim')).toHaveLength(1);
    expect(filterAndRankOptions([options[0]], 'bavistin')).toHaveLength(1);
  });

  it('derives distinct products with per-liter label-dose prefill and PHI pass-through', () => {
    const options = chemicalCatalogToOptions([
      mix({}),
      mix({
        id: 11,
        name: 'Another mix',
        components: [
          component({ id: 2, mix_id: 11 }), // same product 100 → deduped
          component({
            id: 3,
            mix_id: 11,
            product_id: 200,
            product_name: 'Curzate',
            active_ingredient: 'Cymoxanil',
            dose_value: 150,
            dose_unit: 'gm',
            dose_basis: 'per_100_liter',
            phi_days: null,
          }),
        ],
      }),
    ]);
    const products = options.filter((entry) => entry.key.startsWith('product:'));
    expect(products.map((entry) => entry.name)).toEqual(['Bavistin', 'Curzate']);
    expect(products[0].selection).toEqual({
      kind: 'item',
      name: 'Bavistin',
      catalogProductId: 100,
      isCustom: false,
      prefill: { quantity: 2, unit: 'gm/L', quantityBasis: 'total', phiDays: 30 },
    });
    // per_100_liter label dose normalizes to per-liter, like applyCatalogMix.
    expect(products[1].selection.prefill).toEqual({
      quantity: 1.5,
      unit: 'gm/L',
      quantityBasis: 'total',
      phiDays: null,
    });
  });

  it('omits derived products in catalog-only mode', () => {
    const options = chemicalCatalogToOptions([mix({})], { includeProducts: false });
    expect(options).toHaveLength(1);
    expect(options[0].selection.kind).toBe('mix');
  });

  it('returns nothing for an empty catalog', () => {
    expect(chemicalCatalogToOptions([])).toEqual([]);
  });
});
