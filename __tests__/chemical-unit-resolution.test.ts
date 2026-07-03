/**
 * Spray chemical unit resolution through the quantity kernel (issue #207).
 *
 * The spray form's inline spelling-enumeration table (foldUnitText /
 * resolveChemicalUnit / resolveQuantityBasis) is replaced by kernel-backed
 * resolution in src/constants/chemical-units.ts. These tests pin:
 *  1. Parity: every spelling the deleted table enumerated resolves the same.
 *  2. The picker vocabulary round-trips (guards CHEMICAL_UNITS drift).
 *  3. Kernel wins the table beat: spellings the table silently fell back on
 *     now resolve to their true measure.
 *  4. Basis resolution matches the deleted regex sniff, plus the kernel's
 *     '/ha is a rate' upgrade (#203 parity with fertigation).
 */

import { CHEMICAL_UNITS } from '@/constants/calculator-models';
import {
  DEFAULT_CHEMICAL_UNIT,
  resolveChemicalQuantityBasis,
  resolveChemicalUnit,
} from '@/constants/chemical-units';

describe('parity with the deleted spray-form enumeration table', () => {
  // Every spelling the old resolveChemicalUnit listed, verbatim, with the
  // ChemicalUnit it mapped to.
  const LEGACY_TABLE: [string, string][] = [
    ['gm/liter', 'gm/L'],
    ['gm/litre', 'gm/L'],
    ['gm/l', 'gm/L'],
    ['g/l', 'gm/L'],
    ['ml/liter', 'ml/L'],
    ['ml/litre', 'ml/L'],
    ['ml/l', 'ml/L'],
    ['gm/acre', 'gram'],
    ['g/acre', 'gram'],
    ['gram/acre', 'gram'],
    ['ml/acre', 'ml'],
    ['kg/acre', 'kg'],
    ['liter/acre', 'liter'],
    ['litre/acre', 'liter'],
    ['l/acre', 'liter'],
  ];

  it.each(LEGACY_TABLE)('resolves %j to %j exactly as the old table did', (raw, expected) => {
    expect(resolveChemicalUnit(raw)).toBe(expected);
  });

  it.each(LEGACY_TABLE)('parity holds for %j through the legacy folds (#193)', (raw, expected) => {
    // 'Kg per Acre' / 'kg / acre' style spellings the old foldUnitText handled.
    const wordy = raw.toUpperCase().replace('/', ' per ');
    const spaced = raw.replace('/', ' / ');
    expect(resolveChemicalUnit(wordy)).toBe(expected);
    expect(resolveChemicalUnit(spaced)).toBe(expected);
  });

  it('missing or unknown units keep the fallback contract', () => {
    expect(resolveChemicalUnit(null)).toBe(DEFAULT_CHEMICAL_UNIT);
    expect(resolveChemicalUnit(undefined)).toBe(DEFAULT_CHEMICAL_UNIT);
    expect(resolveChemicalUnit('   ')).toBe(DEFAULT_CHEMICAL_UNIT);
    expect(resolveChemicalUnit('banana/acre')).toBe(DEFAULT_CHEMICAL_UNIT);
    expect(resolveChemicalUnit('banana/acre', 'kg')).toBe('kg');
  });

  it('kernel-known units the picker cannot represent still fall back (never mislabeled)', () => {
    // kg/L, bare mg, counts, and /ha rates (÷2.47105 factor a bare scale
    // cannot carry) must not be squeezed into a picker unit.
    for (const raw of ['kg/l', 'mg', 'bag', 'kg/ha', 'g/ha']) {
      expect(resolveChemicalUnit(raw)).toBe(DEFAULT_CHEMICAL_UNIT);
    }
  });
});

describe('picker vocabulary round-trip', () => {
  it.each([...CHEMICAL_UNITS])('%j resolves to itself', (unit) => {
    expect(resolveChemicalUnit(unit)).toBe(unit);
  });
});

describe('spellings the deleted table silently fell back on now resolve', () => {
  it.each([
    ['kilogram', 'kg'],
    ['kgs', 'kg'],
    ['gm', 'gram'],
    ['grams', 'gram'],
    ['litres', 'liter'],
    ['milliliter', 'ml'],
    ['mg/L', 'ppm'], // 1 ppm ≡ 1 mg per liter of spray water
    ['grams/litre', 'gm/L'],
  ])('%j → %j', (raw, expected) => {
    expect(resolveChemicalUnit(raw)).toBe(expected);
  });
});

describe('resolveChemicalQuantityBasis', () => {
  it('an explicit basis always wins', () => {
    expect(resolveChemicalQuantityBasis('kg/acre', 'total')).toBe('total');
    expect(resolveChemicalQuantityBasis('gm/L', 'per_acre')).toBe('per_acre');
  });

  it.each(['kg/acre', 'g/acre', 'ml/acre', 'l/acre', 'Kg per Acre', 'banana/acres'])(
    'per-acre testimony in %j yields per_acre (kernel-known or text sniff)',
    (raw) => {
      expect(resolveChemicalQuantityBasis(raw)).toBe('per_acre');
    },
  );

  it.each(['kg / acre', 'sacks / acre', 'banana / acre'])(
    'spaced-slash spelling %j still yields per_acre (the old foldUnitText collapsed " / ")',
    (raw) => {
      expect(resolveChemicalQuantityBasis(raw)).toBe('per_acre');
    },
  );

  it.each(['gm/L', 'ml/L', 'ppm', 'kg', 'gram', 'liter', 'ml', '', '  ', 'kgg'])(
    '%j yields total',
    (raw) => {
      expect(resolveChemicalQuantityBasis(raw)).toBe('total');
    },
  );

  it("'/acreage' never false-positives; missing units default to total", () => {
    expect(resolveChemicalQuantityBasis('foo/acreage')).toBe('total');
    expect(resolveChemicalQuantityBasis(null)).toBe('total');
    expect(resolveChemicalQuantityBasis(undefined)).toBe('total');
  });

  it("'/ha' is a per-acre-class rate, matching fertigation (#203) — upgraded from the old text sniff", () => {
    expect(resolveChemicalQuantityBasis('kg/ha')).toBe('per_acre');
  });
});
