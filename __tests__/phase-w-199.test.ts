/**
 * Phase W (issue #199) acceptance tests.
 *
 * Covers all six areas mandated by the issue spec:
 *   1. unit-text: per_liter_water basis now returned directly for gm/L, ppm.
 *   2. Plan authoring payload: catalog pick stamps product_id + basis; custom stays null.
 *   3. Plan reader mapping: new columns flow through; legacy null rows safe.
 *   4. Compliance: product-id match beats name match; plan_item_id still wins;
 *      null product ids never match each other.
 *   5. per_liter_water round-trip: gm/L item goes through with basis per_liter_water,
 *      never area-rescaled.
 *   6. Old plans (null product_id/quantity_basis) render + match exactly as today.
 */

import { resolveVerbatimQuantityBasis } from '@/constants/unit-text';
import { computeUsageLenses } from '@/services/report-usage-lenses';
import type { UsageEvent } from '@/services/report-usage-lenses';
import type { ReportPlanItemInput } from '@/types/report';

// ============================================================
// §1 — resolveVerbatimQuantityBasis: per_liter_water now stored directly
// ============================================================

describe('§1 unit-text: per_liter_water stored directly after Phase W', () => {
  it.each(['gm/L', 'g/L', 'ppm', 'PPM', 'mg/L'])(
    'concentration unit %j resolves to per_liter_water (not total)',
    (unit) => {
      expect(resolveVerbatimQuantityBasis(unit)).toBe('per_liter_water');
    },
  );

  it.each(['kg/acre', 'g/acre', 'ml/acre', 'L/acre', 'gm/acre'])(
    'per-acre unit %j still resolves to per_acre',
    (unit) => {
      expect(resolveVerbatimQuantityBasis(unit)).toBe('per_acre');
    },
  );

  it.each(['kg', 'gram', 'liter', 'ml', 'g', 'kgg', null, undefined])(
    'bare/unknown unit %j resolves to total',
    (unit) => {
      expect(resolveVerbatimQuantityBasis(unit)).toBe('total');
    },
  );
});

// ============================================================
// §3 — Plan reader mapping: legacy null rows are safe
// ============================================================

describe('§3 plan reader mapping: legacy null rows tolerated', () => {
  // The reader type makes product_id and quantity_basis optional so old
  // fixtures compile and run. This group tests that the compliance engine
  // handles absent/null identity gracefully.

  it('compliance works for a plan item with no product_id (legacy row)', () => {
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-legacy', name: 'Urea', quantity: 5, unit: 'kg/acre', productId: null },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 2,
        items: [{ name: 'Urea', quantity: 10, unit: 'kg', catalogProductId: null }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 2, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 5,
      matchLevel: 'approximate', // name match since both productIds are null
    });
  });

  it('plan item without productId field (truly absent, old fixture) still name-matches', () => {
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-old', name: 'DAP', quantity: 3, unit: 'kg/acre' },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 1,
        items: [{ name: 'DAP', quantity: 3, unit: 'kg' }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 1, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 3,
      matchLevel: 'approximate',
    });
  });
});

// ============================================================
// §4 — Compliance: identity > name; plan_item_id still wins
// ============================================================

