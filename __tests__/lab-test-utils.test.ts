import {
  normalizeParameterKey,
  getParamStatus,
  selectDisplayParams,
  validateAndCleanParameters,
} from '@/utils/lab-test-utils';

describe('normalizeParameterKey', () => {
  it('maps pH -> ph for soil', () => {
    expect(normalizeParameterKey('pH', 'soil')).toBe('ph');
  });

  it('maps EC -> ec for soil', () => {
    expect(normalizeParameterKey('EC', 'soil')).toBe('ec');
  });

  it('maps N -> nitrogen for soil', () => {
    expect(normalizeParameterKey('N', 'soil')).toBe('nitrogen');
  });

  it('maps N -> total_nitrogen for petiole', () => {
    expect(normalizeParameterKey('N', 'petiole')).toBe('total_nitrogen');
  });

  it('maps element symbols for soil', () => {
    expect(normalizeParameterKey('P', 'soil')).toBe('phosphorus');
    expect(normalizeParameterKey('K', 'soil')).toBe('potassium');
    expect(normalizeParameterKey('Ca', 'soil')).toBe('calcium');
    expect(normalizeParameterKey('Mg', 'soil')).toBe('magnesium');
  });

  it('maps element symbols for petiole', () => {
    expect(normalizeParameterKey('P', 'petiole')).toBe('phosphorus');
    expect(normalizeParameterKey('K', 'petiole')).toBe('potassium');
    expect(normalizeParameterKey('Fe', 'petiole')).toBe('iron');
  });

  it('passes through unknown keys unchanged', () => {
    expect(normalizeParameterKey('unknown_key', 'soil')).toBe('unknown_key');
    expect(normalizeParameterKey('random', 'petiole')).toBe('random');
  });

  it('handles case-insensitive matching', () => {
    expect(normalizeParameterKey('ph', 'soil')).toBe('ph');
    expect(normalizeParameterKey('ec', 'soil')).toBe('ec');
  });
});

describe('getParamStatus', () => {
  const option = { optimalMin: 6.5, optimalMax: 7.5 };

  it('returns ok when value is within optimal range', () => {
    expect(getParamStatus(7.0, option)).toBe('ok');
  });

  it('returns warn when value is slightly outside optimal but within 10%', () => {
    // warnLow = 6.5 * 0.9 = 5.85, so 6.0 is between 5.85 and 6.5 => warn
    expect(getParamStatus(6.0, option)).toBe('warn');
    // warnHigh = 7.5 * 1.1 = 8.25, so 8.0 is between 7.5 and 8.25 => warn
    expect(getParamStatus(8.0, option)).toBe('warn');
  });

  it('returns bad when value is far outside optimal range', () => {
    // Below warnLow (5.85)
    expect(getParamStatus(5.0, option)).toBe('bad');
    // Above warnHigh (8.25)
    expect(getParamStatus(9.0, option)).toBe('bad');
  });

  it('returns ok when value is null or undefined', () => {
    expect(getParamStatus(null, option)).toBe('ok');
    expect(getParamStatus(undefined, option)).toBe('ok');
  });

  it('returns ok when option is undefined', () => {
    expect(getParamStatus(7.0, undefined)).toBe('ok');
  });

  it('handles string numeric values', () => {
    expect(getParamStatus('7.0', option)).toBe('ok');
    expect(getParamStatus('5.0', option)).toBe('bad');
  });
});

describe('selectDisplayParams', () => {
  it('prioritizes out-of-range params', () => {
    // pH with value far outside optimal (6.5-7.5) should be prioritized
    const params = {
      ph: 3.0, // bad - far below optimal
      nitrogen: 50, // likely ok
      phosphorus: 30, // likely ok
    };
    const result = selectDisplayParams(params, 'soil', 2);
    // ph should appear first since it's out of range
    expect(result.selected[0][0]).toBe('ph');
    expect(result.outOfRangeCount).toBeGreaterThanOrEqual(1);
  });

  it('fills remaining slots with core params', () => {
    const params = {
      ph: 7.0,
      ec: 0.5,
      nitrogen: 50,
      phosphorus: 30,
    };
    const result = selectDisplayParams(params, 'soil', 4);
    expect(result.selected.length).toBeLessThanOrEqual(4);
    expect(result.selected.length).toBeGreaterThan(0);
  });

  it('respects the limit', () => {
    const params = {
      ph: 7.0,
      ec: 0.5,
      nitrogen: 50,
      phosphorus: 30,
      potassium: 200,
      calcium: 100,
      magnesium: 50,
    };
    const result = selectDisplayParams(params, 'soil', 3);
    expect(result.selected.length).toBeLessThanOrEqual(3);
  });

  it('handles null params', () => {
    const result = selectDisplayParams(null, 'soil', 5);
    expect(result.selected).toEqual([]);
    expect(result.remainingCount).toBe(0);
  });

  it('handles empty params', () => {
    const result = selectDisplayParams({}, 'soil', 5);
    expect(result.selected).toEqual([]);
    expect(result.remainingCount).toBe(0);
  });

  it('handles undefined params', () => {
    const result = selectDisplayParams(undefined, 'soil', 5);
    expect(result.selected).toEqual([]);
    expect(result.remainingCount).toBe(0);
  });

  it('calculates remainingCount correctly', () => {
    const params = {
      ph: 7.0,
      ec: 0.5,
      nitrogen: 50,
      phosphorus: 30,
      potassium: 200,
    };
    const result = selectDisplayParams(params, 'soil', 2);
    expect(result.selected.length).toBe(2);
    expect(result.remainingCount).toBe(3);
  });
});

describe('validateAndCleanParameters', () => {
  it('normalizes keys and keeps valid values', () => {
    const raw = [
      { name: 'pH', value: 7.0 },
      { name: 'EC', value: 0.5 },
    ];
    const result = validateAndCleanParameters(raw, 'soil');
    expect(result).toHaveProperty('ph', 7.0);
    expect(result).toHaveProperty('ec', 0.5);
  });

  it('filters out NaN values', () => {
    const raw = [
      { name: 'pH', value: NaN },
      { name: 'EC', value: 0.5 },
    ];
    const result = validateAndCleanParameters(raw, 'soil');
    expect(result).not.toHaveProperty('ph');
    expect(result).toHaveProperty('ec', 0.5);
  });

  it('filters out keys that do not match any known parameter', () => {
    const raw = [
      { name: 'unknownParam', value: 100 },
      { name: 'pH', value: 7.0 },
    ];
    const result = validateAndCleanParameters(raw, 'soil');
    expect(result).not.toHaveProperty('unknownParam');
    expect(result).toHaveProperty('ph', 7.0);
  });

  it('handles petiole test type', () => {
    const raw = [
      { name: 'N', value: 2.5 },
      { name: 'P', value: 0.3 },
    ];
    const result = validateAndCleanParameters(raw, 'petiole');
    expect(result).toHaveProperty('total_nitrogen', 2.5);
    expect(result).toHaveProperty('phosphorus', 0.3);
  });

  it('returns empty object for empty input', () => {
    const result = validateAndCleanParameters([], 'soil');
    expect(result).toEqual({});
  });
});
