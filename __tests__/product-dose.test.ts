/**
 * Recommended-dose range guardrail tests (issue #236).
 *
 * The guardrail fires at 2× outside the label range: HIGH when entered ≥ max×2,
 * LOW when entered ≤ min/2. Advisory only — never blocks. Kernel-normalized:
 * same basis → direct ratio; different bases → both resolve to plot totals.
 * Measures never cross. No guidance or no context → null (silent).
 *
 * The plan/history 10× guardrail (evaluateDoseGuard) is covered in
 * fertigation-unit-chips.test.ts and spray-unit-chips.test.ts — left untouched.
 */
import {
  evaluateDoseGuidanceGuard,
  type DoseGuidanceReference,
} from '@/components/forms/product-dose';

const ctx = { areaAcres: 3.5, waterLiters: null };

describe('evaluateDoseGuidanceGuard — range guardrail (issue #236)', () => {
  it('fires HIGH at 2× the max bound (per-liter vs per-liter, context-free)', () => {
    // Label 3–6 g/L; entered 12 g/L = 2× max → fires.
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    const warning = evaluateDoseGuidanceGuard(
      { quantity: 12, unit: 'g/L', quantityBasis: 'total' },
      guidance,
      ctx,
    );
    expect(warning).toMatchObject({ direction: 'high', entered: 12 });
    expect(warning?.reference).toEqual(guidance);
  });

  it('fires HIGH for the issue headline example (30 g/L vs label 3–6 g/L)', () => {
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    const warning = evaluateDoseGuidanceGuard(
      { quantity: 30, unit: 'g/L', quantityBasis: 'total' },
      guidance,
      ctx,
    );
    expect(warning?.direction).toBe('high');
  });

  it('stays silent on a barely-over entry (7 g/L vs label 3–6 g/L)', () => {
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    expect(
      evaluateDoseGuidanceGuard(
        { quantity: 7, unit: 'g/L', quantityBasis: 'total' },
        guidance,
        ctx,
      ),
    ).toBeNull();
  });

  it('stays silent inside the range', () => {
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    expect(
      evaluateDoseGuidanceGuard(
        { quantity: 5, unit: 'g/L', quantityBasis: 'total' },
        guidance,
        ctx,
      ),
    ).toBeNull();
  });

  it('fires LOW at 1/2 the min bound', () => {
    // Label 3–6 g/L; entered 1.5 g/L = min/2 → fires low.
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    const warning = evaluateDoseGuidanceGuard(
      { quantity: 1.5, unit: 'g/L', quantityBasis: 'total' },
      guidance,
      ctx,
    );
    expect(warning).toMatchObject({ direction: 'low', entered: 1.5 });
  });

  it('warns across bases — per-acre entry vs total reference resolves through area', () => {
    // Label drip 1.25–2.5 kg/ha. The kernel folds kg/ha → kg/acre (÷2.47105),
    // so max 2.5 kg/ha ≈ 1.01 kg/acre. Entered 5 kg total on a 3.5-acre plot is
    // ~1.43 kg/acre vs ~1.01 max → total ratio 5 / (1.01×3.5) ≈ 1.41 < 2 → silent.
    // Bump entered to 8 kg total: 8 / (1.01×3.5) ≈ 2.26 ≥ 2 → fires high.
    const guidance: DoseGuidanceReference = { minValue: 1.25, maxValue: 2.5, unit: 'kg/ha' };
    const warning = evaluateDoseGuidanceGuard(
      { quantity: 8, unit: 'kg', quantityBasis: 'total' },
      guidance,
      ctx,
    );
    expect(warning?.direction).toBe('high');
  });

  it('stays silent across bases when the resolving area is missing', () => {
    const guidance: DoseGuidanceReference = { minValue: 1.25, maxValue: 2.5, unit: 'kg/ha' };
    expect(
      evaluateDoseGuidanceGuard({ quantity: 50, unit: 'kg', quantityBasis: 'total' }, guidance, {
        areaAcres: null,
        waterLiters: null,
      }),
    ).toBeNull();
  });

  it('never crosses measures — a liter entry vs a kg/g label stays silent', () => {
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    expect(
      evaluateDoseGuidanceGuard(
        { quantity: 500, unit: 'liter', quantityBasis: 'total' },
        guidance,
        ctx,
      ),
    ).toBeNull();
  });

  it('is silent with no guidance (first-ever product log)', () => {
    expect(
      evaluateDoseGuidanceGuard({ quantity: 30, unit: 'g/L', quantityBasis: 'total' }, null, ctx),
    ).toBeNull();
  });

  it('is silent for empty / non-positive / non-finite entries', () => {
    const guidance: DoseGuidanceReference = { minValue: 3, maxValue: 6, unit: 'g/L' };
    expect(
      evaluateDoseGuidanceGuard({ quantity: undefined, unit: 'g/L' }, guidance, ctx),
    ).toBeNull();
    expect(evaluateDoseGuidanceGuard({ quantity: 0, unit: 'g/L' }, guidance, ctx)).toBeNull();
  });

  it('is silent for an invalid range (max < min)', () => {
    const guidance: DoseGuidanceReference = { minValue: 6, maxValue: 3, unit: 'g/L' };
    expect(
      evaluateDoseGuidanceGuard(
        { quantity: 30, unit: 'g/L', quantityBasis: 'total' },
        guidance,
        ctx,
      ),
    ).toBeNull();
  });
});
