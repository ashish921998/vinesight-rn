/**
 * Basis-fused fertigation unit chips (issue #195): chip vocabulary contract,
 * the bidirectional area echo through the quantity kernel, and the shared
 * 10×/1000× dose guardrail under fertigation-shaped references.
 */

import {
  ALL_FERTIGATION_UNIT_CHIPS,
  FERTIGATION_UNIT_CHIPS,
  FERTIGATION_UNIT_OVERFLOW_CHIPS,
  buildFertigationAreaEcho,
  fertigationChipForEntry,
} from '@/components/forms/fertigation-unit-chips';
import { evaluateDoseGuard } from '@/components/forms/product-dose';
import { FERTILIZER_UNITS } from '@/constants/calculator-models';
import { parseUnit, totalFor } from '@/lib/quantity';

describe('chip vocabulary contract', () => {
  it('the main chip row is exactly kg/acre, L/acre, kg, L — in that order', () => {
    expect(FERTIGATION_UNIT_CHIPS.map((chip) => chip.key)).toEqual([
      'kg/acre',
      'L/acre',
      'kg',
      'L',
    ]);
  });

  it('the overflow menu carries the gram/mL family, in order', () => {
    expect(FERTIGATION_UNIT_OVERFLOW_CHIPS.map((chip) => chip.key)).toEqual([
      'g/acre',
      'mL/acre',
      'g',
      'mL',
    ]);
  });

  it('persistence keys stay bare — no key ever spells "total"', () => {
    for (const chip of ALL_FERTIGATION_UNIT_CHIPS) {
      expect(chip.key.toLowerCase()).not.toContain('total');
    }
  });

  it('total chips carry a localized "(total)" labelKey while the key stays bare', () => {
    // The display string lives once in en.ts (resolved via t()); the chip
    // carries only the i18n key, never a duplicated English literal.
    expect(fertigationChipForEntry('kg', 'total')?.labelKey).toBe(
      'fertigationForm.fertilizers.unitLabels.kgTotal',
    );
    expect(fertigationChipForEntry('liter', 'total')?.labelKey).toBe(
      'fertigationForm.fertilizers.unitLabels.lTotal',
    );
    expect(fertigationChipForEntry('gram', 'total')?.labelKey).toBe(
      'fertigationForm.fertilizers.unitLabels.gTotal',
    );
    expect(fertigationChipForEntry('ml', 'total')?.labelKey).toBe(
      'fertigationForm.fertilizers.unitLabels.mlTotal',
    );
    for (const [unit, basis] of [
      ['kg', 'total'],
      ['liter', 'total'],
      ['gram', 'total'],
      ['ml', 'total'],
    ] as const) {
      expect(fertigationChipForEntry(unit, basis)?.label).toBeUndefined();
    }
  });

  it('gram/mL per-acre chips display "gm"/"mL" over their bare keys', () => {
    expect(fertigationChipForEntry('gram', 'per_acre')?.label).toBe('gm/acre');
    // per-acre kg/L keys already read clearly, so they need no separate label.
    expect(fertigationChipForEntry('kg', 'per_acre')?.label).toBeUndefined();
    expect(fertigationChipForEntry('liter', 'per_acre')?.label).toBeUndefined();
  });

  it('every chip carries a hint key for the picker subtitle', () => {
    for (const chip of ALL_FERTIGATION_UNIT_CHIPS) {
      expect(chip.hintKey).toMatch(/^fertigationForm\.fertilizers\.unitHints\./);
    }
  });

  it.each(ALL_FERTIGATION_UNIT_CHIPS.map((chip) => [chip.key, chip]))(
    'chip %s stores an existing FertilizerUnit spelling the kernel parses',
    (_key, chip) => {
      expect(FERTILIZER_UNITS).toContain(chip.unit);
      expect(parseUnit(chip.unit)).not.toBeNull();
    },
  );

  it.each(ALL_FERTIGATION_UNIT_CHIPS.map((chip) => [chip.key, chip]))(
    'chip %s round-trips through fertigationChipForEntry from its stored (unit, basis) pair',
    (_key, chip) => {
      expect(fertigationChipForEntry(chip.unit, chip.basis)?.key).toBe(chip.key);
    },
  );

  it('bare units resolve by unit + basis, matching existing storage shape', () => {
    expect(fertigationChipForEntry('kg', 'per_acre')?.key).toBe('kg/acre');
    expect(fertigationChipForEntry('kg', 'total')?.key).toBe('kg');
    expect(fertigationChipForEntry('kg', undefined)?.key).toBe('kg');
    expect(fertigationChipForEntry('liter', 'per_acre')?.key).toBe('L/acre');
    expect(fertigationChipForEntry('gram', 'total')?.key).toBe('g');
    expect(fertigationChipForEntry('ml', 'per_acre')?.key).toBe('mL/acre');
  });

  it('verbatim units are outside the vocabulary — ppm, kg/ha and unknown strings stay chipless', () => {
    expect(fertigationChipForEntry('ppm', 'total')).toBeNull();
    expect(fertigationChipForEntry('kg/ha', 'per_acre')).toBeNull();
    expect(fertigationChipForEntry('banana/acre', 'per_acre')).toBeNull();
    expect(fertigationChipForEntry('PPM', 'total')).toBeNull();
  });
});

