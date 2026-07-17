import {
  isCatalogBulkDensityValue,
  isValidExpiryDate,
  listExistingManufacturers,
  resolveCatalogBulkDensityValue,
} from '@/features/purchase/product-form-data';

describe('purchase product form data', () => {
  it('returns unique sorted manufacturers already used by the account', () => {
    expect(
      listExistingManufacturers([
        {
          name: 'A',
          type: 'fertilizer',
          quantity: 1,
          unit: 'kg',
          unit_price: 1,
          manufacturer: 'Yara',
        },
        {
          name: 'B',
          type: 'spray',
          quantity: 1,
          unit: 'liter',
          unit_price: 1,
          manufacturer: ' yara ',
        },
        {
          name: 'C',
          type: 'spray',
          quantity: 1,
          unit: 'liter',
          unit_price: 1,
          manufacturer: 'Bayer',
        },
      ]),
    ).toEqual(['Bayer', 'Yara']);
  });

  it('validates optional ISO expiry dates', () => {
    expect(isValidExpiryDate('')).toBe(true);
    expect(isValidExpiryDate('2027-02-28')).toBe(true);
    expect(isValidExpiryDate('2027-02-29')).toBe(false);
    expect(isValidExpiryDate('28/02/2027')).toBe(false);
  });

  it('recognizes a saved catalogue density without claiming a manual override', () => {
    expect(isCatalogBulkDensityValue(0.75, 0.75)).toBe(true);
    expect(isCatalogBulkDensityValue(0.82, 0.75)).toBe(false);
  });

  it('replaces only empty or catalog-applied density values', () => {
    expect(
      resolveCatalogBulkDensityValue({
        currentValue: '',
        isCurrentValueCatalogApplied: false,
        nextDensityKgPerL: 0.75,
      }),
    ).toEqual({ value: '0.75', isCatalogApplied: true });

    expect(
      resolveCatalogBulkDensityValue({
        currentValue: '0.75',
        isCurrentValueCatalogApplied: false,
        nextDensityKgPerL: 1.1,
      }),
    ).toEqual({ value: '0.75', isCatalogApplied: false });
  });

  it('clears stale catalog density when the next selection has no density', () => {
    expect(
      resolveCatalogBulkDensityValue({
        currentValue: '0.75',
        isCurrentValueCatalogApplied: true,
        nextDensityKgPerL: null,
      }),
    ).toEqual({ value: '', isCatalogApplied: false });
  });
});
