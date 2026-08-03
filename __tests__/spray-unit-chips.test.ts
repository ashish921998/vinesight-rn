/**
 * Basis-fused spray unit chips (issue #194): chip vocabulary contract, tank
 * echo round-trips through the quantity kernel, and the 10×/1000× dose
 * guardrail against independent references only.
 */

import {
  ALL_SPRAY_UNIT_CHIPS,
  SPRAY_UNIT_CHIPS,
  SPRAY_UNIT_OVERFLOW_CHIPS,
  buildTankEcho,
  chipForEntry,
  sprayUnitChipByKey,
} from '@/components/forms/spray-unit-chips';
// The guardrail is the shared product-dose core (#195) — spray asserts it
// through the same entry point the form uses.
import { evaluateDoseGuard } from '@/components/forms/product-dose';
import { CHEMICAL_UNITS } from '@/constants/calculator-models';
import { parseUnit, totalFor } from '@/lib/quantity';

describe('chip vocabulary contract', () => {
  it('the main chip row is exactly g/L, mL/L, g/acre, mL/acre, ppm — in that order', () => {
    expect(SPRAY_UNIT_CHIPS.map((chip) => chip.key)).toEqual([
      'g/L',
      'mL/L',
      'g/acre',
      'mL/acre',
      'ppm',
    ]);
  });

  it('the overflow menu carries the rare totals plus the per-acre kg/L plan shapes', () => {
    expect(SPRAY_UNIT_OVERFLOW_CHIPS.map((chip) => chip.key)).toEqual([
      'g total',
      'mL total',
      'kg total',
      'L total',
      'kg/acre',
      'L/acre',
    ]);
  });

  it.each(ALL_SPRAY_UNIT_CHIPS.map((chip) => [chip.key, chip]))(
    'chip %s stores an existing ChemicalUnit spelling the kernel parses',
    (_key, chip) => {
      expect(CHEMICAL_UNITS).toContain(chip.unit);
      expect(parseUnit(chip.unit)).not.toBeNull();
    },
  );

  it.each(ALL_SPRAY_UNIT_CHIPS.map((chip) => [chip.key, chip]))(
    'chip %s round-trips through chipForEntry from its stored (unit, basis) pair',
    (_key, chip) => {
      expect(chipForEntry(chip.unit, chip.basis)?.key).toBe(chip.key);
    },
  );

  it('per-liter unit strings win over the stored basis column (kernel testimony rule)', () => {
    // Legacy rows store quantityBasis 'total' alongside gm/L — the chip must
    // resolve from the unit string alone, exactly as the kernel does.
    expect(chipForEntry('gm/L', 'total')?.key).toBe('g/L');
    expect(chipForEntry('gm/L', 'per_acre')?.key).toBe('g/L');
    expect(chipForEntry('ppm', 'total')?.key).toBe('ppm');
  });

  it('bare units resolve by unit + basis, matching existing storage shape', () => {
    expect(chipForEntry('gram', 'per_acre')?.key).toBe('g/acre');
    expect(chipForEntry('gram', 'total')?.key).toBe('g total');
    expect(chipForEntry('gram', undefined)?.key).toBe('g total');
    expect(chipForEntry('kg', 'per_acre')?.key).toBe('kg/acre');
    expect(chipForEntry('liter', 'total')?.key).toBe('L total');
  });

  it('sprayUnitChipByKey resolves persisted keys and rejects unknown ones', () => {
    expect(sprayUnitChipByKey('g/acre')).toMatchObject({ unit: 'gram', basis: 'per_acre' });
    expect(sprayUnitChipByKey('furlongs')).toBeNull();
    expect(sprayUnitChipByKey(null)).toBeNull();
  });

  it('every chip carries a unit-picker hint key under the spray hints namespace', () => {
    for (const chip of ALL_SPRAY_UNIT_CHIPS) {
      expect(chip.hintKey).toMatch(/^sprayForm\.chemicals\.unitHints\./);
    }
  });

  it('the cryptic total keys carry a localized labelKey without churning the persistence key', () => {
    // Display rewording lives on `labelKey` (resolved via t(), English source
    // in en.ts); the stable `key` still drives last-used persistence and the
    // stored-pair resolution contract. No duplicated English `label` literal.
    expect(sprayUnitChipByKey('kg total')?.labelKey).toBe('sprayForm.chemicals.unitLabels.kgTotal');
    expect(sprayUnitChipByKey('g total')?.labelKey).toBe('sprayForm.chemicals.unitLabels.gTotal');
    expect(sprayUnitChipByKey('mL total')?.labelKey).toBe('sprayForm.chemicals.unitLabels.mlTotal');
    expect(sprayUnitChipByKey('L total')?.labelKey).toBe('sprayForm.chemicals.unitLabels.lTotal');
    for (const key of ['kg total', 'g total', 'mL total', 'L total']) {
      expect(sprayUnitChipByKey(key)?.label).toBeUndefined();
    }
    // Gram chips spell the unit as "gm" (non-localized label) while the key stays "g…".
    expect(sprayUnitChipByKey('g/L')?.label).toBe('gm/L');
    expect(sprayUnitChipByKey('g/acre')?.label).toBe('gm/acre');
    // Chips whose key already reads clearly carry no label and no labelKey.
    expect(sprayUnitChipByKey('kg/acre')?.label).toBeUndefined();
    expect(sprayUnitChipByKey('kg/acre')?.labelKey).toBeUndefined();
  });
});

