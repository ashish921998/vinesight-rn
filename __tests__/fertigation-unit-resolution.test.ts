/**
 * Fertigation unit resolution through the quantity kernel (issue #192).
 *
 * Covers the four acceptance criteria:
 *  1. 'L/acre' survives form → stored item → display as volume + per_acre.
 *  2. Unknown unit strings stay verbatim and are flagged — never kg.
 *  3. Parity: every alias the legacy resolvers knew resolves to the same
 *     effective unit on the new kernel path.
 *  4. Regression over representative stored rows: valid data is unchanged.
 */

import {
  isFertigationUnitRecognized,
  resolveFertigationPrefill,
  resolveFertigationUnit,
  resolveFertilizerMeasure,
} from '@/constants/fertilizer-units';
import { parseUnitText } from '@/constants/unit-text';
import { parseUnit } from '@/lib/quantity';
import type { FertilizerItem } from '@/types/database';

describe('AC1 — L/acre round-trip: form → stored item → display', () => {
  it("resolves the consultant spelling 'L/acre' to a volume form unit with per-acre basis", () => {
    expect(resolveFertigationUnit('L/acre')).toEqual({
      unit: 'liter',
      basisFromUnit: 'per_acre',
    });
  });

  it.each(['L/acre', 'l/acre', 'litre/acre', 'liter/acre', 'L / Acre', 'LITRE/ACRE'])(
    'volume-per-acre spelling %j never resolves to a mass unit',
    (raw) => {
      const resolved = resolveFertigationUnit(raw);
      expect(resolved.unit).toBe('liter');
      expect(resolved.basisFromUnit).toBe('per_acre');
    },
  );

  it('the stored item shape produced by the form keeps volume + per_acre', () => {
    // Form value object after quick-adding an 'L/acre' plan item:
    const resolved = resolveFertigationUnit('L/acre');
    const storedItem: FertilizerItem = {
      name: 'Humic acid',
      unit: resolved.unit,
      quantity: 2,
      quantity_basis: resolved.basisFromUnit,
    };
    // Display resolution of the stored item: the unit string yields volume,
    // the persisted quantity_basis yields per_acre.
    const parsed = parseUnit(storedItem.unit);
    expect(parsed?.measure).toBe('volume');
    expect(storedItem.quantity_basis).toBe('per_acre');
    expect(storedItem.unit_unrecognized).toBeUndefined();
  });

  it("a historical row storing 'L/acre' verbatim still resolves to volume + per_acre from the string alone", () => {
    const parsed = parseUnitText('L/acre');
    expect(parsed).toMatchObject({ measure: 'volume', basis: 'per_acre' });
  });
});

describe('AC2 — unknown unit strings stay verbatim and are flagged, never kg', () => {
  it.each(['banana/acre', 'kgg', 'Litre par acre', 'sacks/vine'])(
    'unknown string %j resolves verbatim with no derived basis',
    (raw) => {
      expect(resolveFertigationUnit(raw)).toEqual({ unit: raw });
      expect(isFertigationUnitRecognized(raw)).toBe(false);
    },
  );

  it('unknown strings are trimmed but otherwise untouched', () => {
    expect(resolveFertigationUnit('  banana/acre  ')).toEqual({ unit: 'banana/acre' });
  });

  it('kernel-known units the form cannot express stay verbatim WITHOUT the unrecognized flag', () => {
    // ppm / concentrations / counts / per-hectare rates are meaningful to the
    // kernel — they are not form units, but they are not "unrecognized".
    for (const raw of ['ppm', 'gm/L', 'kg/ha', 'bag', 'mg']) {
      expect(resolveFertigationUnit(raw).unit).toBe(raw);
      expect(isFertigationUnitRecognized(raw)).toBe(true);
    }
  });

  it('prefill of an unknown unit keeps the text and never yields kg', () => {
    expect(resolveFertigationPrefill('banana/acre')).toEqual({
      unit: 'banana/acre',
      quantityBasis: 'per_acre', // '/acre' testimony in the string
    });
    expect(resolveFertigationPrefill('kgg')).toEqual({ unit: 'kgg', quantityBasis: 'total' });
  });

  it("spaced-slash testimony ('sacks / acre') counts as per-acre (#207 fold upgrade)", () => {
    // The sniff folds ' / ' like ' per ' now; the unit text stays verbatim,
    // so the per_acre basis remains coherent with the stored string.
    expect(resolveFertigationPrefill('sacks / acre')).toEqual({
      unit: 'sacks / acre',
      quantityBasis: 'per_acre',
    });
  });

  it("empty-base ' per acre' is not per-acre testimony (accepted edge: trim-first fold)", () => {
    // A unit string with no base token carries no usable rate; the fold
    // trims before matching, so it never becomes '/acre'. See unit-text.ts.
    expect(resolveFertigationPrefill(' per acre')).toEqual({
      unit: 'per acre',
      quantityBasis: 'total',
    });
  });

  it('prefill of a ppm plan item keeps ppm instead of the legacy kg/acre coercion', () => {
    // Phase W: per_liter_water is now stored directly (DB enum widened). The
    // old collapse to 'total' was a workaround for a missing enum value.
    expect(resolveFertigationPrefill('ppm')).toEqual({ unit: 'ppm', quantityBasis: 'per_liter_water' });
  });
});

