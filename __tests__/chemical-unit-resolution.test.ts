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

  // A fallback no LEGACY_TABLE row expects — if resolution ever silently
  // falls back instead of recognizing, the assertion cannot accidentally pass.
  const CANARY_FALLBACK = 'ppm' as const;

  it.each(LEGACY_TABLE)('resolves %j to %j exactly as the old table did', (raw, expected) => {
    expect(resolveChemicalUnit(raw, CANARY_FALLBACK)).toBe(expected);
  });

  it.each(LEGACY_TABLE)('parity holds for %j through the legacy folds (#193)', (raw, expected) => {
    // 'Kg per Acre' / 'kg / acre' style spellings the old foldUnitText handled.
    const wordy = raw.toUpperCase().replace('/', ' per ');
    const spaced = raw.replace('/', ' / ');
    expect(resolveChemicalUnit(wordy, CANARY_FALLBACK)).toBe(expected);
    expect(resolveChemicalUnit(spaced, CANARY_FALLBACK)).toBe(expected);
  });

  it('mixed-case legacy folds resolve the unit AND the basis coherently', () => {
    expect(resolveChemicalUnit('Kg per Acre', CANARY_FALLBACK)).toBe('kg');
    expect(resolveChemicalQuantityBasis('Kg per Acre')).toBe('per_acre');
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
    ['liters/acre', 'liter'],
    ['litres', 'liter'],
    ['milliliter', 'ml'],
    ['mg/L', 'ppm'], // 1 ppm ≡ 1 mg per liter of spray water
    ['grams/litre', 'gm/L'],
    ['PPM', 'ppm'], // old isChemicalUnit membership check was case-sensitive
  ])('%j → %j', (raw, expected) => {
    expect(resolveChemicalUnit(raw, 'kg')).toBe(expected);
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

  it('kernel basis is honored only for picker-representable units — a /ha rate must not pair per_acre with the fallback unit', () => {
    // 'kg/ha' is kernel-known (a per-acre-class rate) but unrepresentable in
    // the picker (÷2.47105 factor), so the unit falls back to gm/L. Pairing
    // that fallback with per_acre would make report-service area-multiply a
    // concentration. The basis must match the deleted table's text sniff:
    // no '/acre' in the text → total. (Fertigation differs deliberately —
    // its rows keep unrepresentable unit text verbatim, so the kernel basis
    // stays coherent there.)
    expect(resolveChemicalUnit('kg/ha')).toBe(DEFAULT_CHEMICAL_UNIT);
    expect(resolveChemicalQuantityBasis('kg/ha')).toBe('total');
    expect(resolveChemicalQuantityBasis('g/ha')).toBe('total');
    // '/acre' text on an unrepresentable scale still sniffs per_acre — the
    // deleted table behaved the same way (pre-existing pairing).
    expect(resolveChemicalQuantityBasis('mg/acre')).toBe('per_acre');
  });
});