describe('area echo (kernel round-trip, both directions)', () => {
  it('per-acre entry → plot total: 3 kg/acre on 3.5 acres = ≈ 10.5 kg', () => {
    const echo = buildFertigationAreaEcho(
      { quantity: 3, unit: 'kg', quantityBasis: 'per_acre' },
      3.5,
    );
    expect(echo).toEqual({ direction: 'to_total', areaAcres: 3.5, approxText: '≈ 10.5 kg' });
    // Round-trip: the echo total must be exactly what the kernel folds.
    expect(
      totalFor({ quantity: 3, unit: 'kg', quantityBasis: 'per_acre' }, { areaAcres: 3.5 }),
    ).toEqual({ value: 10.5, measure: 'mass' });
  });

  it('total entry → per-acre rate: 10 kg on 3.5 acres = ≈ 2.86 kg/acre (fractional area, render-time rounding)', () => {
    const echo = buildFertigationAreaEcho(
      { quantity: 10, unit: 'kg', quantityBasis: 'total' },
      3.5,
    );
    // Full precision internally (10 ÷ 3.5 = 2.857142…); format() rounds only at render.
    expect(echo).toEqual({ direction: 'to_per_acre', areaAcres: 3.5, approxText: '≈ 2.86 kg' });
  });

  it('volume entries keep their measure: 2 L/acre on 2.5 acres = ≈ 5 L', () => {
    expect(
      buildFertigationAreaEcho({ quantity: 2, unit: 'liter', quantityBasis: 'per_acre' }, 2.5),
    ).toEqual({ direction: 'to_total', areaAcres: 2.5, approxText: '≈ 5 L' });
  });

  it('derived figures rescale farmer-naturally: 350 g total on 3.5 acres = ≈ 100 g per acre', () => {
    expect(
      buildFertigationAreaEcho({ quantity: 350, unit: 'gram', quantityBasis: 'total' }, 3.5),
    ).toEqual({ direction: 'to_per_acre', areaAcres: 3.5, approxText: '≈ 100 g' });
  });

  it('a basis-neutral unit with no stored basis reads as total (kernel column rule)', () => {
    expect(
      buildFertigationAreaEcho({ quantity: 10, unit: 'kg', quantityBasis: undefined }, 2),
    ).toEqual({ direction: 'to_per_acre', areaAcres: 2, approxText: '≈ 5 kg' });
  });

  it('kernel-recognized verbatim rates still echo — 5 kg/ha resolves through the kernel factor', () => {
    const echo = buildFertigationAreaEcho(
      { quantity: 5, unit: 'kg/ha', quantityBasis: 'per_acre' },
      2.47105,
    );
    // 5 kg/ha ≡ 5 kg per 2.47105 acres → exactly 5 kg on a 2.47105-acre plot.
    expect(echo).toEqual({ direction: 'to_total', areaAcres: 2.47105, approxText: '≈ 5 kg' });
  });

  it('is silent when the area is missing or non-positive', () => {
    expect(
      buildFertigationAreaEcho({ quantity: 3, unit: 'kg', quantityBasis: 'per_acre' }, null),
    ).toBeNull();
    expect(
      buildFertigationAreaEcho({ quantity: 3, unit: 'kg', quantityBasis: 'per_acre' }, 0),
    ).toBeNull();
  });

  it('is silent for kernel-unknown verbatim units — never guesses a conversion', () => {
    expect(
      buildFertigationAreaEcho(
        { quantity: 5, unit: 'banana/acre', quantityBasis: 'per_acre' },
        3.5,
      ),
    ).toBeNull();
  });

  it('is silent for water concentrations — area cannot translate ppm', () => {
    expect(
      buildFertigationAreaEcho({ quantity: 100, unit: 'ppm', quantityBasis: 'total' }, 3.5),
    ).toBeNull();
  });

  it('is silent for empty or non-positive quantities', () => {
    expect(buildFertigationAreaEcho({ quantity: undefined, unit: 'kg' }, 3.5)).toBeNull();
    expect(buildFertigationAreaEcho({ quantity: 0, unit: 'kg' }, 3.5)).toBeNull();
  });
});

