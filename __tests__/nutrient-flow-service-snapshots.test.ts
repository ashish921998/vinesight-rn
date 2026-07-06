/**
 * Snapshot / golden tests for nutrient-flow-service.ts (issue #200, step 1).
 *
 * Purpose: lock the current `calculateNutrientTotalsForLog` and
 * `aggregateNutrientsBetweenPetioleTests` outputs BEFORE the parser swap so
 * that the swap (toProductMassKg → kernel totalFor) can be verified to
 * preserve semantics. If a test changes after the swap, it is either a genuine
 * pre-existing bug that must be documented rather than silently fixed, or an
 * unintended regression.
 *
 * All figures are hand-verified against the toProductMassKg logic in the
 * service as of the time these tests were written.
 */

import {
  calculateNutrientTotalsForLog,
  aggregateNutrientsBetweenPetioleTests,
} from '@/services/nutrient-flow-service';
import type { FertigationRecord, SprayRecord } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const N_ONLY = [{ nutrient_code: 'N', percent: 10, basis: 'declared' as const }];
const NPK = [
  { nutrient_code: 'N', percent: 20, basis: 'declared' as const },
  { nutrient_code: 'P2O5', percent: 30, basis: 'declared' as const },
  { nutrient_code: 'K2O', percent: 40, basis: 'declared' as const },
];

// ─── calculateNutrientTotalsForLog snapshots ─────────────────────────────────

