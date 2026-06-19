import {
  hasPerAcreSuffix,
  normalizeUnitString,
  parseWaterVolumeLitersFromDose,
  shouldApplyAreaMultiplier,
  stripPerAcreSuffix,
} from '@/utils/unit-conversion';

describe('unit-conversion', () => {
  describe('normalizeUnitString', () => {
    it('lowercases, trims, and strips internal whitespace', () => {
      expect(normalizeUnitString('  KG ')).toBe('kg');
      expect(normalizeUnitString('Gm / L')).toBe('gm/l');
      expect(normalizeUnitString('ml / acre')).toBe('ml/acre');
      expect(normalizeUnitString('Liter')).toBe('liter');
    });

    it('leaves an already-normalized unit unchanged', () => {
      expect(normalizeUnitString('ppm')).toBe('ppm');
    });
  });

  describe('hasPerAcreSuffix', () => {
    it('detects the /acre suffix', () => {
      expect(hasPerAcreSuffix('kg/acre')).toBe(true);
      expect(hasPerAcreSuffix('ml/acre')).toBe(true);
    });

    it('is false without the suffix', () => {
      expect(hasPerAcreSuffix('kg')).toBe(false);
      expect(hasPerAcreSuffix('ml/l')).toBe(false);
    });
  });

  describe('stripPerAcreSuffix', () => {
    it('removes the /acre suffix', () => {
      expect(stripPerAcreSuffix('kg/acre')).toBe('kg');
    });

    it('leaves concentration and plain units intact', () => {
      expect(stripPerAcreSuffix('ml/l')).toBe('ml/l');
      expect(stripPerAcreSuffix('kg')).toBe('kg');
    });
  });

  describe('shouldApplyAreaMultiplier', () => {
    it('is true when basis is per_acre regardless of unit', () => {
      expect(shouldApplyAreaMultiplier('kg', 'per_acre')).toBe(true);
    });

    it('is true when the unit carries /acre regardless of basis', () => {
      expect(shouldApplyAreaMultiplier('kg/acre', 'total')).toBe(true);
      expect(shouldApplyAreaMultiplier('kg/acre', undefined)).toBe(true);
    });

    it('is false for a plain unit with total/absent basis', () => {
      expect(shouldApplyAreaMultiplier('kg', 'total')).toBe(false);
      expect(shouldApplyAreaMultiplier('kg', null)).toBe(false);
      expect(shouldApplyAreaMultiplier('kg', undefined)).toBe(false);
    });
  });

  describe('parseWaterVolumeLitersFromDose', () => {
    it('parses the Water token (case-insensitive)', () => {
      expect(parseWaterVolumeLitersFromDose('Water: 200 L')).toBe(200);
      expect(parseWaterVolumeLitersFromDose('water: 12.5 l')).toBe(12.5);
    });

    it('parses the token when embedded in a longer dose string', () => {
      expect(parseWaterVolumeLitersFromDose('Chem (5 ml), Water: 150 L')).toBe(150);
    });

    it('returns null when absent, zero, or nullish', () => {
      expect(parseWaterVolumeLitersFromDose('no water here')).toBeNull();
      expect(parseWaterVolumeLitersFromDose('Water: 0 L')).toBeNull();
      expect(parseWaterVolumeLitersFromDose(null)).toBeNull();
      expect(parseWaterVolumeLitersFromDose(undefined)).toBeNull();
    });
  });
});
