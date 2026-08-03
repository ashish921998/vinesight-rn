import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  SprayFormData,
} from '@/components/forms';
import {
  buildExpenseUpdate,
  buildFertigationUpdate,
  buildHarvestUpdate,
  buildIrrigationUpdate,
  buildSprayUpdate,
} from '@/utils/form-to-update';

const DATE = '2026-08-01';

describe('buildIrrigationUpdate', () => {
  it('maps duration and date', () => {
    const data: IrrigationFormData = { duration: 3.5 };
    expect(buildIrrigationUpdate(data, DATE)).toEqual({ duration: 3.5, date: DATE });
  });
});

describe('buildSprayUpdate', () => {
  it('maps chemicals, dose, and nutrients without scaling quantities', () => {
    const data: SprayFormData = {
      waterVolume: 200,
      chemicals: [
        {
          id: 'c1',
          name: 'Captan',
          quantity: 2,
          unit: 'gm/L',
          quantityBasis: 'total',
          warehouseItemId: 9,
          catalogProductId: 11,
          planItemId: null,
          compositionSnapshot: null,
          densityKgPerL: null,
        },
        {
          id: 'c2',
          name: '',
          quantity: 5,
          unit: 'ml/L',
        },
      ],
      catalogMixId: null,
    };

    const updates = buildSprayUpdate(data, DATE, 2);

    expect(updates.chemical).toContain('Captan (2 gm/L)');
    expect(updates.dose).toBe('Water: 200L');
    expect(updates.date).toBe(DATE);
    // Blank-name rows stay in the human summary but are dropped from items.
    expect(updates.chemical_items).toEqual([
      {
        name: 'Captan',
        unit: 'gm/L',
        quantity: 2,
        quantity_basis: 'total',
        warehouse_item_id: 9,
        catalog_product_id: 11,
        plan_item_id: null,
        composition_snapshot: null,
        density_kg_per_l: null,
      },
    ]);
    expect(updates.nutrient_totals_elemental).toBeDefined();
    expect(updates.nutrient_calc_coverage).toEqual(expect.any(Number));
  });

  it('omits dose when water volume is unset', () => {
    const data: SprayFormData = {
      waterVolume: undefined,
      chemicals: [{ id: 'c1', name: 'X', quantity: 1, unit: 'ml/L' }],
      catalogMixId: null,
    };
    expect(buildSprayUpdate(data, DATE, 0).dose).toBe('');
  });
});

describe('buildHarvestUpdate', () => {
  it('maps quantity/grade and drops empty price/buyer', () => {
    const data: HarvestFormData = {
      quantity: 12,
      grade: 'A',
      price: 0,
      buyer: '',
    };
    expect(buildHarvestUpdate(data, DATE)).toEqual({
      quantity: 12,
      grade: 'A',
      price: undefined,
      buyer: undefined,
      date: DATE,
    });
  });
});

describe('buildExpenseUpdate', () => {
  it('maps type via expense-type helper and drops empty remarks', () => {
    const data: ExpenseFormData = {
      type: 'Fuel',
      cost: 400,
      remarks: '',
    };
    expect(buildExpenseUpdate(data, DATE)).toEqual({
      type: 'fuel',
      cost: 400,
      remarks: undefined,
      date: DATE,
    });
  });
});

describe('buildFertigationUpdate', () => {
  it('maps every row including zero quantity and flags unknown units', () => {
    const data: FertigationFormData = {
      fertilizers: [
        {
          id: 'f1',
          name: ' Urea ',
          quantity: 0,
          unit: 'kg',
          quantityBasis: 'total',
          warehouseItemId: 1,
          catalogProductId: null,
          planItemId: null,
          compositionSnapshot: null,
          densityKgPerL: null,
        },
        {
          id: 'f2',
          name: 'Mystery',
          quantity: 2,
          unit: 'scoops',
          quantityBasis: 'per_acre',
        },
      ],
    };

    const updates = buildFertigationUpdate(data, DATE, 3);

    expect(updates.date).toBe(DATE);
    expect(updates.fertilizers).toEqual([
      {
        name: 'Urea',
        unit: 'kg',
        quantity: 0,
        quantity_basis: 'total',
        warehouse_item_id: 1,
        catalog_product_id: null,
        plan_item_id: null,
        composition_snapshot: null,
        density_kg_per_l: null,
      },
      {
        name: 'Mystery',
        unit: 'scoops',
        quantity: 2,
        quantity_basis: 'per_acre',
        unit_unrecognized: true,
        warehouse_item_id: null,
        catalog_product_id: null,
        plan_item_id: null,
        composition_snapshot: null,
        density_kg_per_l: null,
      },
    ]);
    expect(updates.nutrient_totals_elemental).toBeDefined();
  });
});