describe('AC3 — parity with the legacy resolvers over their known alias tables', () => {
  // Spellings verbatim from UNIT_ALIASES in src/constants/fertilizer-units.ts
  // (the table resolveFertilizerMeasure resolves against). ppm is excluded:
  // it is a plan-item measure, and the old FORM narrowing coerced it to kg —
  // the corruption this issue removes (asserted separately above).
  const FERTILIZER_UNIT_ALIASES = [
    'kg/acre',
    'kg',
    'g/acre',
    'gram/acre',
    'gram',
    'l/acre',
    'liter/acre',
    'litre/acre',
    'liter',
    'litre',
    'ml/acre',
    'ml',
  ] as const;

  it.each([...FERTILIZER_UNIT_ALIASES])(
    'kernel path resolves %j to the same measure as legacy resolveFertilizerMeasure',
    (alias) => {
      expect(resolveFertigationUnit(alias).unit).toBe(resolveFertilizerMeasure(alias));
    },
  );

  it.each([...FERTILIZER_UNIT_ALIASES])(
    'parity holds for %j in upper case (legacy resolver was case-insensitive)',
    (alias) => {
      const upper = alias.toUpperCase();
      expect(resolveFertigationUnit(upper).unit).toBe(resolveFertilizerMeasure(upper));
    },
  );

  // Alias table verbatim from the deleted normalizeWarehouseFertilizerUnit
  // (src/components/screens/entry-form.tsx, pre-#192) — quick-add chip units.
  const WAREHOUSE_NORMALIZER_TABLE: [string, string][] = [
    ['kg', 'kg'],
    ['kg/acre', 'kg'],
    ['kg per acre', 'kg'],
    ['liter', 'liter'],
    ['litre', 'liter'],
    ['l', 'liter'],
    ['liter/acre', 'liter'],
    ['litre/acre', 'liter'],
    ['l/acre', 'liter'],
    ['liter per acre', 'liter'],
    ['litre per acre', 'liter'],
    ['gram', 'gram'],
    ['gm', 'gram'],
    ['gram/acre', 'gram'],
    ['ml', 'ml'],
    ['ml/acre', 'ml'],
  ];

  it.each(WAREHOUSE_NORMALIZER_TABLE)(
    'kernel path resolves %j to %j exactly as the old warehouse normalizer did',
    (alias, expected) => {
      expect(resolveFertigationUnit(alias).unit).toBe(expected);
    },
  );

  // Alias table verbatim from the deleted normalizeFertigationDoseUnit
  // (entry-form.tsx, pre-#192) — plan/voice prefill. Everything it knew
  // prefilled as a per-acre rate.
  const PREFILL_NORMALIZER_TABLE: [string, string][] = [
    ['kg', 'kg'],
    ['kg/acre', 'kg'],
    ['kg per acre', 'kg'],
    ['liter', 'liter'],
    ['litre', 'liter'],
    ['l', 'liter'],
    ['liter/acre', 'liter'],
    ['litre/acre', 'liter'],
    ['l/acre', 'liter'],
    ['liter per acre', 'liter'],
    ['litre per acre', 'liter'],
  ];

  it.each(PREFILL_NORMALIZER_TABLE)(
    'prefill resolves %j to unit %j with per_acre basis, matching the old prefill',
    (alias, expectedUnit) => {
      expect(resolveFertigationPrefill(alias)).toEqual({
        unit: expectedUnit,
        quantityBasis: 'per_acre',
      });
    },
  );

  it('missing units keep the legacy defaults (nothing to preserve)', () => {
    expect(resolveFertigationUnit(null)).toEqual({ unit: 'kg' });
    expect(resolveFertigationUnit(undefined)).toEqual({ unit: 'kg' });
    expect(resolveFertigationUnit('   ')).toEqual({ unit: 'kg' });
    expect(resolveFertigationUnit(null, 'liter')).toEqual({ unit: 'liter' });
    expect(resolveFertigationPrefill(null)).toEqual({ unit: 'kg', quantityBasis: 'per_acre' });
    expect(resolveFertigationPrefill('')).toEqual({ unit: 'kg', quantityBasis: 'per_acre' });
  });
});

