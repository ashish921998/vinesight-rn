import {
  getPublishedBulkDensity,
  isValidExpiryDate,
  listExistingManufacturers,
  resolveCatalogBulkDensityValue,
} from '@/features/purchase/product-form-data';

describe('purchase product form data', () => {
  it('returns published bulk density for supported catalogue products', () => {
    expect(getPublishedBulkDensity('Urea')).toEqual(
      expect.objectContaining({
        densityKgPerL: 0.75,
        sourceUrl:
          'https://www.yara.co.uk/siteassets/crop-nutrition/fertiliser-handling-and-safety/physical-properties-of-fertilisers---yara-uk.pdf',
      }),
    );
    expect(getPublishedBulkDensity('Unknown product')).toBeNull();
  });

  it('clears a superseded preset when the next product has no published density', () => {
    expect(
      resolveCatalogBulkDensityValue({
        currentValue: '0.75',
        isCurrentValuePresetApplied: true,
        nextProductName: 'Unknown product',
      }),
    ).toBe('');
  });

  it('preserves a manually entered density when changing catalogue products', () => {
    expect(
      resolveCatalogBulkDensityValue({
        currentValue: '0.75',
        isCurrentValuePresetApplied: false,
        nextProductName: 'Unknown product',
      }),
    ).toBe('0.75');
  });

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
});
