import {
  perAcreNormalizationFactor,
  convertAreaFromAcres,
  resolveAreaUnitPreference,
} from '@/utils/preferences';

describe('perAcreNormalizationFactor', () => {
  it('is 1 for acres (no conversion)', () => {
    expect(perAcreNormalizationFactor('acres')).toBe(1);
  });

  it('is acres-per-hectare (~0.404686) for hectares', () => {
    expect(perAcreNormalizationFactor('hectares')).toBeCloseTo(0.404686, 6);
  });

  it('reuses the acres->hectares area ratio (single source of the constant)', () => {
    // Normalizing a per-hectare rate onto per-acre uses "acres per hectare", which
    // is exactly the ratio that converts an area of 1 acre into hectares.
    expect(perAcreNormalizationFactor('hectares')).toBe(convertAreaFromAcres(1, 'hectares'));
  });
});

describe('resolveAreaUnitPreference', () => {
  it('passes through valid units and defaults everything else to acres', () => {
    expect(resolveAreaUnitPreference('hectares')).toBe('hectares');
    expect(resolveAreaUnitPreference('acres')).toBe('acres');
    expect(resolveAreaUnitPreference(undefined)).toBe('acres');
    expect(resolveAreaUnitPreference(null)).toBe('acres');
    expect(resolveAreaUnitPreference('furlongs')).toBe('acres');
  });
});
