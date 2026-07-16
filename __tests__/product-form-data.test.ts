import {
  getPublishedBulkDensity,
  isValidExpiryDate,
  listExistingManufacturers,
} from '@/features/purchase/product-form-data';

describe('purchase product form data', () => {
  it('returns published bulk density for supported catalogue products', () => {
    expect(getPublishedBulkDensity('Urea')).toEqual(
      expect.objectContaining({ densityKgPerL: 0.75 }),
    );
    expect(getPublishedBulkDensity('Unknown product')).toBeNull();
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
