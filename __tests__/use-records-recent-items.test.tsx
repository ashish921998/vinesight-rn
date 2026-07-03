import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  dedupeRecentItems,
  parseRecentFertigationRecords,
  parseRecentSprayRecords,
  useRecentSprayChemicals,
  type RecentInputItem,
} from '@/hooks/use-records';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockedFrom = supabase.from as jest.Mock;

describe('parseRecentSprayRecords', () => {
  it('passes identity fields through and stamps the record-level catalog_mix_id on every row', () => {
    const rows = parseRecentSprayRecords([
      {
        chemical: 'ignored when items exist',
        catalog_mix_id: 77,
        chemical_items: [
          {
            name: ' Karate ',
            unit: ' ml/L ',
            quantity: 2,
            quantity_basis: 'per_acre',
            catalog_product_id: 5,
            warehouse_item_id: 9,
          },
          { name: 'Bavistin', unit: 'gm/L', quantity: 1.5, warehouse_item_id: 3 },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        name: 'Karate',
        unit: 'ml/L',
        quantity: 2,
        quantityBasis: 'per_acre',
        catalogProductId: 5,
        warehouseItemId: 9,
        catalogMixId: 77,
      },
      {
        name: 'Bavistin',
        unit: 'gm/L',
        quantity: 1.5,
        warehouseItemId: 3,
        catalogMixId: 77,
      },
    ]);
  });

  it('parses legacy item JSON without identity fields exactly as before', () => {
    const rows = parseRecentSprayRecords([
      {
        chemical: null,
        chemical_items: [
          { name: ' Karate ', unit: ' ml/L ', quantity: 2 },
          { name: 'NoQuantity', unit: 'gm/L', quantity: null },
        ],
      },
    ]);

    expect(rows).toEqual([
      { name: 'Karate', unit: 'ml/L', quantity: 2 },
      { name: 'NoQuantity', unit: 'gm/L', quantity: null },
    ]);
    // The exact legacy shape — no enumerable undefined identity keys, so a
    // `{ ...defaults, ...row }` consumer can never have defaults clobbered.
    expect(Object.keys(rows[0])).toEqual(['name', 'unit', 'quantity']);
    expect(Object.keys(rows[1])).toEqual(['name', 'unit', 'quantity']);
  });

  it('falls back to the legacy chemical display string and still stamps the mix id', () => {
    const rows = parseRecentSprayRecords([
      {
        chemical: 'Karate (2 ml/L), Bavistin (1.5 gm/L)',
        chemical_items: [],
        catalog_mix_id: 12,
      },
      { chemical: 'PlainName' },
    ]);

    expect(rows).toEqual([
      { name: 'Karate', unit: 'ml/L', quantity: 2, catalogMixId: 12 },
      { name: 'Bavistin', unit: 'gm/L', quantity: 1.5, catalogMixId: 12 },
      { name: 'PlainName', unit: 'gm/L', quantity: null },
    ]);
  });
});

describe('parseRecentFertigationRecords', () => {
  it('passes identity fields through when present in stored JSON', () => {
    const rows = parseRecentFertigationRecords([
      {
        fertilizers: [
          {
            name: ' Urea ',
            unit: 'kg/acre',
            quantity: 25,
            quantity_basis: 'per_acre',
            catalog_product_id: 41,
            warehouse_item_id: 8,
          },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        name: 'Urea',
        unit: 'kg/acre',
        quantity: 25,
        quantityBasis: 'per_acre',
        catalogProductId: 41,
        warehouseItemId: 8,
      },
    ]);
  });

  it('parses legacy rows without identity fields as before', () => {
    const rows = parseRecentFertigationRecords([
      { fertilizers: [{ name: '19:19:19', unit: 'kg/acre', quantity: 10 }] },
      { fertilizers: null },
    ]);

    expect(rows).toEqual([{ name: '19:19:19', unit: 'kg/acre', quantity: 10 }]);
    // Exact legacy shape — see the spray-side twin of this assertion.
    expect(Object.keys(rows[0])).toEqual(['name', 'unit', 'quantity']);
  });
});

describe('dedupeRecentItems', () => {
  const item = (overrides: Partial<RecentInputItem>): RecentInputItem => ({
    name: 'Urea',
    unit: 'kg/acre',
    quantity: 10,
    ...overrides,
  });

  it('collapses rows sharing a catalog product id even when the display name drifted', () => {
    const result = dedupeRecentItems([
      item({ name: '19:19:19', catalogProductId: 4, quantity: 12 }),
      item({ name: '19-19-19', catalogProductId: 4, quantity: 10 }),
    ]);

    // Most recent occurrence (first in the list) wins.
    expect(result).toEqual([item({ name: '19:19:19', catalogProductId: 4, quantity: 12 })]);
  });

  it('prefers catalogProductId over warehouseItemId as the identity key', () => {
    const result = dedupeRecentItems([
      item({ catalogProductId: 5, warehouseItemId: 9 }),
      item({ catalogProductId: 5, warehouseItemId: 8, quantity: 7 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].warehouseItemId).toBe(9);
  });

  it('keeps rows whose identity ids differ even when names match, and never conflates catalog with warehouse ids', () => {
    const result = dedupeRecentItems([
      item({ catalogProductId: 7 }),
      item({ catalogProductId: 8 }),
      item({ warehouseItemId: 7 }),
    ]);

    expect(result).toHaveLength(3);
  });

  it('still dedupes identity-less rows by normalized name and unit', () => {
    const result = dedupeRecentItems([
      item({ name: 'Urea ' }),
      item({ name: ' urea', quantity: 5 }),
      item({ name: 'urea', unit: 'liter/acre' }),
    ]);

    expect(result).toEqual([item({ name: 'Urea ' }), item({ name: 'urea', unit: 'liter/acre' })]);
  });

  it('drops a legacy identity-less row that shares a name with an already-kept identity row', () => {
    const result = dedupeRecentItems([
      item({ catalogProductId: 9 }),
      item({ name: ' UREA ', quantity: 5 }),
    ]);

    expect(result).toEqual([item({ catalogProductId: 9 })]);
  });

  it('keeps the most recent occurrence when a legacy row precedes an identity row of the same name', () => {
    const result = dedupeRecentItems([item({ quantity: 5 }), item({ catalogProductId: 9 })]);

    expect(result).toEqual([item({ quantity: 5 })]);
  });

  it('collapses identity vs legacy rows sharing a name even when their units differ', () => {
    // greptile P1 repro on #202: cross-group suppression must be name-only.
    const result = dedupeRecentItems([
      item({ unit: 'kg/acre', catalogProductId: 1 }),
      item({ unit: 'liter/acre', quantity: 5 }),
    ]);

    expect(result).toEqual([item({ unit: 'kg/acre', catalogProductId: 1 })]);
  });

  it('collapses cross-unit name matches in the reverse order too (most recent wins)', () => {
    const result = dedupeRecentItems([
      item({ unit: 'liter/acre', quantity: 5 }),
      item({ unit: 'kg/acre', catalogProductId: 1 }),
    ]);

    expect(result).toEqual([item({ unit: 'liter/acre', quantity: 5 })]);
  });

  it('skips blank names/units and respects the limit', () => {
    const result = dedupeRecentItems(
      [
        item({ name: '  ' }),
        item({ unit: '' }),
        item({ name: 'A' }),
        item({ name: 'B' }),
        item({ name: 'C' }),
      ],
      2,
    );

    expect(result.map((r) => r.name)).toEqual(['A', 'B']);
  });
});

/**
 * Chainable mock for `supabase.from(table).select(...).order(...).limit(...)[.eq(...)]`.
 * The chain is thenable so `await`-ing it resolves to `result`.
 */
function makeSelectChain(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[][]> = { select: [], order: [], limit: [], eq: [] };
  const chain: Record<string, unknown> = {};
  chain.then = (onFulfilled: ((v: unknown) => unknown) | null) =>
    Promise.resolve(result).then(onFulfilled);
  for (const method of Object.keys(calls)) {
    chain[method] = jest.fn((...args: unknown[]) => {
      calls[method].push(args);
      return chain;
    });
  }
  return { chain, calls };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useRecentSprayChemicals', () => {
  beforeEach(() => {
    mockedFrom.mockReset();
  });

  it('selects catalog_mix_id alongside chemical_items and stamps it onto deduped rows', async () => {
    const { chain, calls } = makeSelectChain({
      data: [
        {
          chemical: 'Karate (2 ml/L)',
          date: '2026-06-02',
          catalog_mix_id: 77,
          chemical_items: [{ name: 'Karate', unit: 'ml/L', quantity: 2, catalog_product_id: 5 }],
        },
        {
          chemical: 'Karate old (1 ml/L)',
          date: '2026-06-01',
          catalog_mix_id: null,
          chemical_items: [
            { name: 'Karate old name', unit: 'ml/L', quantity: 1, catalog_product_id: 5 },
          ],
        },
      ],
      error: null,
    });
    mockedFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useRecentSprayChemicals(3), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.select).toEqual([['chemical,date,chemical_items,catalog_mix_id']]);
    expect(calls.eq).toEqual([['farm_id', 3]]);
    // Both records share catalog_product_id 5 → identity dedupe keeps the most recent.
    expect(result.current.data).toEqual([
      {
        name: 'Karate',
        unit: 'ml/L',
        quantity: 2,
        catalogProductId: 5,
        catalogMixId: 77,
      },
    ]);
  });
});