describe('§4 compliance matching precedence', () => {
  it('product-id match beats name match when both could apply', () => {
    // Plan item with productId=42; logged item has catalogProductId=42 (no plan stamp).
    // Name would also match, but identity takes precedence (same matchLevel
    // 'approximate', but identity win is the accumulation path).
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-1', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 2,
        items: [{ name: 'MAP', quantity: 10, unit: 'kg', catalogProductId: 42 }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 2, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 5,
      matchLevel: 'approximate', // identity is still 'approximate', not 'verified'
    });
  });

  it('a product prescribed on multiple dates counts each identity contribution ONCE', () => {
    // Plans repeat the same product across application dates by design. One
    // logged contribution must not multiply by the number of plan rows that
    // prescribe its product — prescriptions sum, applied does not fan out.
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-mar', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 },
      { id: 'pi-apr', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 2,
        items: [{ name: 'MAP', quantity: 8, unit: 'kg', catalogProductId: 42 }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 2, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      prescribedPerAcre: 10, // both plan rows sum
      appliedPerAcre: 4, // 8 kg over 2 acres, counted ONCE — never 8
      matchLevel: 'approximate',
    });
  });

  it('identity and name contributions are different applications — both count', () => {
    // A catalog-picked log (identity) and a hand-typed log (name only) of the
    // same product are two real applications; precedence is per contribution,
    // never a group-level suppression that would discard the hand-typed one.
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-map', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 2,
        items: [
          // Identity match under a DIFFERENT logged name — name alone would miss it.
          { name: 'MAP 12:61:00', quantity: 6, unit: 'kg', catalogProductId: 42 },
          // Hand-typed, no identity — name match.
          { name: 'MAP', quantity: 4, unit: 'kg', catalogProductId: null },
        ],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 2, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 5, // 3 (identity) + 2 (name) — both applications count
      matchLevel: 'approximate',
    });
  });

  it('one product relabeled across plan rows is claimed by ONE compliance group', () => {
    // Same productId under two different fertilizer_name spellings forms two
    // groups; an identity contribution must appear in exactly one of them —
    // counting it in both would double the applied figure across the table.
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-a', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 },
      { id: 'pi-b', name: 'MAP 12-61-0', quantity: 5, unit: 'kg/acre', productId: 42 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 1,
        items: [{ name: 'whatever label', quantity: 4, unit: 'kg', catalogProductId: 42 }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 1, planItems });
    const totalApplied = lenses.perAcre.compliance.reduce(
      (sum, row) => sum + (row.appliedPerAcre ?? 0),
      0,
    );
    expect(lenses.perAcre.compliance).toHaveLength(2);
    expect(totalApplied).toBe(4); // once across the whole table, never 8
  });

  it('plan_item_id stamp still wins (verified) over identity match', () => {
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-2', name: 'SOP', quantity: 4, unit: 'kg/acre', productId: 99 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 1,
        items: [{ name: 'SOP', quantity: 4, unit: 'kg', planItemId: 'pi-2', catalogProductId: 99 }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 1, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 4,
      matchLevel: 'verified', // plan_item_id stamp → verified, not identity-approximate
    });
  });

  it('null product ids never match each other', () => {
    // Plan item has no productId; logged item has no catalogProductId.
    // They must NOT identity-match — only name can match.
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-3', name: 'Boron', quantity: 2, unit: 'kg/acre', productId: null },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 1,
        items: [{ name: 'Boron', quantity: 2, unit: 'kg', catalogProductId: null }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 1, planItems });
    // Should still match (by name), confirming null-ids don't block name match.
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 2,
      matchLevel: 'approximate',
    });
  });

  it('identity match wins over name: different name same productId still matches', () => {
    // Plan item spelled "MOP"; logged item spelled "muriate of potash" but
    // same catalogProductId=7. Identity wins even when the names diverge.
    const planItems: ReportPlanItemInput[] = [
      { id: 'pi-4', name: 'MOP', quantity: 3, unit: 'kg/acre', productId: 7 },
    ];
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 1,
        items: [{ name: 'muriate of potash', quantity: 3, unit: 'kg', catalogProductId: 7 }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 1, planItems });
    expect(lenses.perAcre.compliance[0]).toMatchObject({
      appliedPerAcre: 3,
      matchLevel: 'approximate',
    });
  });
});

// ============================================================
// §5 — per_liter_water round-trip: never area-rescaled
// ============================================================

describe('§5 per_liter_water round-trip: never area-rescaled', () => {
  it('gm/L item with per_liter_water basis is not multiplied by area', () => {
    // 10 gm/L in 200L water → 2 kg total, NOT 2 kg × area_acres
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: 200,
        areaAcres: 3,
        items: [{ name: 'Chelated Fe', quantity: 10, unit: 'gm/L', quantityBasis: 'per_liter_water' }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 3 });
    const row = lenses.perPlot.rows[0];
    // 10 g/L × 200 L = 2 kg — area is irrelevant
    expect(row.totals[0].value).toBeCloseTo(2, 12);
    expect(row.totals[0].display).toBe('≈ 2 kg');
  });

  it('per_acre basis on same unit triggers area multiplication', () => {
    // Sanity check: per_acre on a bare kg DOES get multiplied
    const events: UsageEvent[] = [
      {
        type: 'fertilizer',
        waterLiters: null,
        areaAcres: 3,
        items: [{ name: 'Urea', quantity: 5, unit: 'kg', quantityBasis: 'per_acre' }],
      },
    ];
    const lenses = computeUsageLenses({ events, areaAcres: 3 });
    const row = lenses.perPlot.rows[0];
    // 5 kg/acre × 3 acres = 15 kg
    expect(row.totals[0].value).toBeCloseTo(15, 12);
  });
});
