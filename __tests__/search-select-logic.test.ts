import {
  buildSearchSelectSections,
  catalogCompositionToSnapshot,
  chemicalCatalogToOptions,
  customOptionForQuery,
  fertigationPlanItemsToOptions,
  fertilizerCatalogToOptions,
  filterAndRankOptions,
  normalizeSearchText,
  orgPlanHistoryToOptions,
  professionalPlanPickerSources,
  planItemsToOptions,
  recentItemsToOptions,
  type SearchSelectOption,
} from '@/components/ui/search-select-logic';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { ChemicalMix, ChemicalMixComponent } from '@/types/phi';
import type { MasterCatalogProduct } from '@/types/catalog';

// search-select-logic reuses the per-liter dose normalizer from phi-service,
// whose module graph reaches the supabase client.
jest.mock('@/data-access', () => {
  const dataAccess = { from: jest.fn() };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

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
  product_id: null,
  quantity_basis: null,
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

const catalogProduct = (overrides: Partial<MasterCatalogProduct>): MasterCatalogProduct => ({
  id: 500,
  name: '19:19:19',
  manufacturer: 'IFFCO',
  active_ingredient: null,
  input_type: 'fertilizer',
  verification_tier: 'verified',
  formulation: null,
  state_code: 'MH',
  source_reference: null,
  is_active: true,
  aliases: [],
  compositions: [
    {
      id: 1,
      product_id: 500,
      component_code: 'N',
      component_type: 'nutrient',
      percent: 19,
      basis: 'declared',
      verified: true,
    },
    {
      id: 2,
      product_id: 500,
      component_code: 'P2O5',
      component_type: 'nutrient',
      percent: 19,
      basis: 'declared',
      verified: true,
    },
  ],
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

  it('unifies composed and decomposed Unicode forms (NFC)', () => {
    // Latin: precomposed é (U+00E9) vs e + combining acute (U+0065 U+0301).
    const latinComposed = 'café';
    const latinDecomposed = 'café';
    expect(latinComposed).not.toBe(latinDecomposed); // genuinely distinct forms
    expect(normalizeSearchText(latinComposed)).toBe(normalizeSearchText(latinDecomposed));

    // Devanagari: क़ QA (U+0958) is a composition exclusion — NFC *decomposes*
    // it — so both it and क + nukta (U+0915 U+093C) normalize to क + nukta.
    const devanagariPrecomposed = 'क़';
    const devanagariDecomposed = 'क़';
    expect(devanagariPrecomposed).not.toBe(devanagariDecomposed);
    expect(normalizeSearchText(devanagariPrecomposed)).toBe(
      normalizeSearchText(devanagariDecomposed),
    );
  });

  it('matches queries across Unicode normalization forms', () => {
    // Option named in one form is found by a query typed in the other.
    const options = [option('café mix'), option('क़ीटनाशक')];
    expect(filterAndRankOptions(options, 'café').map((entry) => entry.name)).toEqual(['café mix']);
    expect(filterAndRankOptions(options, 'क़').map((entry) => entry.name)).toEqual(['क़ीटनाशक']);
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

  it('keys rows by identity (not list index), falling back to name::unit', () => {
    const options = recentItemsToOptions([
      recent({ catalogProductId: 5 }),
      recent({ name: 'Warehouse thing', warehouseItemId: 9 }),
      recent({ name: 'Legacy', unit: 'ml' }),
    ]);
    expect(options.map((entry) => entry.key)).toEqual([
      'history:p5',
      'history:w9',
      'history:nLegacy::ml',
    ]);
    // Keys do not shift when earlier rows are filtered out.
    const filtered = recentItemsToOptions([
      recent({ name: '  ' }),
      recent({ name: 'Legacy', unit: 'ml' }),
    ]);
    expect(filtered.map((entry) => entry.key)).toEqual(['history:nLegacy::ml']);
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
          // Phase W: catalogProductId forwarded from plan item's product_id.
          // The default planItem fixture has no product_id → null.
          catalogProductId: null,
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

  it('does not prefill quantity when the unit is missing (default-unit meaning change)', () => {
    const options = planItemsToOptions([
      planItem({ unit: null }),
      planItem({ id: 'plan-item-2', unit: '   ' }),
    ]);
    expect(options[0].selection.prefill).toEqual({ quantity: null, unit: null });
    expect(options[1].selection.prefill).toEqual({ quantity: null, unit: null });
  });

  it('does not prefill a zero or negative quantity (instantly-invalid row)', () => {
    const options = planItemsToOptions([
      planItem({ quantity: 0 }),
      planItem({ id: 'plan-item-2', quantity: -3 }),
    ]);
    expect(options[0].selection.prefill).toEqual({ quantity: null, unit: 'kg/acre' });
    expect(options[1].selection.prefill).toEqual({ quantity: null, unit: 'kg/acre' });
  });

  it('prefills both quantity and unit for a valid prescribed dose', () => {
    const options = planItemsToOptions([planItem({})]);
    expect(options[0].selection.prefill).toEqual({ quantity: 5, unit: 'kg/acre' });
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

describe('separator folding (issue #196)', () => {
  it("folds ':' and '-' so NPK-grade spellings normalize identically", () => {
    expect(normalizeSearchText('19:19:19')).toBe(normalizeSearchText('19-19-19'));
    expect(normalizeSearchText('19:19:19')).toBe('19 19 19');
  });

  it('a "19:19:19" query matches a "19-19-19" option and vice versa', () => {
    const options = [option('19-19-19'), option('Urea')];
    expect(filterAndRankOptions(options, '19:19:19').map((entry) => entry.name)).toEqual([
      '19-19-19',
    ]);
    const reversed = [option('19:19:19'), option('Urea')];
    expect(filterAndRankOptions(reversed, '19-19-19').map((entry) => entry.name)).toEqual([
      '19:19:19',
    ]);
  });
});

describe('fertigationPlanItemsToOptions', () => {
  it('stamps planItemId and resolves the prefill through the plan contract', () => {
    const options = fertigationPlanItemsToOptions([planItem({})]);
    expect(options).toEqual([
      {
        key: 'plan:plan-item-1',
        name: '19:19:19',
        detail: '5 kg/acre',
        selection: {
          kind: 'item',
          name: '19:19:19',
          planItemId: 'plan-item-1',
          // Phase W: catalogProductId is forwarded from plan item's product_id.
          // Null for the default fixture (no product_id set).
          catalogProductId: null,
          isCustom: false,
          prefill: { quantity: 5, unit: 'kg', quantityBasis: 'per_acre' },
        },
      },
    ]);
  });

  it("keeps per_acre for bare form units ('kg' ≡ 'kg/acre' on a plan item)", () => {
    const [entry] = fertigationPlanItemsToOptions([planItem({ unit: 'kg' })]);
    expect(entry.selection.prefill).toEqual({ quantity: 5, unit: 'kg', quantityBasis: 'per_acre' });
  });

  it('carries verbatim/unknown units through unchanged — never coerced to kg', () => {
    const [ppm] = fertigationPlanItemsToOptions([planItem({ unit: 'ppm', quantity: 100 })]);
    // Phase W: ppm is per_liter_water in the kernel; stored directly now.
    expect(ppm.selection.prefill).toEqual({
      quantity: 100,
      unit: 'ppm',
      quantityBasis: 'per_liter_water',
    });
    const [unknown] = fertigationPlanItemsToOptions([planItem({ unit: 'banana/acre' })]);
    expect(unknown.selection.prefill).toEqual({
      quantity: 5,
      unit: 'banana/acre',
      quantityBasis: 'per_acre',
    });
  });

  it('skips nameless items and never prefills a non-positive quantity', () => {
    const options = fertigationPlanItemsToOptions([
      planItem({ id: 'a', name: '  ' }),
      planItem({ id: 'b', quantity: 0 }),
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].selection.prefill).toEqual({
      quantity: null,
      unit: 'kg',
      quantityBasis: 'per_acre',
    });
  });
});

describe('fertilizerCatalogToOptions', () => {
  it('maps products with the canonical name, identity, and nutrient composition', () => {
    const options = fertilizerCatalogToOptions([catalogProduct({})]);
    expect(options).toEqual([
      {
        key: 'product:500',
        name: '19:19:19',
        detail: 'IFFCO',
        keywords: ['IFFCO'],
        selection: {
          kind: 'item',
          name: '19:19:19',
          catalogProductId: 500,
          isCustom: false,
          composition: [
            { nutrient_code: 'N', percent: 19, basis: 'declared' },
            { nutrient_code: 'P2O5', percent: 19, basis: 'declared' },
          ],
        },
      },
    ]);
    // No dose prefill: the catalog carries no dose.
    expect(options[0].selection.prefill).toBeUndefined();
  });

  it('is findable via aliases and active ingredient (matchable, never stored)', () => {
    const options = fertilizerCatalogToOptions([
      catalogProduct({
        aliases: [
          {
            id: 9,
            product_id: 500,
            alias: 'NPK GR-2',
            locale: 'en',
            alias_kind: 'trade',
          },
        ],
        active_ingredient: 'Chelated Zinc',
      }),
    ]);
    expect(filterAndRankOptions(options, 'gr-2')).toHaveLength(1);
    expect(filterAndRankOptions(options, 'chelated')).toHaveLength(1);
    expect(options[0].selection.name).toBe('19:19:19');
  });

  it('only nutrient component rows enter the composition snapshot', () => {
    const product = catalogProduct({
      compositions: [
        {
          id: 1,
          product_id: 500,
          component_code: 'Zn',
          component_type: 'nutrient',
          percent: 12,
          basis: 'declared',
          verified: true,
        },
        {
          id: 2,
          product_id: 500,
          component_code: 'EDTA',
          component_type: 'active_ingredient',
          percent: 40,
          basis: 'declared',
          verified: true,
        },
      ],
    });
    expect(catalogCompositionToSnapshot(product)).toEqual([
      { nutrient_code: 'Zn', percent: 12, basis: 'declared' },
    ]);
    expect(catalogCompositionToSnapshot(catalogProduct({ compositions: [] }))).toBeNull();
  });

  it('degrades gracefully: empty catalog yields no options (section hidden)', () => {
    expect(fertilizerCatalogToOptions([])).toEqual([]);
  });

  describe('recommended-dose prefill (issue #236)', () => {
    it('prefills the foliar midpoint when a product carries foliar guidance', () => {
      const options = fertilizerCatalogToOptions([
        catalogProduct({
          doseGuidance: [
            {
              applicationRoute: 'foliar',
              minValue: 3,
              maxValue: 6,
              unit: 'g/L',
              sourceNote: 'label',
            },
          ],
        }),
      ]);
      // Midpoint of 3–6 = 4.5, rounded to 2dp; unit kept verbatim (g/L).
      expect(options[0].selection.prefill).toEqual({ quantity: 4.5, unit: 'g/L' });
      // Detail carries the ≈ midpoint + the raw range.
      expect(options[0].detail).toContain('≈ 4.5 g');
      expect(options[0].detail).toContain('3–6 g/L');
    });

    it('carries no prefill when the product has no guidance (regression)', () => {
      const options = fertilizerCatalogToOptions([catalogProduct({})]);
      expect(options[0].selection.prefill).toBeUndefined();
    });

    it('ignores non-foliar guidance for the prefill (drip/soil are not foliar doses)', () => {
      const options = fertilizerCatalogToOptions([
        catalogProduct({
          doseGuidance: [
            {
              applicationRoute: 'drip',
              minValue: 1.25,
              maxValue: 2.5,
              unit: 'kg/ha',
              sourceNote: 'label',
            },
          ],
        }),
      ]);
      expect(options[0].selection.prefill).toBeUndefined();
    });
  });
});

describe('orgPlanHistoryToOptions', () => {
  it('dedupes by normalized name (case, whitespace, and separator variants)', () => {
    const options = orgPlanHistoryToOptions([
      { name: '19:19:19', quantity: 5, unit: 'kg/acre' },
      { name: '19-19-19', quantity: 3, unit: 'kg/acre' },
      { name: ' urea ', quantity: 25, unit: 'kg/acre' },
      { name: 'Urea', quantity: 10, unit: 'kg/acre' },
    ]);
    expect(options.map((entry) => entry.name)).toEqual(['19:19:19', 'urea']);
    // Newest-first input: the most recent spelling and dose win.
    expect(options[0].detail).toBe('5 kg/acre');
    expect(options[1].detail).toBe('25 kg/acre');
  });

  it('carries the last prescribed dose as prefill, null catalogProductId when absent', () => {
    const [entry] = orgPlanHistoryToOptions([{ name: 'MAP', quantity: 4, unit: 'kg/acre' }]);
    // Phase W: catalogProductId is always present in the selection shape.
    // Legacy items (no catalogProductId on the source) receive null.
    expect(entry.selection).toEqual({
      kind: 'item',
      name: 'MAP',
      catalogProductId: null,
      isCustom: false,
      prefill: { quantity: 4, unit: 'kg/acre' },
    });
  });

  it('skips blank names; missing doses stay unprefilled', () => {
    const options = orgPlanHistoryToOptions([
      { name: '   ', quantity: 5, unit: 'kg/acre' },
      { name: 'DAP', quantity: null, unit: null },
      { name: 'SOP', quantity: 0, unit: 'kg/acre' },
    ]);
    expect(options).toHaveLength(2);
    expect(options[0].selection.prefill).toEqual({ quantity: null, unit: null });
    expect(options[0].detail).toBeNull();
    // Zero/negative doses never prefill (instantly-invalid row).
    expect(options[1].selection.prefill).toEqual({ quantity: null, unit: 'kg/acre' });
  });

  it('recovers catalog identity when a newer custom row shadows an older catalog one', () => {
    // Newest-first feed: a consultant typed "MAP" custom in a recent plan
    // (no product_id), but an older plan prescribed the catalog MAP (id 42).
    // The newest row's dose still wins, but identity must be recovered from
    // the older row so re-picking restores product_id (else compliance would
    // silently fall back to name matching).
    const options = orgPlanHistoryToOptions([
      { name: 'MAP', quantity: 6, unit: 'kg/acre', catalogProductId: null },
      { name: 'MAP', quantity: 5, unit: 'kg/acre', catalogProductId: 42 },
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].detail).toBe('6 kg/acre'); // newest dose kept
    expect(options[0].selection.catalogProductId).toBe(42); // identity recovered
  });

  it('keeps the newest row identity when it already carries one', () => {
    // The newest catalog pick wins outright — an older different id never
    // overwrites a present one.
    const options = orgPlanHistoryToOptions([
      { name: 'MAP', quantity: 6, unit: 'kg/acre', catalogProductId: 42 },
      { name: 'MAP', quantity: 5, unit: 'kg/acre', catalogProductId: 99 },
    ]);
    expect(options).toHaveLength(1);
    expect(options[0].selection.catalogProductId).toBe(42);
  });
});

describe('professionalPlanPickerSources', () => {
  it('offers past prescriptions without master-catalog products', () => {
    const sources = professionalPlanPickerSources([
      { name: 'Calcium Nitrate', quantity: 5, unit: 'kg/acre' },
    ]);

    expect(sources.historyOptions.map((option) => option.name)).toEqual(['Calcium Nitrate']);
    expect(sources.catalogOptions).toEqual([]);
  });
});
