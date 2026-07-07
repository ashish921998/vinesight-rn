/**
 * One-tap plan prefill — issue #197
 *
 * Three test groups:
 *   (a) Kernel conversion: prescription → chip round-trip via
 *       resolveFertigationPrefill (the function the one-tap handler calls).
 *   (b) ppm exclusion: isWaterConcentrationUnit gates the quick-add chip row
 *       row, the one-tap button, and the plan-card button (one shared predicate).
 *   (c) plan_item_id survives submission: FertilizerEntry.planItemId →
 *       FertilizerItem.plan_item_id through entry-log-submission.
 */

import { resolveFertigationPrefill } from '@/constants/fertilizer-units';
import { isWaterConcentrationUnit } from '@/lib/quantity';
import { fertigationPlanItemsToOptions } from '@/components/ui/search-select-logic';
import { submitEntryPendingLog } from '@/utils/entry-log-submission';
import type { FertigationFormData } from '@/components/forms';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { FertigationRecordInsert } from '@/types';

// Minimal plan-item fixture; each test overrides the fields it exercises.
const BLANK_PLAN_ITEM: FertilizerPlanItem = {
  id: '',
  name: '',
  quantity: null,
  unit: null,
  application_date: null,
  application_method: null,
  application_frequency: null,
  notes: null,
  sort_order: null,
  product_id: null,
  quantity_basis: null,
};

// entry-log-submission only reads PHI_CALC_VERSION; the real module reaches
// the supabase client, which has no place in this test.
jest.mock('@/services/phi-service', () => ({ PHI_CALC_VERSION: 'v1' }));

// ============================================================
// MARK: - (a) Kernel conversion: prescription → chip round-trip
// ============================================================

