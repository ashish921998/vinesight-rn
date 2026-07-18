import {
  aggregateNutrientsBetweenPetioleTests,
  calculateNutrientTotalsForLog,
} from '@/services/nutrient-flow-service';
import type { FertigationRecord, NutrientCompositionItem, SprayRecord } from '@/types';
import { convertAreaToAcres } from '@/utils/preferences';

describe('nutrient-flow-service', () => {
  it('converts oxide nutrients to elemental totals', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 10,
          unit: 'kg',
          quantity_basis: 'total',
          composition_snapshot: [{ nutrient_code: 'P2O5', percent: 100, basis: 'declared' }],
        },
      ],
      areaAcre: 2,
    });

    expect(result.nutrientTotalsElemental.P).toBeCloseTo(4.364, 6);
    expect(result.nutrientTotalsElementalPerAcre.P).toBeCloseTo(2.182, 6);
    expect(result.coveragePercent).toBe(100);
  });

  it('converts mixed-case oxide codes (MgO) — never a factor-1 fallback bucket', () => {
    // Sanitize uppercases codes before the factors lookup; a mixed-case map
    // key would miss and silently credit 16 kg MgO as 1.6 kg of literal 'MGO'.
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

  it('handles concentration unit gm/L with water volume', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 2,
          unit: 'gm/L',
          quantity_basis: 'total',
          composition_snapshot: [{ nutrient_code: 'N', percent: 50, basis: 'declared' }],
        },
      ],
      areaAcre: 1,
      waterVolumeL: 200,
    });

    // 2 gm/L * 200 L = 400 g = 0.4 kg product, 50% N => 0.2 kg N
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.2, 6);
  });

  it('handles concentration unit gm/liter with water volume', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 2,
          unit: 'gm/liter',
          quantity_basis: 'total',
          composition_snapshot: [{ nutrient_code: 'N', percent: 50, basis: 'declared' }],
        },
      ],
      areaAcre: 1,
      waterVolumeL: 200,
    });

    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.2, 6);
  });

  it('applies per-acre quantity basis correctly', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 5,
          unit: 'kg',
          quantity_basis: 'per_acre',
          composition_snapshot: [{ nutrient_code: 'K2O', percent: 50, basis: 'declared' }],
        },
      ],
      areaAcre: 3,
    });

    // 5 kg/acre * 3 acre = 15 kg product, 50% K2O => 7.5 kg K2O => *0.8301 = 6.22575 kg K
    expect(result.nutrientTotalsElemental.K).toBeCloseTo(6.22575, 6);
    expect(result.nutrientTotalsElementalPerAcre.K).toBeCloseTo(2.07525, 6);
  });

  it('handles litre/acre units directly', () => {
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 1,
          unit: 'litre/acre',
          quantity_basis: 'total',
          density_kg_per_l: 1,
          composition_snapshot: [{ nutrient_code: 'N', percent: 10, basis: 'declared' }],
        },
      ],
      areaAcre: 2,
    });

    // 1 litre/acre * 2 acre = 2 liter product = 2kg (density 1), 10% N => 0.2kg total, 0.1kg/acre
    expect(result.nutrientTotalsElemental.N).toBeCloseTo(0.2, 6);
    expect(result.nutrientTotalsElementalPerAcre.N).toBeCloseTo(0.1, 6);
  });

  it('aggregates interval totals and log-level coverage', () => {
    const sprayRecords: SprayRecord[] = [
      {
        id: 1,
        farm_id: 1,
        date: '2026-01-05',
        chemical: 'A',
        dose: 'Water: 100L',
        area: 1,
        weather: '',
        operator: '',
        nutrient_totals_elemental_per_acre: { N: 1 },
        nutrient_calc_coverage: 100,
      },
      {
        id: 2,
        farm_id: 1,
        date: '2026-01-15',
        chemical: 'B',
        dose: 'Water: 100L',
        area: 1,
        weather: '',
        operator: '',
        nutrient_totals_elemental_per_acre: { N: 2 },
        nutrient_calc_coverage: 100,
      },
    ];

    const fertigationRecords: FertigationRecord[] = [
      {
        id: 11,
        farm_id: 1,
        date: '2026-01-08',
        fertilizers: [{ name: 'Unknown', unit: 'kg', quantity: 10 }],
        area: 1,
        nutrient_calc_coverage: 0,
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-01-01', '2026-01-10', '2026-01-20'],
      sprayRecords,
      fertigationRecords,
      areaUnit: 'acres',
    });

    expect(intervals).toHaveLength(2);
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(1, 6);
    expect(intervals[0]?.coveragePercent).toBeCloseTo(50, 2);
    expect(intervals[1]?.totalsPerAcre.N).toBeCloseTo(2, 6);
    expect(intervals[1]?.coveragePercent).toBeCloseTo(100, 2);
  });

  it('uses computed fallback coverage when coverage is missing but item snapshots are partial', () => {
    const fertigationRecords: FertigationRecord[] = [
      {
        id: 21,
        farm_id: 1,
        date: '2026-01-05',
        fertilizers: [
          {
            name: 'With Snapshot',
            unit: 'kg',
            quantity: 10,
            composition_snapshot: [{ nutrient_code: 'N', percent: 10, basis: 'declared' }],
          },
          {
            name: 'Without Snapshot',
            unit: 'kg',
            quantity: 10,
            composition_snapshot: null,
          },
        ],
        area: 2,
      },
    ];

    const intervals = aggregateNutrientsBetweenPetioleTests({
      testDates: ['2026-01-01', '2026-01-10'],
      sprayRecords: [],
      fertigationRecords,
      areaUnit: 'acres',
    });

    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(0.5, 6);
    // one log in interval, but only 50% item coverage => this log is not "fully covered"
    expect(intervals[0]?.coveragePercent).toBeCloseTo(0, 2);
  });

  // ─── issue #257: hectares-farm recomputation in the read path ───────────
  //
  // resolveSprayTotalsPerAcre / resolveFertigationTotalsPerAcre must convert
  // record.area (raw hectares) to canonical acres before feeding the nutrient
  // kernel. Per-acre totals must match convertAreaToAcres-based expectations,
  // not raw-hectare denominators.
  describe('aggregateNutrientsBetweenPetioleTests — hectares farms (issue #257)', () => {
    const farmAreaHa = 2;
    const farmAreaAcres = convertAreaToAcres(farmAreaHa, 'hectares');
    const N_COMPOSITION: NutrientCompositionItem[] = [
      { nutrient_code: 'N', percent: 100, basis: 'declared' },
    ];

    it('spray: total-basis item recomputes per-acre against converted acres', () => {
      const sprayRecords: SprayRecord[] = [
        {
          id: 1,
          farm_id: 1,
          date: '2026-01-05',
          chemical: 'Urea',
          dose: '',
          area: farmAreaHa,
          weather: '',
          operator: '',
          chemical_items: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 10,
              quantity_basis: 'total',
              composition_snapshot: N_COMPOSITION,
            },
          ],
        },
      ];

      const intervals = aggregateNutrientsBetweenPetioleTests({
        testDates: ['2026-01-01', '2026-01-10'],
        sprayRecords,
        fertigationRecords: [],
        areaUnit: 'hectares',
      });

      expect(intervals).toHaveLength(1);
      // 10 kg N total ÷ 4.942… acres = 2.023… kg/acre
      expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(10 / farmAreaAcres, 4);
      expect(intervals[0]?.coveragePercent).toBeCloseTo(100, 2);
    });

    it('fertigation: total-basis item recomputes per-acre against converted acres', () => {
      const fertigationRecords: FertigationRecord[] = [
        {
          id: 11,
          farm_id: 1,
          date: '2026-01-05',
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 10,
              quantity_basis: 'total',
              composition_snapshot: N_COMPOSITION,
            },
          ],
          area: farmAreaHa,
        },
      ];

      const intervals = aggregateNutrientsBetweenPetioleTests({
        testDates: ['2026-01-01', '2026-01-10'],
        sprayRecords: [],
        fertigationRecords,
        areaUnit: 'hectares',
      });

      expect(intervals).toHaveLength(1);
      expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(10 / farmAreaAcres, 4);
    });

    it('spray: per_acre-basis item recomputes plot total against converted acres', () => {
      // Stored quantity is the canonical per-acre rate (2.023… kg/acre). The
      // kernel multiplies by converted acres (4.942…) for the plot total, then
      // divides back to the same per-acre rate.
      const storedPerAcreRate = 5 * 0.404686;
      const sprayRecords: SprayRecord[] = [
        {
          id: 2,
          farm_id: 1,
          date: '2026-01-05',
          chemical: 'Urea',
          dose: '',
          area: farmAreaHa,
          weather: '',
          operator: '',
          chemical_items: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: storedPerAcreRate,
              quantity_basis: 'per_acre',
              composition_snapshot: N_COMPOSITION,
            },
          ],
        },
      ];

      const intervals = aggregateNutrientsBetweenPetioleTests({
        testDates: ['2026-01-01', '2026-01-10'],
        sprayRecords,
        fertigationRecords: [],
        areaUnit: 'hectares',
      });

      expect(intervals).toHaveLength(1);
      // Per-acre stays at the canonical stored rate.
      expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(storedPerAcreRate, 4);
    });

    it('fertigation: per_acre-basis item recomputes plot total against converted acres', () => {
      const storedPerAcreRate = 5 * 0.404686;
      const fertigationRecords: FertigationRecord[] = [
        {
          id: 12,
          farm_id: 1,
          date: '2026-01-05',
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: storedPerAcreRate,
              quantity_basis: 'per_acre',
              composition_snapshot: N_COMPOSITION,
            },
          ],
          area: farmAreaHa,
        },
      ];

      const intervals = aggregateNutrientsBetweenPetioleTests({
        testDates: ['2026-01-01', '2026-01-10'],
        sprayRecords: [],
        fertigationRecords,
        areaUnit: 'hectares',
      });

      expect(intervals).toHaveLength(1);
      expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(storedPerAcreRate, 4);
    });

    it('records without items use persisted totals unchanged regardless of areaUnit', () => {
      // No items → the persisted nutrient_totals_elemental_per_acre is used
      // verbatim; areaUnit must not perturb it.
      const fertigationRecords: FertigationRecord[] = [
        {
          id: 13,
          farm_id: 1,
          date: '2026-01-05',
          fertilizers: [],
          area: farmAreaHa,
          nutrient_totals_elemental_per_acre: { N: 3.3 },
          nutrient_calc_coverage: 100,
        },
      ];

      const intervals = aggregateNutrientsBetweenPetioleTests({
        testDates: ['2026-01-01', '2026-01-10'],
        sprayRecords: [],
        fertigationRecords,
        areaUnit: 'hectares',
      });

      expect(intervals).toHaveLength(1);
      expect(intervals[0]?.totalsPerAcre.N).toBeCloseTo(3.3, 4);
    });
  });
});