describe('calculateNutrientTotalsForLog — snapshot / golden vectors', () => {
  // ── bare mass units ──────────────────────────────────────────────────────

  it('SNAP: bare kg, N-only, total basis', () => {
    // 10 kg product × 10% N = 1.0 kg N
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 10, unit: 'kg', quantity_basis: 'total', composition_snapshot: N_ONLY }],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(1.0, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.5, 6);
    expect(result.coveragePercent).toBe(100);
    expect(result.itemCount).toBe(1);
    expect(result.composedItemCount).toBe(1);
  });

  it('SNAP: bare gm, N-only, total basis', () => {
    // 500 gm = 0.5 kg × 10% N = 0.05 kg N
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 500, unit: 'gm', quantity_basis: 'total', composition_snapshot: N_ONLY }],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.05, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.025, 6);
  });

  it('SNAP: bare gram, N-only, total basis (alias)', () => {
    // Same as gm — alias test
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 500, unit: 'gram', quantity_basis: 'total', composition_snapshot: N_ONLY },
      ],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.05, 6);
  });

  it('SNAP: bare liter, N-only, density 1.2', () => {
    // 5 L × 1.2 kg/L = 6 kg × 10% N = 0.6 kg N
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 5,
          unit: 'liter',
          quantity_basis: 'total',
          density_kg_per_l: 1.2,
          composition_snapshot: N_ONLY,
        },
      ],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.6, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.3, 6);
  });

  it('SNAP: bare L (uppercase alias), N-only, default density', () => {
    // 5 L × 1.0 (default) = 5 kg × 10% N = 0.5 kg N
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 5, unit: 'L', quantity_basis: 'total', composition_snapshot: N_ONLY }],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.5, 6);
  });

  it('SNAP: bare ml, N-only, default density', () => {
    // 500 ml × 1.0 kg/L ÷ 1000 = 0.5 kg × 10% N = 0.05 kg N
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 500, unit: 'ml', quantity_basis: 'total', composition_snapshot: N_ONLY }],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.05, 6);
  });

  // ── per-acre / rate units ────────────────────────────────────────────────

  it('SNAP: kg per_acre basis, 3 acres, N-only', () => {
    // 5 kg/acre × 3 acres = 15 kg × 10% N = 1.5 kg N; per-acre = 0.5
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 5, unit: 'kg', quantity_basis: 'per_acre', composition_snapshot: N_ONLY },
      ],
      areaAcre: 3,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(1.5, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.5, 6);
  });

  it('SNAP: litre/acre unit with areaAcre', () => {
    // 1 litre/acre × 2 acres = 2 L × 1.0 = 2 kg × 10% N = 0.2 kg; per-acre = 0.1
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 1,
          unit: 'litre/acre',
          quantity_basis: 'total',
          density_kg_per_l: 1,
          composition_snapshot: N_ONLY,
        },
      ],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.2, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.1, 6);
  });

  // ── concentration × water volume ────────────────────────────────────────

  it('SNAP: gm/L concentration × waterVolumeL', () => {
    // 2 gm/L × 200 L = 400 g = 0.4 kg × 10% N = 0.04 kg N
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 2, unit: 'gm/L', quantity_basis: 'total', composition_snapshot: N_ONLY },
      ],
      areaAcre: 1,
      waterVolumeL: 200,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.04, 6);
  });

  it('SNAP: gm/liter concentration (alias) × waterVolumeL', () => {
    // same as gm/L
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 2, unit: 'gm/liter', quantity_basis: 'total', composition_snapshot: N_ONLY },
      ],
      areaAcre: 1,
      waterVolumeL: 200,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.04, 6);
  });

  it('SNAP: ml/L concentration × density × waterVolumeL', () => {
    // 5 ml/L × 200 L = 1000 ml ÷ 1000 = 1.0 L × 1.0 kg/L = 1 kg × 10% N = 0.1 kg N
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 5,
          unit: 'ml/l',
          quantity_basis: 'total',
          density_kg_per_l: 1.0,
          composition_snapshot: N_ONLY,
        },
      ],
      areaAcre: 1,
      waterVolumeL: 200,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.1, 6);
  });

  it('SNAP: ppm × waterVolumeL', () => {
    // 500 ppm × 100 L ÷ 1_000_000 = 0.05 kg × 10% N = 0.005 kg N
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 500, unit: 'ppm', quantity_basis: 'total', composition_snapshot: N_ONLY }],
      areaAcre: 1,
      waterVolumeL: 100,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.005, 6);
  });

  // ── oxide conversion ────────────────────────────────────────────────────

  it('SNAP: NPK product with P2O5 and K2O oxides', () => {
    // 10 kg, 20% N → 2 kg N; 30% P2O5 → 3 kg × 0.4364 = 1.3092 kg P;
    // 40% K2O → 4 kg × 0.8301 = 3.3204 kg K
    const result = calculateNutrientTotalsForLog({
      items: [{ quantity: 10, unit: 'kg', quantity_basis: 'total', composition_snapshot: NPK }],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(2, 5);
    expect(result.nutrientTotalsElemental.P).toBeCloseTo(1.3092, 4);
    expect(result.nutrientTotalsElemental.K).toBeCloseTo(3.3204, 4);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(1, 5);
    expect(result.nutrientTotalsElementalPerAcre.P).toBeCloseTo(0.6546, 4);
    expect(result.nutrientTotalsElementalPerAcre.K).toBeCloseTo(1.6602, 4);
  });

  it('SNAP: MgO converts to Mg (mixed-case handled by sanitize)', () => {
    // 10 kg, 16% MgO → 1.6 kg × 0.6031 = 0.96496 kg Mg
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 10,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: [{ nutrient_code: 'MgO', percent: 16, basis: 'declared' }],
        },
      ],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.Mg).toBeCloseTo(10 * 0.16 * 0.6031, 6);
    expect(result.nutrientTotalsElemental.MGO).toBeUndefined();
    expect(result.nutrientTotalsElemental.MgO).toBeUndefined();
  });

  // ── coverage honesty ────────────────────────────────────────────────────

  it('SNAP: one item with snapshot, one without — coverage 50%', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 10,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: N_ONLY,
        },
        {
          quantity: 10,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: null,
        },
      ],
      areaAcre: 2,
    });
    // Only the first item contributes nutrients
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(1.0, 6);
    expect(result.itemCount).toBe(2);
    expect(result.composedItemCount).toBe(1);
    expect(result.coveragePercent).toBe(50);
  });

  it('SNAP: all items without snapshots — 0% coverage, empty totals', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 10, unit: 'kg', quantity_basis: 'total', composition_snapshot: null },
        { quantity: 5, unit: 'kg', quantity_basis: 'total', composition_snapshot: [] },
      ],
      areaAcre: 1,
    });
    expect(result.itemCount).toBe(2);
    expect(result.composedItemCount).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(Object.keys(result.nutrientTotalsElemental)).toHaveLength(0);
  });

  it('SNAP: unknown unit — item excluded from totals, counted in coverage denominator', () => {
    // 'bag' is not a known unit in toProductMassKg (switch default → null).
    // The current code flow: itemCount increments for both items; composedItemCount
    // only increments when productMassKg is non-null and > 0. So:
    //   - 'bag': itemCount+=1, composition present but toProductMassKg returns null
    //     → composedItemCount stays 0 for this item
    //   - 'kg':  itemCount+=1, composedItemCount+=1
    // coveragePercent = 1/2 = 50%.
    // PRE-EXISTING BEHAVIOR (documented, NOT silently changed):
    // composedItemCount tracks successful mass resolution, not just snapshot presence.
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 2,
          unit: 'bag',
          quantity_basis: 'total',
          composition_snapshot: N_ONLY,
        },
        {
          quantity: 10,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: N_ONLY,
        },
      ],
      areaAcre: 1,
    });
    expect(result.itemCount).toBe(2);
    expect(result.composedItemCount).toBe(1); // only the kg item resolved
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(1.0, 6); // only kg item
    expect(result.coveragePercent).toBe(50); // 1/2
  });

  // ── multi-item accumulation ─────────────────────────────────────────────

  it('SNAP: two items accumulate correctly', () => {
    // Item 1: 10 kg × 10% N = 1 kg N
    // Item 2: 5 kg × 20% N = 1 kg N
    // Total: 2 kg N, per-acre (÷2): 1 kg N/acre
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 10, unit: 'kg', quantity_basis: 'total', composition_snapshot: N_ONLY },
        {
          quantity: 5,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: [{ nutrient_code: 'N', percent: 20, basis: 'declared' }],
        },
      ],
      areaAcre: 2,
    });
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(2, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(1, 6);
    expect(result.coveragePercent).toBe(100);
  });

  // ── null guards ─────────────────────────────────────────────────────────

  it('SNAP: concentration unit without water volume → item excluded', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        { quantity: 2, unit: 'gm/L', quantity_basis: 'total', composition_snapshot: N_ONLY },
      ],
      areaAcre: 1,
      waterVolumeL: null,
    });
    // No water volume → toProductMassKg returns null → no nutrient contribution
    expect(Object.keys(result.nutrientTotalsElemental)).toHaveLength(0);
    expect(result.composedItemCount).toBe(0);
    // The item DID have a snapshot so itemCount=1, composedItemCount=0 — coverage 0%
    expect(result.itemCount).toBe(1);
    expect(result.coveragePercent).toBe(0);
  });
});

