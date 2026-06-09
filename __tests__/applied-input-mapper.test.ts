import {
  mapAppliedItems,
  formQuantityFromStored,
  buildChemicalSummary,
  buildWaterDoseString,
  type AppliedFormItem,
} from '@/utils/applied-input-mapper';
import { perAcreNormalizationFactor } from '@/utils/preferences';

describe('applied-input-mapper', () => {
  describe('mapAppliedItems', () => {
    const base: AppliedFormItem = { name: 'Urea', quantity: 10, unit: 'kg' };

    it('drops blank-named and zero/undefined-quantity rows', () => {
      const result = mapAppliedItems(
        [
          { name: '  ', quantity: 5, unit: 'kg' },
          { name: 'Empty', quantity: 0, unit: 'kg' },
          { name: 'NoQty', unit: 'kg' },
          base,
        ],
        { perAreaToPerAcreFactor: 1 },
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Urea');
    });

    it('multiplies per_acre quantities by the factor and leaves total-basis untouched', () => {
      const result = mapAppliedItems(
        [
          { name: 'PerAcre', quantity: 10, unit: 'kg', quantityBasis: 'per_acre' },
          { name: 'Total', quantity: 10, unit: 'kg', quantityBasis: 'total' },
        ],
        { perAreaToPerAcreFactor: 0.404686 },
      );
      expect(result[0].quantity).toBeCloseTo(4.04686, 5);
      expect(result[0].quantity_basis).toBe('per_acre');
      expect(result[1].quantity).toBe(10);
      expect(result[1].quantity_basis).toBe('total');
    });

    it('stores quantities verbatim when factor is 1 (edit path), even for per_acre basis', () => {
      const result = mapAppliedItems(
        [{ name: 'PerAcre', quantity: 7, unit: 'kg', quantityBasis: 'per_acre' }],
        { perAreaToPerAcreFactor: 1 },
      );
      expect(result[0].quantity).toBe(7);
    });

    it('defaults missing quantityBasis to total', () => {
      const result = mapAppliedItems([base], { perAreaToPerAcreFactor: 0.5 });
      expect(result[0].quantity_basis).toBe('total');
      expect(result[0].quantity).toBe(10); // total basis ignores the factor
    });

    it('trims the name and maps optional fields to null when absent', () => {
      const result = mapAppliedItems([{ name: '  Boron  ', quantity: 2, unit: 'L' }], {
        perAreaToPerAcreFactor: 1,
      });
      expect(result[0]).toEqual({
        name: 'Boron',
        unit: 'L',
        quantity: 2,
        quantity_basis: 'total',
        warehouse_item_id: null,
        catalog_product_id: null,
        composition_snapshot: null,
        density_kg_per_l: null,
      });
    });

    it('passes through provided ids, composition and density', () => {
      const composition = [{ nutrient: 'N', percentage: 46 }] as never;
      const result = mapAppliedItems(
        [
          {
            name: 'Urea',
            quantity: 5,
            unit: 'kg',
            warehouseItemId: 11,
            catalogProductId: 22,
            compositionSnapshot: composition,
            densityKgPerL: 1.2,
          },
        ],
        { perAreaToPerAcreFactor: 1 },
      );
      expect(result[0]).toMatchObject({
        warehouse_item_id: 11,
        catalog_product_id: 22,
        composition_snapshot: composition,
        density_kg_per_l: 1.2,
      });
    });
  });

  describe('formQuantityFromStored', () => {
    it('back-converts per_acre quantities by dividing out the factor (hectares)', () => {
      // A hectare farm stored a per-acre value of 4.04686; the user typed 10.
      expect(formQuantityFromStored(4.04686, 'per_acre', 0.404686)).toBe(10);
    });

    it('leaves total-basis quantities unchanged regardless of factor', () => {
      expect(formQuantityFromStored(4.04686, 'total', 0.404686)).toBe(4.04686);
    });

    it('defaults a missing basis to total (no conversion)', () => {
      expect(formQuantityFromStored(7, undefined, 0.404686)).toBe(7);
    });

    it('is a no-op for the acres factor (1), even for per_acre basis', () => {
      expect(formQuantityFromStored(10, 'per_acre', 1)).toBe(10);
    });

    it('returns acres-factor values verbatim — no rounding, preserves precision', () => {
      // factor 1 means no conversion, so a high-precision stored value is kept
      // exactly as-is (matches the edit form's pre-existing verbatim behavior).
      expect(formQuantityFromStored(4.0468612345, 'per_acre', 1)).toBe(4.0468612345);
    });

    it('treats a non-positive or non-finite factor as verbatim (no divide-by-zero)', () => {
      expect(formQuantityFromStored(10, 'per_acre', 0)).toBe(10);
      expect(formQuantityFromStored(10, 'per_acre', Number.NaN)).toBe(10);
    });

    it('rounds to 6 d.p. so the hydrated value has no float tail', () => {
      const recovered = formQuantityFromStored(4.04686, 'per_acre', 0.404686);
      expect(Number.isInteger(recovered)).toBe(true);
    });
  });

  describe('hectare-farm per_acre create -> edit -> re-save round trip', () => {
    const hectareFactor = perAcreNormalizationFactor('hectares');

    it('keeps the stored per-acre quantity stable and re-shows the user their typed value', () => {
      // CREATE: a user on a hectare farm types 10 (per their display unit) for a
      // per_acre row. The create path normalizes it to the canonical per-acre value.
      const typed = 10;
      const [created] = mapAppliedItems(
        [{ name: 'Urea', quantity: typed, unit: 'kg', quantityBasis: 'per_acre' }],
        { perAreaToPerAcreFactor: hectareFactor },
      );
      expect(created.quantity).toBeCloseTo(4.04686, 5);

      // EDIT (hydrate): the edit form shows what the user typed (10), not the
      // stored 4.05 — the asymmetry this fix removes.
      const displayed = formQuantityFromStored(
        created.quantity,
        created.quantity_basis,
        hectareFactor,
      );
      expect(displayed).toBe(typed);

      // EDIT (re-save, unchanged): re-normalizes back to the identical stored value.
      const [resaved] = mapAppliedItems(
        [{ name: 'Urea', quantity: displayed, unit: 'kg', quantityBasis: 'per_acre' }],
        { perAreaToPerAcreFactor: hectareFactor },
      );
      expect(resaved.quantity).toBe(created.quantity);
    });

    it('is stable across a second edit cycle (no drift)', () => {
      const [created] = mapAppliedItems(
        [{ name: 'Urea', quantity: 2.5, unit: 'kg', quantityBasis: 'per_acre' }],
        { perAreaToPerAcreFactor: hectareFactor },
      );
      let stored = created.quantity;
      for (let i = 0; i < 3; i += 1) {
        const displayed = formQuantityFromStored(stored, 'per_acre', hectareFactor);
        expect(displayed).toBe(2.5);
        stored = mapAppliedItems(
          [{ name: 'Urea', quantity: displayed, unit: 'kg', quantityBasis: 'per_acre' }],
          { perAreaToPerAcreFactor: hectareFactor },
        )[0].quantity;
        expect(stored).toBe(created.quantity);
      }
    });

    it('total-basis quantities are untouched by the round trip', () => {
      const [created] = mapAppliedItems(
        [{ name: 'Sulphur', quantity: 12, unit: 'kg', quantityBasis: 'total' }],
        { perAreaToPerAcreFactor: hectareFactor },
      );
      expect(created.quantity).toBe(12);
      expect(formQuantityFromStored(created.quantity, 'total', hectareFactor)).toBe(12);
    });

    it('acres farm (factor 1): create and edit already agree — round trip is identity', () => {
      const acresFactor = perAcreNormalizationFactor('acres');
      const [created] = mapAppliedItems(
        [{ name: 'Urea', quantity: 10, unit: 'kg', quantityBasis: 'per_acre' }],
        { perAreaToPerAcreFactor: acresFactor },
      );
      expect(created.quantity).toBe(10);
      expect(formQuantityFromStored(created.quantity, 'per_acre', acresFactor)).toBe(10);
    });
  });

  describe('buildChemicalSummary', () => {
    it('joins every row (no filtering) as "name (qty unit)"', () => {
      expect(
        buildChemicalSummary([
          { name: 'A', quantity: 2, unit: 'gm/L' },
          { name: 'B', quantity: 0, unit: 'ml/L' },
        ]),
      ).toBe('A (2 gm/L), B (0 ml/L)');
    });

    it('returns an empty string for no rows', () => {
      expect(buildChemicalSummary([])).toBe('');
    });
  });

  describe('buildWaterDoseString', () => {
    it('formats the water volume', () => {
      expect(buildWaterDoseString(200)).toBe('Water: 200L');
    });

    it('renders null/undefined volumes verbatim (legacy behavior)', () => {
      expect(buildWaterDoseString(null)).toBe('Water: nullL');
      expect(buildWaterDoseString(undefined)).toBe('Water: undefinedL');
    });
  });
});
