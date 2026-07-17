import type { ChemicalEntry, FertilizerEntry, SprayFormData } from '@/components/forms';
import {
  buildEntryLogRecordFields,
  buildFertigationItems,
  buildSprayChemicalItems,
  buildSprayChemicalSummary,
  perAcreFactor,
  resolveSprayPhi,
} from '@/utils/entry-log-fields';

const HECTARES_TO_ACRES = 0.404686;

function chemical(overrides: Partial<ChemicalEntry> = {}): ChemicalEntry {
  return {
    id: 'c1',
    name: 'Captan',
    quantity: 2,
    unit: 'gm/L',
    quantityBasis: 'total',
    ...overrides,
  };
}

function fertilizer(overrides: Partial<FertilizerEntry> = {}): FertilizerEntry {
  return {
    id: 'f1',
    name: 'Urea',
    quantity: 5,
    unit: 'kg',
    quantityBasis: 'total',
    ...overrides,
  };
}

function sprayData(overrides: Partial<SprayFormData> = {}): SprayFormData {
  return {
    waterVolume: 200,
    chemicals: [],
    catalogMixId: null,
    ...overrides,
  };
}

describe('buildEntryLogRecordFields', () => {
  it('maps and validates simple record fields at the shared boundary', () => {
    expect(
      buildEntryLogRecordFields({ type: 'irrigation', data: { duration: 2 } }, { area: 4 }),
    ).toEqual({ type: 'irrigation', fields: { duration: 2 } });
    expect(
      buildEntryLogRecordFields(
        { type: 'expense', data: { type: 'Other', cost: 500, remarks: '  misc  ' } },
        {},
      ),
    ).toEqual({
      type: 'expense',
      fields: { type: 'other', cost: 500, remarks: '  misc  ' },
    });
    expect(
      buildEntryLogRecordFields({ type: 'note', data: { notes: '  checked vines  ' } }, {}),
    ).toEqual({ type: 'note', fields: { notes: 'checked vines' } });
  });

  it('rejects invalid irrigation and blank notes for both save paths', () => {
    expect(() =>
      buildEntryLogRecordFields({ type: 'irrigation', data: { duration: 0 } }, {}),
    ).toThrow('Invalid irrigation duration');
    expect(() => buildEntryLogRecordFields({ type: 'note', data: { notes: '   ' } }, {})).toThrow(
      'Invalid note',
    );
  });
});

describe('perAcreFactor', () => {
  it('is 1 for acres and unset preferences', () => {
    expect(perAcreFactor('acres')).toBe(1);
    expect(perAcreFactor(null)).toBe(1);
    expect(perAcreFactor(undefined)).toBe(1);
  });

  it('converts hectares to acres', () => {
    expect(perAcreFactor('hectares')).toBe(HECTARES_TO_ACRES);
  });
});

describe('buildSprayChemicalSummary', () => {
  it('joins each chemical as "name (qty unit)"', () => {
    expect(
      buildSprayChemicalSummary([
        chemical({ name: 'Captan', quantity: 2, unit: 'gm/L' }),
        chemical({ id: 'c2', name: 'Sulfur', quantity: 1, unit: 'ml/L' }),
      ]),
    ).toBe('Captan (2 gm/L), Sulfur (1 ml/L)');
  });
});