describe('AC4 — regression over representative stored rows (no change for valid data)', () => {
  // Shapes drawn from FertilizerItem (src/types/database.ts): app-written rows
  // (bare unit + quantity_basis), historical rows (unit carries '/acre'),
  // consultant-web spellings, and case variants.
  const REPRESENTATIVE_ROWS: FertilizerItem[] = [
    { name: 'Urea', unit: 'kg', quantity: 25, quantity_basis: 'total' },
    { name: '19:19:19', unit: 'kg/acre', quantity: 5, quantity_basis: 'per_acre' },
    { name: 'Humic acid', unit: 'liter/acre', quantity: 2 },
    { name: 'Micronutrient mix', unit: 'L/acre', quantity: 2.5 },
    { name: 'Seaweed extract', unit: 'litre', quantity: 5, quantity_basis: 'total' },
    { name: 'MgSO4', unit: 'gram', quantity: 500, quantity_basis: 'per_acre' },
    { name: 'Boron', unit: 'ml', quantity: 250, quantity_basis: 'total' },
    { name: 'CAN', unit: 'Kg/Acre', quantity: 3, quantity_basis: 'per_acre' },
    {
      name: 'SOP',
      unit: 'kg',
      quantity: 10,
      quantity_basis: 'total',
      warehouse_item_id: 7,
      catalog_product_id: 12,
      composition_snapshot: [{ nutrient_code: 'K2O', percent: 50 }],
      density_kg_per_l: null,
    },
  ];

  it.each(REPRESENTATIVE_ROWS.map((row) => [row.unit, row] as const))(
    'stored unit %j is recognized — it will never be flagged on re-save',
    (_unit, row) => {
      expect(isFertigationUnitRecognized(row.unit)).toBe(true);
    },
  );

  it.each(REPRESENTATIVE_ROWS.map((row) => [row.unit] as const))(
    'resolving stored unit %j preserves its kernel measure (no mass/volume flip)',
    (unit) => {
      const before = parseUnitText(unit);
      const after = parseUnitText(resolveFertigationUnit(unit).unit);
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(after?.measure).toBe(before?.measure);
    },
  );

  // The verbatim load → save round-trip for these rows is asserted through the
  // real submission builder in entry-log-submission-fertigation.test.ts
  // ('stores every representative stored-row unit spelling verbatim').
});

describe('plan quick-add prefill contract (byPlan uses resolveFertigationPrefill)', () => {
  it("bare plan unit 'kg' keeps the per-acre basis — plan doses are per-acre rates", () => {
    expect(resolveFertigationPrefill('kg')).toEqual({ unit: 'kg', quantityBasis: 'per_acre' });
  });

  it("consultant spelling 'L/acre' prefills as a volume form unit with per-acre basis", () => {
    expect(resolveFertigationPrefill('L/acre')).toEqual({
      unit: 'liter',
      quantityBasis: 'per_acre',
    });
  });

  it("unknown unit spelled with the legacy 'per acre' word form keeps the per-acre basis", () => {
    // Review finding on #203: the fallback sniff must apply the same
    // 'per acre' → '/acre' folding the parser uses — an unknown
    // 'banana per acre' plan dose must never be stored as a plot total.
    expect(resolveFertigationPrefill('banana per acre')).toEqual({
      unit: 'banana per acre',
      quantityBasis: 'per_acre',
    });
    expect(resolveFertigationPrefill('banana/acre')).toEqual({
      unit: 'banana/acre',
      quantityBasis: 'per_acre',
    });
    // No per-acre testimony in the text -> total (never rescaled).
    expect(resolveFertigationPrefill('banana')).toEqual({
      unit: 'banana',
      quantityBasis: 'total',
    });
    // 'copper' must not match the ' per ' folding (needs whitespace around 'per').
    expect(resolveFertigationPrefill('copper')).toEqual({
      unit: 'copper',
      quantityBasis: 'total',
    });
  });

  it('kernel-recognized verbatim rates keep their rate basis (Sentry HIGH on #203)', () => {
    // kg/ha is kernel-known (per-acre-class rate) but form-unrepresentable:
    // it stays verbatim, and the basis column must still say it is a rate.
    expect(resolveFertigationPrefill('kg/ha')).toEqual({
      unit: 'kg/ha',
      quantityBasis: 'per_acre',
    });
    // Phase W: QuantityBasis now includes per_liter_water. Concentration units
    // are stored with their actual basis — never collapsed to 'total'.
    // Area-rescaling (per_acre) is still never applied to per_liter_water.
    expect(resolveFertigationPrefill('ppm')).toEqual({ unit: 'ppm', quantityBasis: 'per_liter_water' });
    expect(resolveFertigationPrefill('gm/L')).toEqual({ unit: 'gm/L', quantityBasis: 'per_liter_water' });
  });

  it('per-acre text sniff is word-boundary matched and plural-aware', () => {
    expect(resolveFertigationPrefill('banana/acres')).toEqual({
      unit: 'banana/acres',
      quantityBasis: 'per_acre',
    });
    // '/acre' inside a longer token must not false-positive (cubic P2).
    expect(resolveFertigationPrefill('banana/acreage')).toEqual({
      unit: 'banana/acreage',
      quantityBasis: 'total',
    });
  });
});