// ─── aggregateNutrientsBetweenPetioleTests snapshots ─────────────────────────

describe('aggregateNutrientsBetweenPetioleTests — snapshot / golden vectors', () => {
  it('SNAP: two intervals, persisted totals, explicit coverage', () => {
    const sprayRecords: SprayRecord[] = [
      {
        id: 1,
        farm_id: 1,
        date: '2026-01-05',
        chemical: 'A',
        dose: '',
        area: 1,
        weather: '',
        operator: '',
        nutrient_totals_elemental_per_acre: { N: 1.5, P: 0.3 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 2,
        farm_id: 1,
        date: '2026-01-15',
        chemical: 'B',
        dose: '',
        area: 1,
        weather: '',
        operator: '',
        nutrient_totals_elemental_per_acre: { N: 2.0, K: 0.8 },
        nutrient_calc_coverage: 100,
      },
    ];
    const fertigationRecords: FertigationRecord[] = [
      {
        id: 11,
        farm_id: 1,
        date: '2026-01-08',
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 0.5 },
        nutrient_calc_coverage: 100,
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-01-01', '2026-01-10', '2026-01-20'],
      sprayRecords,
      fertigationRecords,
    });

    expect(intervals).toHaveLength(2);

    // Interval 0: 2026-01-01 → 2026-01-10  (spray id=1 on 05, fertigation id=11 on 08)
    expect(intervals[0]?.fromDate).toBe('2026-01-01');
    expect(intervals[0]?.toDate).toBe('2026-01-10');
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(2.0, 4); // 1.5 + 0.5
    expect(intervals[0]?.totalsPerAcre.P).toBeCloseTo(0.3, 4);
    expect(intervals[0]?.coveragePercent).toBe(100);
    expect(intervals[0]?.totalLogCount).toBe(2);

    // Interval 1: 2026-01-10 → 2026-01-20  (spray id=2 on 15)
    expect(intervals[1]?.fromDate).toBe('2026-01-10');
    expect(intervals[1]?.toDate).toBe('2026-01-20');
    expect(intervals[1]?.totalsPerAcre.N).toBeCloseTo(2.0, 4);
    expect(intervals[1]?.totalsPerAcre.K).toBeCloseTo(0.8, 4);
    expect(intervals[1]?.coveragePercent).toBe(100);
    expect(intervals[1]?.totalLogCount).toBe(1);
  });

  it('SNAP: partial coverage — one full-coverage log, one zero-coverage log', () => {
    const fertigationRecords: FertigationRecord[] = [
      {
        id: 21,
        farm_id: 1,
        date: '2026-02-05',
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 1 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 22,
        farm_id: 1,
        date: '2026-02-07',
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: {},
        nutrient_calc_coverage: 0,
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-02-01', '2026-02-10'],
      sprayRecords: [],
      fertigationRecords,
    });

    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(1, 4);
    expect(intervals[0]?.coveragePercent).toBe(50);
    expect(intervals[0]?.totalLogCount).toBe(2);
  });

  it('SNAP: fewer than 2 test dates → empty result', () => {
    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-01-01'],
      sprayRecords: [],
      fertigationRecords: [],
    });
    expect(intervals).toHaveLength(0);
  });

  it('SNAP: records outside interval boundaries are excluded', () => {
    const fertigationRecords: FertigationRecord[] = [
      {
        id: 31,
        farm_id: 1,
        date: '2026-01-01', // exactly on fromDate — EXCLUDED (boundary: > fromDate)
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 99 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 32,
        farm_id: 1,
        date: '2026-01-05',
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 1 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 33,
        farm_id: 1,
        date: '2026-01-10', // exactly on toDate — INCLUDED (boundary: <= toDate)
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 2 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 34,
        farm_id: 1,
        date: '2026-01-11', // outside interval — EXCLUDED
        fertilizers: [],
        area: 1,
        nutrient_totals_elemental_per_acre: { N: 99 },
        nutrient_calc_coverage: 100,
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-01-01', '2026-01-10'],
      sprayRecords: [],
      fertigationRecords,
    });

    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(3, 4); // only id=32 + id=33
    expect(intervals[0]?.totalLogCount).toBe(2);
  });

  it('SNAP: computed nutrient totals from items (no persisted nutrient_totals_elemental_per_acre)', () => {
    // The service computes live from items when items are present
    const fertigationRecords: FertigationRecord[] = [
      {
        id: 41,
        farm_id: 1,
        date: '2026-03-05',
        fertilizers: [
          {
            name: 'Urea',
            unit: 'kg',
            quantity: 10,
            composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
          },
        ],
        area: 2,
        // no nutrient_totals_elemental_per_acre — computed live
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-03-01', '2026-03-10'],
      sprayRecords: [],
      fertigationRecords,
    });

    expect(intervals).toHaveLength(1);
    // 10 kg × 46% N = 4.6 kg N; area=2 → 2.3 kg/acre
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(2.3, 4);
    expect(intervals[0]?.coveragePercent).toBe(100);
  });
});