describe('dose guardrail (shared core, fertigation-shaped references)', () => {
  const ctx = { areaAcres: 3.5, waterLiters: null };

  it('warns high at exactly 10× the plan dose (per-acre vs per-acre, context-free)', () => {
    const warning = evaluateDoseGuard(
      { quantity: 50, unit: 'kg', quantityBasis: 'per_acre' },
      { plan: { quantity: 5, unit: 'kg/acre', quantityBasis: 'per_acre' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'plan', direction: 'high', ratio: 10 });
  });

  it('warns against the prior log across bases — totals resolve through the same area', () => {
    // Entered 35 kg total; last log 0.1 kg/acre × 3.5 acres = 0.35 kg → 100× high.
    const warning = evaluateDoseGuard(
      { quantity: 35, unit: 'kg', quantityBasis: 'total' },
      { history: { quantity: 0.1, unit: 'kg', quantityBasis: 'per_acre' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'history', direction: 'high', ratio: 100 });
  });

  it('warns low at 1/10 of the prior log', () => {
    const warning = evaluateDoseGuard(
      { quantity: 1, unit: 'kg', quantityBasis: 'total' },
      { history: { quantity: 10, unit: 'kg', quantityBasis: 'total' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'history', direction: 'low', ratio: 10 });
  });

  it('the 1000× fat-finger falls out of the same check', () => {
    const warning = evaluateDoseGuard(
      { quantity: 5000, unit: 'kg', quantityBasis: 'per_acre' },
      { plan: { quantity: 5, unit: 'kg/acre', quantityBasis: 'per_acre' } },
      ctx,
    );
    expect(warning).toMatchObject({ source: 'plan', direction: 'high', ratio: 1000 });
  });

  it('is silent with no reference at all (first-ever product log)', () => {
    expect(
      evaluateDoseGuard({ quantity: 5000, unit: 'kg', quantityBasis: 'total' }, {}, ctx),
    ).toBeNull();
  });

  it('stays silent across bases when the resolving area is missing', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 35, unit: 'kg', quantityBasis: 'total' },
        { history: { quantity: 0.1, unit: 'kg', quantityBasis: 'per_acre' } },
        { areaAcres: null, waterLiters: null },
      ),
    ).toBeNull();
  });

  it('never crosses measures — a liter entry vs a kg reference stays silent', () => {
    expect(
      evaluateDoseGuard(
        { quantity: 500, unit: 'liter', quantityBasis: 'total' },
        { history: { quantity: 5, unit: 'kg', quantityBasis: 'total' } },
        ctx,
      ),
    ).toBeNull();
  });
});