describe('buildSprayChemicalItems', () => {
  it('drops blank-name and non-positive-quantity rows and trims names', () => {
    const items = buildSprayChemicalItems(
      [
        chemical({ name: '  Captan  ', quantity: 2 }),
        chemical({ id: 'c2', name: '   ', quantity: 5 }),
        chemical({ id: 'c3', name: 'Zero', quantity: 0 }),
        chemical({ id: 'c4', name: 'Missing', quantity: undefined }),
      ],
      1,
    );
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Captan');
  });

  it('scales per_acre quantities by the factor and leaves total unchanged', () => {
    const [perAcre] = buildSprayChemicalItems(
      [chemical({ quantity: 10, quantityBasis: 'per_acre' })],
      HECTARES_TO_ACRES,
    );
    expect(perAcre.quantity).toBeCloseTo(10 * HECTARES_TO_ACRES, 6);
    expect(perAcre.quantity_basis).toBe('per_acre');

    const [total] = buildSprayChemicalItems(
      [chemical({ quantity: 10, quantityBasis: 'total' })],
      HECTARES_TO_ACRES,
    );
    expect(total.quantity).toBe(10);
  });

  it('passes through catalog/warehouse identifiers, defaulting to null', () => {
    const [item] = buildSprayChemicalItems(
      [chemical({ warehouseItemId: 7, catalogProductId: 9 })],
      1,
    );
    expect(item.warehouse_item_id).toBe(7);
    expect(item.catalog_product_id).toBe(9);
    expect(item.plan_item_id).toBeNull();
    expect(item.composition_snapshot).toBeNull();
    expect(item.density_kg_per_l).toBeNull();
  });
});

describe('buildFertigationItems', () => {
  it('keeps the unit verbatim and flags kernel-unknown strings', () => {
    const [known] = buildFertigationItems([fertilizer({ unit: 'kg' })], 1);
    expect(known.unit).toBe('kg');
    expect(known).not.toHaveProperty('unit_unrecognized');

    const [unknown] = buildFertigationItems([fertilizer({ unit: 'scoops' })], 1);
    expect(unknown.unit).toBe('scoops');
    expect(unknown).toHaveProperty('unit_unrecognized', true);
  });

  it('scales per_acre quantities and drops empty rows', () => {
    const items = buildFertigationItems(
      [
        fertilizer({ quantity: 4, quantityBasis: 'per_acre' }),
        fertilizer({ id: 'f2', name: '  ', quantity: 3 }),
      ],
      HECTARES_TO_ACRES,
    );
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBeCloseTo(4 * HECTARES_TO_ACRES, 6);
  });
});

describe('resolveSprayPhi', () => {
  it('is unknown with no notes for a non-catalog spray', () => {
    expect(resolveSprayPhi(sprayData({ catalogMixId: null }))).toEqual({
      hasCatalogMix: false,
      hasResolvedPhi: false,
      normalizedPhiStatus: 'unknown',
      notes: '',
    });
  });

  it('honors an explicit phiStatus on a non-catalog spray', () => {
    expect(
      resolveSprayPhi(sprayData({ catalogMixId: null, phiStatus: 'verified' })).normalizedPhiStatus,
    ).toBe('verified');
  });

  it('marks a catalog spray without resolved PHI as legacy_unverified and flags it', () => {
    const result = resolveSprayPhi(
      sprayData({ catalogMixId: 42, safeHarvestDate: null, governingPhiDays: null }),
    );
    expect(result.hasResolvedPhi).toBe(false);
    expect(result.normalizedPhiStatus).toBe('legacy_unverified');
    expect(result.notes).toBe('[PHI_UNAVAILABLE] Saved without resolved PHI metadata.');
  });

  it('verifies a catalog spray with resolved PHI, defaulting unknown status to verified', () => {
    const result = resolveSprayPhi(
      sprayData({
        catalogMixId: 42,
        safeHarvestDate: '2026-03-01',
        governingPhiDays: 7,
        phiStatus: 'unknown',
      }),
    );
    expect(result.hasResolvedPhi).toBe(true);
    expect(result.normalizedPhiStatus).toBe('verified');
    expect(result.notes).toBe('');
  });

  it('appends the override marker when phiOverride is set', () => {
    const result = resolveSprayPhi(
      sprayData({
        catalogMixId: 42,
        safeHarvestDate: null,
        governingPhiDays: null,
        phiOverride: true,
      }),
    );
    expect(result.notes).toBe(
      '[PHI_OVERRIDE] Harvest safety conflict override acknowledged in app. [PHI_UNAVAILABLE] Saved without resolved PHI metadata.',
    );
  });
});
