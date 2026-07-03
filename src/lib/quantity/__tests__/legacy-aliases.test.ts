/**
 * Round-trip coverage of every legacy alias vocabulary the kernel replaces.
 *
 * The lists are DERIVED from the constants modules (not copied), so adding an
 * alias to any legacy table without teaching the kernel fails this suite —
 * drift is a test failure, not a silent corruption.
 */

import {
  UNIT_ALIASES_TO_COUNT,
  UNIT_ALIASES_TO_KG,
  UNIT_ALIASES_TO_LITER,
} from '@/constants/units';
import { CHEMICAL_UNITS, FERTILIZER_UNITS } from '@/constants/calculator-models';
import { MEASURE_TO_UNIT, PLAN_ITEM_UNIT_OPTIONS } from '@/constants/fertilizer-units';
import { parseUnit } from '@/lib/quantity';
import type { Basis, Measure } from '@/lib/quantity';

describe('units.ts alias sets (report-service vocabulary)', () => {
  it.each([...UNIT_ALIASES_TO_KG])('mass alias %j parses as mass', (alias) => {
    const parsed = parseUnit(alias);
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe('mass');
    expect(parsed?.basis).toBe('total');
  });

  it.each([...UNIT_ALIASES_TO_LITER])('volume alias %j parses as volume', (alias) => {
    const parsed = parseUnit(alias);
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe('volume');
    expect(parsed?.basis).toBe('total');
  });

  it.each([...UNIT_ALIASES_TO_COUNT])('count alias %j parses as count', (alias) => {
    const parsed = parseUnit(alias);
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe('count');
    expect(parsed?.basis).toBe('total');
  });

  // report-service.ts normalizeUnit accepts every alias with an '/acre'
  // suffix (compacted, case-insensitive) — the kernel must cover that space.
  it.each([...UNIT_ALIASES_TO_KG, ...UNIT_ALIASES_TO_LITER, ...UNIT_ALIASES_TO_COUNT])(
    "'%s/acre' parses with basis per_acre and the same measure as the bare alias",
    (alias) => {
      const bare = parseUnit(alias);
      const perAcre = parseUnit(`${alias}/acre`);
      expect(perAcre).not.toBeNull();
      expect(perAcre?.basis).toBe('per_acre');
      expect(perAcre?.measure).toBe(bare?.measure);
      expect(perAcre?.factorToCanonical).toBe(bare?.factorToCanonical);
    },
  );
});

describe('calculator-models.ts unit tuples', () => {
  const chemicalExpectations: Record<string, { measure: Measure; basis: Basis }> = {
    'gm/L': { measure: 'mass', basis: 'per_liter_water' },
    'ml/L': { measure: 'volume', basis: 'per_liter_water' },
    ppm: { measure: 'mass', basis: 'per_liter_water' },
    kg: { measure: 'mass', basis: 'total' },
    gram: { measure: 'mass', basis: 'total' },
    liter: { measure: 'volume', basis: 'total' },
    ml: { measure: 'volume', basis: 'total' },
  };

  it('the expectation table covers CHEMICAL_UNITS exactly (drift guard)', () => {
    expect(Object.keys(chemicalExpectations).sort()).toEqual([...CHEMICAL_UNITS].sort());
  });

  it.each([...CHEMICAL_UNITS])('chemical unit %j parses to its expected point', (unit) => {
    const parsed = parseUnit(unit);
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe(chemicalExpectations[unit].measure);
    expect(parsed?.basis).toBe(chemicalExpectations[unit].basis);
  });

  it.each([...FERTILIZER_UNITS])('fertilizer unit %j parses non-null', (unit) => {
    expect(parseUnit(unit)).not.toBeNull();
  });
});

describe('fertilizer-units.ts plan-item vocabulary', () => {
  it.each([...PLAN_ITEM_UNIT_OPTIONS])('canonical plan unit %j parses non-null', (unit) => {
    expect(parseUnit(unit)).not.toBeNull();
  });

  it.each(Object.values(MEASURE_TO_UNIT))('MEASURE_TO_UNIT value %j parses non-null', (unit) => {
    expect(parseUnit(unit)).not.toBeNull();
  });

  it('plan units carry the right measure and basis', () => {
    expect(parseUnit('kg/acre')).toMatchObject({ measure: 'mass', basis: 'per_acre' });
    expect(parseUnit('g/acre')).toMatchObject({ measure: 'mass', basis: 'per_acre' });
    expect(parseUnit('L/acre')).toMatchObject({ measure: 'volume', basis: 'per_acre' });
    expect(parseUnit('ml/acre')).toMatchObject({ measure: 'volume', basis: 'per_acre' });
    expect(parseUnit('ppm')).toMatchObject({ measure: 'mass', basis: 'per_liter_water' });
  });

  // fertilizer-units.ts keeps its alias table private; these are its spellings
  // verbatim (UNIT_ALIASES in that file) so resolver parity stays proven.
  it.each([
    'kg/acre',
    'kg',
    'g/acre',
    'gram/acre',
    'gram',
    'l/acre',
    'liter/acre',
    'litre/acre',
    'liter',
    'litre',
    'ml/acre',
    'ml',
    'ppm',
  ])('fertilizer-units alias %j parses non-null', (alias) => {
    expect(parseUnit(alias)).not.toBeNull();
  });
});

describe('ad-hoc parser input spaces (spray-form, nutrient-flow-service)', () => {
  // spray-form.tsx resolveChemicalUnit spellings.
  it.each([
    ['gm/liter', 'mass', 'per_liter_water'],
    ['gm/litre', 'mass', 'per_liter_water'],
    ['gm/l', 'mass', 'per_liter_water'],
    ['g/l', 'mass', 'per_liter_water'],
    ['ml/liter', 'volume', 'per_liter_water'],
    ['ml/litre', 'volume', 'per_liter_water'],
    ['ml/l', 'volume', 'per_liter_water'],
    ['gm/acre', 'mass', 'per_acre'],
    ['ml/acre', 'volume', 'per_acre'],
  ])('spray-form spelling %j parses as %s + %s', (raw, measure, basis) => {
    const parsed = parseUnit(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe(measure);
    expect(parsed?.basis).toBe(basis);
  });

  // nutrient-flow-service.ts toProductMassKg switch tokens (base and /acre forms).
  it.each([
    'kg',
    'gram',
    'gm',
    'liter',
    'l',
    'ml',
    'gm/l',
    'gm/liter',
    'ml/l',
    'ml/liter',
    'ppm',
    'kg/acre',
    'gram/acre',
    'gm/acre',
    'liter/acre',
    'l/acre',
    'ml/acre',
  ])('nutrient-flow token %j parses non-null', (raw) => {
    expect(parseUnit(raw)).not.toBeNull();
  });
});
