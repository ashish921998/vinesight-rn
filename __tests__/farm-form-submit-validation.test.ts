import {
  NUMERIC_6_4_MAX_ABS,
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
        bulkDensity: '223',
        cationExchangeCapacity: '323',
        soilWaterRetention: '23',
      },
      labels,
    );

    expect(result.error).toEqual({
      code: 'precision_overflow',
      fields: ['Bulk Density', 'Cation Exchange Capacity'],
    });
  });

  it('accepts values at NUMERIC(6,4) boundary', () => {
    const result = validateAndParseOptionalFarmNumbers(
      {
        ...baseRawValues,
        bulkDensity: String(NUMERIC_6_4_MAX_ABS),
        cationExchangeCapacity: String(NUMERIC_6_4_MAX_ABS),
        soilWaterRetention: String(NUMERIC_6_4_MAX_ABS),
      },
      labels,
    );

    expect(result.error).toBeUndefined();
    expect(result.parsed.bulkDensity).toBe(NUMERIC_6_4_MAX_ABS);
    expect(result.parsed.cationExchangeCapacity).toBe(NUMERIC_6_4_MAX_ABS);
    expect(result.parsed.soilWaterRetention).toBe(NUMERIC_6_4_MAX_ABS);
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
