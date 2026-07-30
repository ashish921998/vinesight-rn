import type { MasterCatalogProduct } from '@/types';
import {
  parseComposition,
  validateWarehouseItemForm,
  type CompositionRow,
} from '@/features/purchase/warehouse-item-form-validation';

const NOW = new Date('2026-07-30T12:00:00.000Z');
const NOW_ISO = NOW.toISOString();

const row = (nutrient_code: string, percent: string): CompositionRow => ({
  id: `${nutrient_code}-${percent}`,
  nutrient_code,
  percent,
});

const validBaseInput = {
  name: 'NPK 19:19:19',
  type: 'fertilizer' as const,
  quantity: '10',
  unit: 'kg' as const,
  unitPrice: '500',
  reorderQuantity: '2',
  notes: 'notes',
  manufacturer: 'Yara',
  densityKgPerL: '',
  expiryDate: '',
  compositionRows: [row('N', '19'), row('P2O5', '19'), row('K2O', '19')],
  compositionSource: 'manual' as const,
  selectedCatalogProductId: null,
  selectedCatalogProduct: null,
  catalogSelectionTouched: false,
  editingItem: null,
};

function makeCatalogProduct(overrides: Partial<MasterCatalogProduct> = {}): MasterCatalogProduct {
  return {
    id: 1,
    name: 'NPK 19:19:19',
    manufacturer: 'Yara',
    active_ingredient: null,
    input_type: 'fertilizer',
    verification_tier: 'verified',
    formulation: null,
    density_kg_per_l: null,
    density_source_url: null,
    state_code: 'MH',
    is_active: true,
    ...overrides,
  };
}

describe('parseComposition', () => {
  it('keeps rows with a nutrient code and a positive percent <= 100', () => {
    expect(parseComposition([row('N', '19'), row('P2O5', '19.5'), row('K2O', '100')])).toEqual([
      { nutrient_code: 'N', percent: 19, basis: 'declared', notes: null },
      { nutrient_code: 'P2O5', percent: 19.5, basis: 'declared', notes: null },
      { nutrient_code: 'K2O', percent: 100, basis: 'declared', notes: null },
    ]);
  });

  it('drops empty, non-finite, zero, and out-of-range rows', () => {
    expect(
      parseComposition([
        row('N', ''),
        row('P2O5', '0'),
        row('K2O', '101'),
        row('Ca', 'abc'),
        row('', '5'),
      ]),
    ).toEqual([]);
  });

  it('uppercases nutrient codes', () => {
    expect(parseComposition([row('ca', '5')])).toEqual([
      { nutrient_code: 'CA', percent: 5, basis: 'declared', notes: null },
    ]);
  });
});