describe('tank echo (kernel round-trip)', () => {
  it('2 g/L × 400 L water = 800 g in tank', () => {
    const echo = buildTankEcho(
      { quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
      { waterLiters: 400, areaAcres: null },
    );
    expect(echo).toEqual({ kind: 'water', contextValue: 400, totalText: '800 g' });
    // Round-trip: the echo total must be exactly what the kernel folds.
    expect(totalFor({ quantity: 2, unit: 'gm/L' }, { waterLiters: 400 })).toEqual({
      value: 0.8,
      measure: 'mass',
    });
  });

  it('100 g/acre × 2.5 acre = 250 g in tank', () => {
    const echo = buildTankEcho(
      { quantity: 100, unit: 'gram', quantityBasis: 'per_acre' },
      { waterLiters: 400, areaAcres: 2.5 },
    );
    expect(echo).toEqual({ kind: 'area', contextValue: 2.5, totalText: '250 g' });
  });

  it('500 ppm × 400 L water = 200 g in tank (ppm is spray-water-only)', () => {
    const echo = buildTankEcho(
      { quantity: 500, unit: 'ppm', quantityBasis: 'total' },
      { waterLiters: 400, areaAcres: 2.5 },
    );
    expect(echo).toEqual({ kind: 'water', contextValue: 400, totalText: '200 g' });
  });

  it('2.5 mL/L × 200 L water = 500 ml in tank (volume measure preserved)', () => {
    const echo = buildTankEcho(
      { quantity: 2.5, unit: 'ml/L', quantityBasis: 'total' },
      { waterLiters: 200, areaAcres: null },
    );
    expect(echo).toEqual({ kind: 'water', contextValue: 200, totalText: '500 ml' });
  });

  it('is silent for totals — the entry already is the tank amount', () => {
    expect(
      buildTankEcho(
        { quantity: 800, unit: 'gram', quantityBasis: 'total' },
        { waterLiters: 400, areaAcres: 2.5 },
      ),
    ).toBeNull();
  });

  it('is silent when the needed context is missing', () => {
    expect(
      buildTankEcho({ quantity: 2, unit: 'gm/L', quantityBasis: 'total' }, { areaAcres: 2.5 }),
    ).toBeNull();
    expect(
      buildTankEcho(
        { quantity: 100, unit: 'gram', quantityBasis: 'per_acre' },
        { waterLiters: 400 },
      ),
    ).toBeNull();
  });

  it('is silent for empty or non-positive quantities', () => {
    expect(buildTankEcho({ quantity: undefined, unit: 'gm/L' }, { waterLiters: 400 })).toBeNull();
    expect(buildTankEcho({ quantity: 0, unit: 'gm/L' }, { waterLiters: 400 })).toBeNull();
  });
});

describe('dose guardrail', () => {
  const ctx = { waterLiters: 400, areaAcres: 2.5 };

  it('warns high at exactly 10× the plan dose', () => {
    const warning = evaluateDoseGuard(
      { quantity: 20, unit: 'gm/L', quantityBasis: 'total' },
      { plan: { quantity: 2, unit: 'gm/L' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'plan', direction: 'high', ratio: 10 });
  });

  it('the 1000× fat-finger falls out of the same check', () => {
    const warning = evaluateDoseGuard(
      { quantity: 2000, unit: 'gm/L', quantityBasis: 'total' },
      { history: { quantity: 2, unit: 'gm/L' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'history', direction: 'high', ratio: 1000 });
  });

  it('warns low at 1/10 of the prior log', () => {
    const warning = evaluateDoseGuard(
      { quantity: 0.2, unit: 'gm/L', quantityBasis: 'total' },
      { history: { quantity: 2, unit: 'gm/L' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'history', direction: 'low', ratio: 10 });
  });

  it('normalizes across unit spellings via the kernel (2 g/L vs 2000 ppm is 1×, not 1000×)', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
        { history: { quantity: 2000, unit: 'ppm' } },
        ctx,
      ),
    ).toBeNull();
  });

  it('compares across bases through canonical plot totals under the same context', () => {
    // Entered 2 g/L × 400 L = 800 g; plan 32 g/acre × 2.5 acre = 80 g → 10× high.
    const warning = evaluateDoseGuard(
      { quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
      { plan: { quantity: 32, unit: 'g/acre', quantityBasis: 'per_acre' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'plan', direction: 'high', ratio: 10 });
  });

  it('stays silent across bases when the resolving context is missing', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
        { plan: { quantity: 32, unit: 'g/acre', quantityBasis: 'per_acre' } },
        { waterLiters: 400 },
      ),
    ).toBeNull();
  });

  it('is silent with no reference at all (first-ever product log)', () => {
    expect(
      evaluateDoseGuard({ quantity: 2000, unit: 'gm/L', quantityBasis: 'total' }, {}, ctx),
    ).toBeNull();
  });

  it('never crosses measures — a 1000× mL/L entry vs a g/L reference stays silent', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 2000, unit: 'ml/L', quantityBasis: 'total' },
        { history: { quantity: 2, unit: 'gm/L' } },
        ctx,
      ),
    ).toBeNull();
  });

  it('a sane linked plan dose is authoritative — history never second-guesses it', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
        {
          plan: { quantity: 2.5, unit: 'gm/L' },
          history: { quantity: 0.001, unit: 'gm/L' },
        },
        ctx,
      ),
    ).toBeNull();
  });

  it('falls through to history when the plan reference is not comparable', () => {
    const warning = evaluateDoseGuard(
      { quantity: 20, unit: 'gm/L', quantityBasis: 'total' },
      {
        plan: { quantity: 2, unit: 'ml/L' }, // volume vs mass — incomparable
        history: { quantity: 2, unit: 'gm/L' },
      },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'history', direction: 'high', ratio: 10 });
  });

  it('is silent inside the sane band (9× does not warn)', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 18, unit: 'gm/L', quantityBasis: 'total' },
        { history: { quantity: 2, unit: 'gm/L' } },
        ctx,
      ),
    ).toBeNull();
  });
});
