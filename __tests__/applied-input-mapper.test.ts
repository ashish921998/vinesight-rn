import {
  mapAppliedItems,
  buildChemicalSummary,
  buildWaterDoseString,
  type AppliedFormItem,
} from '@/utils/applied-input-mapper';

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
