/**
 * calculateNutrientLedger — issue #200.
 *
 * Covers the report-facing aggregation the ledger section renders: period
 * filtering, dual-basis (elemental + bag-grade oxide) conversion, coverage
 * honesty, and the kernel-swap behavior delta for missing area context.
 */
import {
  calculateNutrientLedger,
  calculateNutrientTotalsForLog,
} from '@/services/nutrient-flow-service';
import type { FertigationRecord, SprayRecord } from '@/types';

const fertigation = (overrides: Partial<FertigationRecord>): FertigationRecord =>
  ({
    id: 1,
    farm_id: 1,
    date: '2026-03-05',
    fertilizers: [],
    area: 2,
    ...overrides,
  }) as FertigationRecord;

describe('calculateNutrientLedger — period + coverage + dual basis (issue #200)', () => {
  it('filters records to the date range, inclusive on both ends', () => {
    const records = [
      fertigation({
        id: 1,
        date: '2026-02-28', // before range — excluded
        fertilizers: [
          {
            name: 'Urea',
            unit: 'kg',
            quantity: 100,
            composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
          },
        ],
      }),
      fertigation({
        id: 2,
        date: '2026-03-01', // fromDate — included
        fertilizers: [
          {
            name: 'Urea',
            unit: 'kg',
            quantity: 10,
            composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
          },
        ],
      }),
      fertigation({
        id: 3,
        date: '2026-03-31', // toDate — included
        fertilizers: [
          {
            name: 'Urea',
            unit: 'kg',
            quantity: 20,
            composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
          },
        ],
      }),
    ];

    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: records,
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    // (10 + 20) kg × 46% N = 13.8 kg N; the February record never enters.
    const nitrogen = ledger.rows.find((row) => row.element === 'N');
    expect(nitrogen?.elementalKg).toBeCloseTo(13.8, 4);
    expect(nitrogen?.elementalKgPerAcre).toBeCloseTo(6.9, 4);
    expect(ledger.itemCount).toBe(2);
  });

  it('dual basis round-trips through the pinned factors (P₂O₅ / K₂O)', () => {
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'MKP 00:52:34',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [
                { nutrient_code: 'P2O5', percent: 52, basis: 'declared' },
                { nutrient_code: 'K2O', percent: 34, basis: 'declared' },
              ],
            },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    const phosphorus = ledger.rows.find((row) => row.element === 'P');
    const potassium = ledger.rows.find((row) => row.element === 'K');

    // Elemental is what labs speak: 10 kg × 52% P₂O₅ × 0.4364 = 2.26928 kg P.
    expect(phosphorus?.elementalKg).toBeCloseTo(10 * 0.52 * 0.4364, 4);
    // Bag-grade round-trip: elemental ÷ factor recovers the declared oxide mass.
    expect(phosphorus?.oxideSymbol).toBe('P₂O₅');
    expect(phosphorus?.oxideKg).toBeCloseTo(10 * 0.52, 3);
    expect(potassium?.oxideSymbol).toBe('K₂O');
    expect(potassium?.oxideKg).toBeCloseTo(10 * 0.34, 3);
  });

  it('keeps micros elemental-only and orders macros first', () => {
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'Mix',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [
                { nutrient_code: 'Zn', percent: 12, basis: 'declared' },
                { nutrient_code: 'K2O', percent: 34, basis: 'declared' },
                { nutrient_code: 'Fe', percent: 12, basis: 'declared' },
                { nutrient_code: 'N', percent: 10, basis: 'declared' },
              ],
            },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    expect(ledger.rows.map((row) => row.element)).toEqual(['N', 'K', 'Fe', 'Zn']);
    const zinc = ledger.rows.find((row) => row.element === 'Zn');
    expect(zinc?.oxideSymbol).toBeUndefined();
    expect(zinc?.oxideKg).toBeUndefined();
  });

  it('canonicalizes direct Ca/Mg declarations — one row per element, with bag-grade oxide', () => {
    // sanitizeComposition uppercases codes; without canonicalization a direct
    // 'Ca' declaration lands under 'CA' (sorted with micros, no CaO value)
    // while a 'CaO' declaration lands under 'Ca' — one element, two rows.
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'Calcium mix',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [
                { nutrient_code: 'Ca', percent: 10, basis: 'declared' },
                { nutrient_code: 'CaO', percent: 14, basis: 'declared' },
                { nutrient_code: 'Mg', percent: 5, basis: 'declared' },
              ],
            },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    // Exactly one Ca row, macro-sorted, merging direct + oxide contributions.
    expect(ledger.rows.map((row) => row.element)).toEqual(['Ca', 'Mg']);
    const calcium = ledger.rows[0];
    // 10 kg × (10% direct + 14% CaO × 0.7147) elemental Ca
    expect(calcium?.elementalKg).toBeCloseTo(10 * 0.1 + 10 * 0.14 * 0.7147, 4);
    expect(calcium?.oxideSymbol).toBe('CaO');
    expect(calcium?.oxideKg).toBeCloseTo(calcium!.elementalKg / 0.7147, 4);
    const magnesium = ledger.rows[1];
    expect(magnesium?.oxideSymbol).toBe('MgO');
    expect(magnesium?.oxideKg).toBeCloseTo((10 * 0.05) / 0.6031, 4);
  });

  it('coverage floors at 0.01% — rounding never forges a 0% with composed rows behind it', () => {
    const noComp = Array.from({ length: 29999 }, (_, i) => ({
      name: `Mystery ${i}`,
      unit: 'kg',
      quantity: 1,
      composition_snapshot: null,
    }));
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
            },
            ...noComp,
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    // 1/30000 rounds to 0.00 at 2 decimals — must not read as "no data".
    expect(ledger.rows.map((row) => row.element)).toEqual(['N']);
    expect(ledger.coveragePercent).toBe(0.01);
  });

  it('coverage honesty: no-composition items excluded from totals, counted in the denominator', () => {
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
            },
            { name: 'Local Mix', unit: 'kg', quantity: 25, composition_snapshot: null },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    // Only Urea contributes; the 25 kg mystery mix is never guessed at.
    const nitrogen = ledger.rows.find((row) => row.element === 'N');
    expect(nitrogen?.elementalKg).toBeCloseTo(4.6, 4);
    expect(ledger.itemCount).toBe(2);
    expect(ledger.composedItemCount).toBe(1);
    expect(ledger.coveragePercent).toBe(50);
  });

  it('reports 0 coverage (not zeros-as-truth) when nothing has a composition', () => {
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [{ name: 'Local Mix', unit: 'kg', quantity: 25, composition_snapshot: null }],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    expect(ledger.rows).toEqual([]);
    expect(ledger.coveragePercent).toBe(0);
    expect(ledger.itemCount).toBe(1);
  });

  it('per-acre figures are null when farm area is unknown — never divided by a guess', () => {
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 10,
              composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
            },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: null,
    });

    const nitrogen = ledger.rows.find((row) => row.element === 'N');
    expect(nitrogen?.elementalKg).toBeCloseTo(4.6, 4);
    expect(nitrogen?.elementalKgPerAcre).toBeNull();
    expect(ledger.areaAcres).toBeNull();
  });

  it('converts record areas from the preferred unit before per-acre kernel math (hectares)', () => {
    // record.area is stored RAW in the user's preferred unit. A 2-ha record is
    // 4.9421 acres; feeding the bare 2 into the kernel's per_acre context
    // would under-report every per-acre item 2.47105×.
    const ledger = calculateNutrientLedger({
      sprayRecords: [],
      fertigationRecords: [
        fertigation({
          area: 2, // hectares under this preference
          fertilizers: [
            {
              name: 'Urea',
              unit: 'kg',
              quantity: 5,
              quantity_basis: 'per_acre',
              composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
            },
          ],
        }),
      ],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2 / 0.404686, // farm area, already converted by the caller
      areaUnit: 'hectares',
    });

    const nitrogen = ledger.rows.find((row) => row.element === 'N');
    const acres = 2 / 0.404686;
    // 5 kg/acre × 4.9421 acres × 46% N — and per-acre recovers the rate's N.
    expect(nitrogen?.elementalKg).toBeCloseTo(5 * acres * 0.46, 3);
    expect(nitrogen?.elementalKgPerAcre).toBeCloseTo(5 * 0.46, 4);
  });

  it('parses spray water volume from the dose string for concentration items', () => {
    const spray: SprayRecord = {
      id: 1,
      farm_id: 1,
      date: '2026-03-10',
      chemical: 'Boron mix',
      dose: 'Water: 500L',
      area: 2,
      weather: '',
      operator: '',
      chemical_items: [
        {
          name: 'Boron (20%)',
          unit: 'g/L',
          quantity: 2,
          composition_snapshot: [{ nutrient_code: 'B', percent: 20, basis: 'declared' }],
        },
      ],
    } as SprayRecord;

    const ledger = calculateNutrientLedger({
      sprayRecords: [spray],
      fertigationRecords: [],
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      areaAcres: 2,
    });

    // 2 g/L × 500 L = 1 kg product × 20% B = 0.2 kg B.
    const boron = ledger.rows.find((row) => row.element === 'B');
    expect(boron?.elementalKg).toBeCloseTo(0.2, 4);
    expect(ledger.coveragePercent).toBe(100);
  });
});

describe('kernel-swap behavior delta — documented, intentional (issue #200)', () => {
  it('per-acre item with missing area is EXCLUDED and hits coverage (legacy passed the rate through as a total)', () => {
    // Pre-swap, toProductMassKg fell back to the raw quantity when a per_acre
    // item had no usable area — silently reporting a rate as a plot total.
    // The kernel never guesses context (plan §2): missing area ⇒ null ⇒ the
    // item is excluded from totals and the exclusion shows up in coverage.
    const result = calculateNutrientTotalsForLog({
      items: [
        {
          quantity: 5,
          unit: 'kg',
          quantity_basis: 'per_acre',
          composition_snapshot: [{ nutrient_code: 'N', percent: 46, basis: 'declared' }],
        },
      ],
      areaAcre: 0,
    });

    expect(result.nutrientTotalsElemental.N).toBeUndefined();
    expect(result.coveragePercent).toBe(0);
  });
});