describe('resolveFertigationPrefill — prescription unit → form chip (issue #197 §a)', () => {
  /**
   * The one-tap handler in fertilizer-plans.tsx calls resolveFertigationPrefill
   * to convert the DB-stored plan unit into the form's vocabulary. These
   * assertions verify the round-trip for every canonical plan unit.
   */

  it('kg/acre → chip unit "kg" + per_acre basis', () => {
    const result = resolveFertigationPrefill('kg/acre');
    expect(result.unit).toBe('kg');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('bare "kg" (consultant spelled without /acre) → kg + per_acre (plan contract)', () => {
    // Plan doses are per-acre by contract even when the stored string is bare.
    const result = resolveFertigationPrefill('kg');
    expect(result.unit).toBe('kg');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('g/acre → chip unit "gram" + per_acre', () => {
    const result = resolveFertigationPrefill('g/acre');
    expect(result.unit).toBe('gram');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('L/acre → chip unit "liter" + per_acre', () => {
    const result = resolveFertigationPrefill('L/acre');
    expect(result.unit).toBe('liter');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('ml/acre → chip unit "ml" + per_acre', () => {
    const result = resolveFertigationPrefill('ml/acre');
    expect(result.unit).toBe('ml');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('liter/acre (spelled-out) → chip unit "liter" + per_acre', () => {
    const result = resolveFertigationPrefill('liter/acre');
    expect(result.unit).toBe('liter');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('Kg/Acre (case variant) → chip unit "kg" + per_acre', () => {
    const result = resolveFertigationPrefill('Kg/Acre');
    expect(result.unit).toBe('kg');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('ppm → verbatim "ppm" + per_liter_water basis (water-concentration, not per-acre)', () => {
    // ppm is recognized by the kernel but has no form chip — it passes through
    // verbatim. Now that QuantityBasis includes per_liter_water (Phase W), the
    // kernel's basis is stored directly rather than collapsed to 'total'.
    const result = resolveFertigationPrefill('ppm');
    expect(result.unit).toBe('ppm');
    // ppm has basis per_liter_water in the kernel; Phase W stores it directly.
    expect(result.quantityBasis).toBe('per_liter_water');
  });

  it('unknown unit → verbatim pass-through, per_acre sniff when spelt with /acre', () => {
    const result = resolveFertigationPrefill('banana/acre');
    expect(result.unit).toBe('banana/acre');
    expect(result.quantityBasis).toBe('per_acre');
  });

  it('missing/blank input → defaults to kg + per_acre', () => {
    expect(resolveFertigationPrefill(null)).toEqual({ unit: 'kg', quantityBasis: 'per_acre' });
    expect(resolveFertigationPrefill('')).toEqual({ unit: 'kg', quantityBasis: 'per_acre' });
  });
});

// ============================================================
// MARK: - (b) ppm exclusion logic
// ============================================================

describe('isWaterConcentrationUnit — gates quick-add chip exclusion (issue #197 §b)', () => {
  /**
   * Water-concentration units (ppm, g/L, mg/L …) must never appear as tappable
   * quick-add chips. isWaterConcentrationUnit is the predicate the fertigation
   * form uses to separate chip items from explanatory-notice items.
   */

  it.each(['ppm', 'PPM', ' ppm ', 'mg/L', 'mg/l', 'gm/L', 'g/L', 'g/l'])(
    'returns true for water-concentration unit %j',
    (unit) => {
      expect(isWaterConcentrationUnit(unit)).toBe(true);
    },
  );

  it.each(['kg', 'kg/acre', 'g/acre', 'L/acre', 'ml/acre', 'gram', 'liter', 'ml', 'liter/acre'])(
    'returns false for form-representable unit %j',
    (unit) => {
      expect(isWaterConcentrationUnit(unit)).toBe(false);
    },
  );

  it.each(['banana/acre', 'kgg', '', null, undefined])(
    'returns false for unknown or blank unit %j',
    (unit) => {
      expect(isWaterConcentrationUnit(unit)).toBe(false);
    },
  );
});

// The plan-card ScheduleItemCard gates its one-tap button on the SAME shared
// kernel predicate — a single definition so the two surfaces can never drift
// on what counts as a water-concentration dose.

describe('picker plan-items section excludes ppm (issue #197 §b)', () => {
  /**
   * The manual picker's plan section is a third entry into a fertigation log,
   * alongside the one-tap button and the quick-add chips. It must apply the
   * same ppm exclusion: the form has no chip for a water-concentration dose,
   * so a ppm plan item is filtered out before fertigationPlanItemsToOptions
   * ever maps it — never offered, never coerced.
   */
  const planItems: FertilizerPlanItem[] = [
    { ...BLANK_PLAN_ITEM, id: 'a', name: 'MAP', quantity: 5, unit: 'kg/acre' },
    { ...BLANK_PLAN_ITEM, id: 'b', name: 'GA3', quantity: 100, unit: 'ppm' },
    { ...BLANK_PLAN_ITEM, id: 'c', name: 'Boron', quantity: 2, unit: 'g/L' },
  ];

  it('drops water-concentration items and keeps form-representable ones', () => {
    const selectable = planItems.filter((item) => !isWaterConcentrationUnit(item.unit));
    const options = fertigationPlanItemsToOptions(selectable);
    const names = options.map((option) => option.name);
    expect(names).toEqual(['MAP']);
    expect(names).not.toContain('GA3');
    expect(names).not.toContain('Boron');
  });
});

// ============================================================
// MARK: - (c) plan_item_id survives form → submission → DB write
// ============================================================

function makeSubmitters() {
  const createFertigation = jest.fn(async (_payload: FertigationRecordInsert) => ({ id: 99 }));
  const reject = async () => {
    throw new Error('unexpected submitter call');
  };
  return {
    submitters: {
      createIrrigation: jest.fn(reject),
      createSpray: jest.fn(reject),
      createHarvest: jest.fn(reject),
      createExpense: jest.fn(reject),
      createFertigation,
      upsertDailyNote: jest.fn(reject),
      updateWaterLevel: jest.fn(async () => ({})),
    },
    createFertigation,
  };
}

async function submitFertigation(data: FertigationFormData) {
  const { submitters, createFertigation } = makeSubmitters();
  const result = await submitEntryPendingLog({
    log: { id: 'log-plan', type: 'fertigation', data },
    dateStr: '2026-07-05',
    farm: { id: 10, area: 5, areaUnit: 'acres', date_of_pruning: null },
    submitters,
  });
  expect(result.recordId).toBe(99);
  expect(createFertigation).toHaveBeenCalledTimes(1);
  return createFertigation.mock.calls[0][0];
}

describe('plan_item_id survival — form state → DB item JSON (issue #197 §c)', () => {
  it('stamps plan_item_id from a plan-prefilled row into the submitted item', async () => {
    const payload = await submitFertigation({
      fertilizers: [
        {
          name: 'MAP 12:61:0',
          quantity: 3,
          unit: 'kg',
          quantityBasis: 'per_acre',
          planItemId: 'plan-item-uuid-1',
          catalogProductId: null,
        },
      ],
    });
    expect(payload.fertilizers).toEqual([
      expect.objectContaining({
        name: 'MAP 12:61:0',
        plan_item_id: 'plan-item-uuid-1',
      }),
    ]);
  });

  it('plan_item_id and catalog_product_id can coexist on the same row', async () => {
    const payload = await submitFertigation({
      fertilizers: [
        {
          name: '19:19:19',
          quantity: 5,
          unit: 'kg',
          quantityBasis: 'per_acre',
          planItemId: 'plan-item-uuid-2',
          catalogProductId: 500,
        },
      ],
    });
    const item = payload.fertilizers?.[0];
    expect(item).toEqual(
      expect.objectContaining({ plan_item_id: 'plan-item-uuid-2', catalog_product_id: 500 }),
    );
  });

  it('rows without plan_item_id carry null (no required-field regression)', async () => {
    const payload = await submitFertigation({
      fertilizers: [{ name: 'Urea', quantity: 10, unit: 'kg', quantityBasis: 'total' }],
    });
    expect(payload.fertilizers?.[0]).toEqual(expect.objectContaining({ plan_item_id: null }));
    // The row must still be valid — no regression on unlinked fertigation logs.
    expect(payload.fertilizers?.[0]?.name).toBe('Urea');
  });

  it('mixed rows: one plan-linked, one unlinked — both survive correctly', async () => {
    const payload = await submitFertigation({
      fertilizers: [
        {
          name: 'Humic acid',
          quantity: 2,
          unit: 'liter',
          quantityBasis: 'per_acre',
          planItemId: 'plan-item-uuid-3',
        },
        { name: 'Urea', quantity: 25, unit: 'kg', quantityBasis: 'total' },
      ],
    });
    const items = payload.fertilizers ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(expect.objectContaining({ plan_item_id: 'plan-item-uuid-3' }));
    expect(items[1]).toEqual(expect.objectContaining({ plan_item_id: null }));
  });

  it('plan_item_id is not propagated from history (recents carry no planItemId)', async () => {
    // History rows parsed in use-records.ts never attach planItemId, so a new
    // log from history has no plan linkage. This test verifies the null default.
    const payload = await submitFertigation({
      fertilizers: [
        // Simulates a history-prefilled row: planItemId intentionally absent.
        { name: 'KNO3', quantity: 3, unit: 'kg', quantityBasis: 'total' },
      ],
    });
    expect(payload.fertilizers?.[0]).toEqual(expect.objectContaining({ plan_item_id: null }));
  });
});
