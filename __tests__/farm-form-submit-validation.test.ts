import {
  MAX_SOIL_FIELD_ABS,
  validateAndParseOptionalFarmNumbers,
} from '@/utils/farm-form-submit-validation';

const labels = {
  bulkDensity: 'Bulk Density',
  cationExchangeCapacity: 'Cation Exchange Capacity',
  soilWaterRetention: 'Soil Water Retention',
};

const baseRawValues = {
  vineSpacing: '',
  rowSpacing: '',
  totalTankCapacity: '',
  systemDischarge: '',
  bulkDensity: '',
  cationExchangeCapacity: '',
  soilWaterRetention: '',
};

describe('validateAndParseOptionalFarmNumbers', () => {
  it('returns precision overflow with specific field labels', () => {
    const result = validateAndParseOptionalFarmNumbers(
      {
        ...baseRawValues,
        bulkDensity: '10000.1',
        cationExchangeCapacity: '12000',
        soilWaterRetention: '23',
      },
      labels,
    );

    expect(result.error).toEqual({
      code: 'precision_overflow',
      fields: ['Bulk Density', 'Cation Exchange Capacity'],
    });
  });

  it('accepts values at the configured precision boundary', () => {
    const result = validateAndParseOptionalFarmNumbers(
      {
        ...baseRawValues,
        bulkDensity: String(MAX_SOIL_FIELD_ABS),
        cationExchangeCapacity: String(MAX_SOIL_FIELD_ABS),
        soilWaterRetention: String(MAX_SOIL_FIELD_ABS),
      },
      labels,
    );

    expect(result.error).toBeUndefined();
    expect(result.parsed.bulkDensity).toBe(MAX_SOIL_FIELD_ABS);
    expect(result.parsed.cationExchangeCapacity).toBe(MAX_SOIL_FIELD_ABS);
    expect(result.parsed.soilWaterRetention).toBe(MAX_SOIL_FIELD_ABS);
  });

  it('returns invalid numeric when a non-number is provided', () => {
    const result = validateAndParseOptionalFarmNumbers(
      {
        ...baseRawValues,
        bulkDensity: 'abc',
      },
      labels,
    );

    expect(result.error).toEqual({ code: 'invalid_numeric' });
  });

  it('returns out-of-bounds when optional numeric value exceeds maximum', () => {
    const result = validateAndParseOptionalFarmNumbers(
      {
        ...baseRawValues,
        totalTankCapacity: '1000001',
      },
      labels,
    );

    expect(result.error).toEqual({ code: 'out_of_bounds' });
  });
});