describe('validateWarehouseItemForm', () => {
  describe('validation errors (in submit order)', () => {
    it('fails with missing_name when name is blank', () => {
      const result = validateWarehouseItemForm({ ...validBaseInput, name: '   ' }, NOW);
      expect(result).toEqual({ ok: false, error: 'missing_name' });
    });

    it('fails with invalid_quantity for non-finite or non-positive quantity', () => {
      expect(validateWarehouseItemForm({ ...validBaseInput, quantity: '' }, NOW)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
      expect(validateWarehouseItemForm({ ...validBaseInput, quantity: '0' }, NOW)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
      expect(validateWarehouseItemForm({ ...validBaseInput, quantity: 'abc' }, NOW)).toEqual({
        ok: false,
        error: 'invalid_quantity',
      });
    });

    it('fails with invalid_unit_price for non-positive unit price', () => {
      expect(validateWarehouseItemForm({ ...validBaseInput, unitPrice: '0' }, NOW)).toEqual({
        ok: false,
        error: 'invalid_unit_price',
      });
    });

    it('fails with invalid_expiry_date for a malformed date', () => {
      expect(
        validateWarehouseItemForm({ ...validBaseInput, expiryDate: '28/02/2027' }, NOW),
      ).toEqual({ ok: false, error: 'invalid_expiry_date' });
    });

    it('fails with missing_composition when fertilizer has no valid rows', () => {
      expect(validateWarehouseItemForm({ ...validBaseInput, compositionRows: [] }, NOW)).toEqual({
        ok: false,
        error: 'missing_composition',
      });
    });

    it('fails with missing_density when a volume unit lacks density', () => {
      expect(
        validateWarehouseItemForm({ ...validBaseInput, unit: 'liter', densityKgPerL: '' }, NOW),
      ).toEqual({ ok: false, error: 'missing_density' });
    });

    it('does not require composition for spray type', () => {
      const result = validateWarehouseItemForm(
        { ...validBaseInput, type: 'spray', compositionRows: [] },
        NOW,
      );
      expect(result.ok).toBe(true);
    });

    it('does not require density for mass units', () => {
      const result = validateWarehouseItemForm(
        { ...validBaseInput, unit: 'kg', densityKgPerL: '' },
        NOW,
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('payload construction', () => {
    it('builds the payload with trimmed fields and parsed numerics', () => {
      const result = validateWarehouseItemForm(
        { ...validBaseInput, name: '  NPK 19  ', notes: '   ', manufacturer: '  Yara  ' },
        NOW,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload).toEqual({
        name: 'NPK 19',
        type: 'fertilizer',
        quantity: 10,
        unit: 'kg',
        unit_price: 500,
        reorder_quantity: 2,
        notes: null,
        manufacturer: 'Yara',
        density_kg_per_l: null,
        expiry_date: null,
        composition: [
          { nutrient_code: 'N', percent: 19, basis: 'declared', notes: null },
          { nutrient_code: 'P2O5', percent: 19, basis: 'declared', notes: null },
          { nutrient_code: 'K2O', percent: 19, basis: 'declared', notes: null },
        ],
        composition_source: 'manual',
        composition_updated_at: NOW_ISO,
        catalog_product_id: null,
        catalog_mapping_status: 'unmapped',
        catalog_mapping_source: 'manual',
        catalog_mapped_at: null,
      });
    });

    it('parses density only when present, finite, and positive', () => {
      const withDensity = validateWarehouseItemForm(
        { ...validBaseInput, unit: 'liter', densityKgPerL: '1.05' },
        NOW,
      );
      expect(withDensity.ok && withDensity.payload.density_kg_per_l).toBe(1.05);

      const staleDensity = validateWarehouseItemForm(
        { ...validBaseInput, unit: 'liter', densityKgPerL: '0' },
        NOW,
      );
      expect(staleDensity).toEqual({ ok: false, error: 'missing_density' });
    });

    it('nulls reorder_quantity when the field is empty', () => {
      const result = validateWarehouseItemForm({ ...validBaseInput, reorderQuantity: '' }, NOW);
      expect(result.ok && result.payload.reorder_quantity).toBe(null);
    });

    it('maps a selected verified catalog product to mapped_verified + preset', () => {
      const product = makeCatalogProduct({ verification_tier: 'verified' });
      const result = validateWarehouseItemForm(
        { ...validBaseInput, selectedCatalogProductId: 1, selectedCatalogProduct: product },
        NOW,
      );
      expect(result.ok && result.payload.catalog_product_id).toBe(1);
      expect(result.ok && result.payload.catalog_mapping_status).toBe('mapped_verified');
      expect(result.ok && result.payload.catalog_mapping_source).toBe('preset');
      expect(result.ok && result.payload.catalog_mapped_at).toBe(NOW_ISO);
    });

    it('maps a selected provisional catalog product to mapped_provisional', () => {
      const product = makeCatalogProduct({ verification_tier: 'provisional' });
      const result = validateWarehouseItemForm(
        { ...validBaseInput, selectedCatalogProductId: 1, selectedCatalogProduct: product },
        NOW,
      );
      expect(result.ok && result.payload.catalog_mapping_status).toBe('mapped_provisional');
    });

    it('preserves the previous catalog mapping when the product is no longer loaded', () => {
      const editingItem = {
        id: 7,
        name: 'old',
        type: 'fertilizer',
        quantity: 1,
        unit: 'kg' as const,
        unit_price: 1,
        catalog_product_id: 5,
        catalog_mapping_status: 'mapped_provisional' as const,
        catalog_mapping_source: 'preset' as const,
        catalog_mapped_at: '2026-01-01T00:00:00.000Z',
      };
      const result = validateWarehouseItemForm(
        {
          ...validBaseInput,
          selectedCatalogProductId: 5,
          selectedCatalogProduct: null,
          catalogSelectionTouched: false,
          editingItem,
        },
        NOW,
      );
      expect(result.ok && result.payload.catalog_product_id).toBe(5);
      expect(result.ok && result.payload.catalog_mapping_status).toBe('mapped_provisional');
      expect(result.ok && result.payload.catalog_mapping_source).toBe('preset');
      expect(result.ok && result.payload.catalog_mapped_at).toBe('2026-01-01T00:00:00.000Z');
    });

    it('resolves catalog_product_id to the touched selection when the product is unloaded', () => {
      const result = validateWarehouseItemForm(
        {
          ...validBaseInput,
          selectedCatalogProductId: 9,
          selectedCatalogProduct: null,
          catalogSelectionTouched: true,
          editingItem: null,
        },
        NOW,
      );
      expect(result.ok && result.payload.catalog_product_id).toBe(9);
      expect(result.ok && result.payload.catalog_mapping_status).toBe('unmapped');
    });
  });
});
