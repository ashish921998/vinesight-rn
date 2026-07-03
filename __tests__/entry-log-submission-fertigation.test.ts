/**
 * Fertigation submission: stored items keep the farmer's unit string verbatim
 * and flag kernel-unknown units — never a silent kg fallback (issue #192).
 */

import { submitEntryPendingLog } from '@/utils/entry-log-submission';
import type { FertigationFormData } from '@/components/forms';
import type { FertigationRecordInsert } from '@/types';

// entry-log-submission only reads the PHI_CALC_VERSION constant; the real
// module pulls in the supabase client, which has no place in this test.
jest.mock('@/services/phi-service', () => ({ PHI_CALC_VERSION: 'v1' }));

function makeSubmitters() {
  const createFertigation = jest.fn(async (_payload: FertigationRecordInsert) => ({ id: 42 }));
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
    log: { id: 'log-1', type: 'fertigation', data },
    dateStr: '2026-07-03',
    farm: { id: 7, area: 3.5, areaUnit: 'acres', date_of_pruning: null },
    submitters,
  });
  expect(result.recordId).toBe(42);
  expect(createFertigation).toHaveBeenCalledTimes(1);
  return createFertigation.mock.calls[0][0];
}

describe('fertigation submission — unit testimony and flagging', () => {
  it('stores a volume-per-acre entry as liter + per_acre, unflagged', async () => {
    const payload = await submitFertigation({
      waterVolume: 400,
      fertilizers: [{ name: 'Humic acid', quantity: 2, unit: 'liter', quantityBasis: 'per_acre' }],
    });
    expect(payload.fertilizers).toEqual([
      expect.objectContaining({
        name: 'Humic acid',
        unit: 'liter',
        quantity: 2,
        quantity_basis: 'per_acre',
      }),
    ]);
    expect(payload.fertilizers?.[0]).not.toHaveProperty('unit_unrecognized');
  });

  it('stores unknown unit strings verbatim with unit_unrecognized: true — never kg', async () => {
    const payload = await submitFertigation({
      waterVolume: undefined,
      fertilizers: [
        { name: 'Mystery mix', quantity: 5, unit: 'banana/acre', quantityBasis: 'total' },
        { name: 'Typo fert', quantity: 3, unit: 'kgg', quantityBasis: 'total' },
      ],
    });
    const items = payload.fertilizers ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        name: 'Mystery mix',
        unit: 'banana/acre',
        quantity: 5,
        unit_unrecognized: true,
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({ name: 'Typo fert', unit: 'kgg', unit_unrecognized: true }),
    );
    for (const item of items) {
      expect(item.unit).not.toBe('kg');
    }
  });

  it('keeps kernel-known but non-form units (ppm) verbatim and unflagged', async () => {
    const payload = await submitFertigation({
      waterVolume: 200,
      fertilizers: [{ name: 'GA3', quantity: 100, unit: 'ppm', quantityBasis: 'total' }],
    });
    expect(payload.fertilizers?.[0]).toEqual(
      expect.objectContaining({ unit: 'ppm', quantity: 100, quantity_basis: 'total' }),
    );
    expect(payload.fertilizers?.[0]).not.toHaveProperty('unit_unrecognized');
  });

  it('stores every representative stored-row unit spelling verbatim (AC4 round-trip)', async () => {
    // Spellings drawn from the AC4 representative rows in
    // fertigation-unit-resolution.test.ts: app-written bare units, historical
    // '/acre' spellings, consultant-web spellings, and case variants. The real
    // submission builder must carry each unit string through byte-identical.
    const representativeUnits = [
      'kg',
      'kg/acre',
      'liter/acre',
      'L/acre',
      'litre',
      'gram',
      'ml',
      'Kg/Acre',
    ];
    const payload = await submitFertigation({
      waterVolume: undefined,
      fertilizers: representativeUnits.map((unit, i) => ({
        name: `Fertilizer ${i}`,
        quantity: 5,
        unit,
        quantityBasis: 'total' as const,
      })),
    });
    const items = payload.fertilizers ?? [];
    expect(items.map((item) => item.unit)).toEqual(representativeUnits);
    for (const item of items) {
      expect(item).not.toHaveProperty('unit_unrecognized');
      expect(item.quantity).toBe(5); // total basis: never rescaled
    }
  });

  it('stamps plan_item_id and composition_snapshot from picker-selected rows (issue #196)', async () => {
    const composition = [{ nutrient_code: 'N', percent: 19, basis: 'declared' as const }];
    const payload = await submitFertigation({
      waterVolume: 300,
      fertilizers: [
        {
          name: '19:19:19',
          quantity: 5,
          unit: 'kg',
          quantityBasis: 'total',
          planItemId: 'plan-item-1',
          catalogProductId: 500,
          compositionSnapshot: composition,
        },
        // Legacy rows without picker identity stamp explicit nulls.
        { name: 'Urea', quantity: 10, unit: 'kg', quantityBasis: 'total' },
      ],
    });
    const items = payload.fertilizers ?? [];
    expect(items[0]).toEqual(
      expect.objectContaining({
        name: '19:19:19',
        plan_item_id: 'plan-item-1',
        catalog_product_id: 500,
        composition_snapshot: composition,
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        plan_item_id: null,
        catalog_product_id: null,
        composition_snapshot: null,
      }),
    );
  });

  it('leaves every recognized form unit unflagged (regression over the picker vocabulary)', async () => {
    const payload = await submitFertigation({
      waterVolume: undefined,
      fertilizers: [
        { name: 'Urea', quantity: 25, unit: 'kg', quantityBasis: 'total' },
        { name: 'MgSO4', quantity: 500, unit: 'gram', quantityBasis: 'per_acre' },
        { name: 'Seaweed', quantity: 5, unit: 'liter', quantityBasis: 'total' },
        { name: 'Boron', quantity: 250, unit: 'ml', quantityBasis: 'total' },
      ],
    });
    for (const item of payload.fertilizers ?? []) {
      expect(item).not.toHaveProperty('unit_unrecognized');
    }
  });
});
