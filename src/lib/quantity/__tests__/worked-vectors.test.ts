/**
 * Golden vectors from plan §5 "Worked vectors (become unit tests verbatim)".
 *
 * Every row asserts the exact intermediate value (canonical kg / L at full
 * precision — `toBe` where the IEEE double is exact, `toBeCloseTo(…, 12)`
 * where float representation prevents bit-exactness; 12 decimal places is far
 * beyond any real tolerance and still catches any wrong factor) and the
 * §5-rendered display string via format().
 *
 * | Input                     | Context        | Per plot  | Per acre        | Per liter |
 * | 250 ml/acre liquid        | 3.5 acre plot  | ≈ 875 ml  | 250 ml          | —         |
 * | 30 g/L fungicide          | 400 L water    | ≈ 12 kg   | ≈ 3.43 kg (÷3.5)| 30 g/L    |
 * | 100 ppm GA3               | 400 L water    | ≈ 40 g    | ≈ 11.4 g        | 100 mg/L  |
 * | Legacy row: 500 'g/acre'  | 1.5 acre plot  | ≈ 750 g   | 500 g           | —         |
 * | Label: 500 mL/ha          | 3.5 acre plot  | ≈ 708 ml  | ≈ 202 ml (÷2.47105) | —     |
 * | 10 kg (total, tank)       | any            | 10 kg     | ÷ area          | ÷ water   |
 */

import { format, formatParts, parseUnit, totalFor } from '@/lib/quantity';

describe('§5 vector: 250 ml/acre liquid on a 3.5 acre plot', () => {
  const item = { quantity: 250, unit: 'ml/acre' };

  it('per plot: exactly 0.875 L, rendered ≈ 875 ml', () => {
    const total = totalFor(item, { areaAcres: 3.5 });
    expect(total).not.toBeNull();
    expect(total?.measure).toBe('volume');
    expect(total?.value).toBe(0.875); // exact double: 250 × 0.001 × 3.5
    expect(format(total!.value, total!.measure, { approx: true })).toBe('≈ 875 ml');
  });

  it('per acre: the rate itself, exactly 0.25 L/acre, rendered 250 ml', () => {
    const parsed = parseUnit(item.unit)!;
    expect(parsed.basis).toBe('per_acre');
    const ratePerAcre = item.quantity * parsed.factorToCanonical;
    expect(ratePerAcre).toBe(0.25); // exact double
    expect(formatParts(ratePerAcre, parsed.measure)).toEqual({ value: 250, scale: 'ml' });
  });

  it('per liter: not applicable — water-only context yields null, never a guess', () => {
    expect(totalFor(item, { waterLiters: 400 })).toBeNull();
  });
});

describe('§5 vector: 30 g/L fungicide in 400 L water (3.5 acre farm)', () => {
  const item = { quantity: 30, unit: 'gm/L' }; // CHEMICAL_UNITS spelling

  it('per plot: exactly 12 kg', () => {
    const total = totalFor(item, { waterLiters: 400 });
    expect(total).not.toBeNull();
    expect(total?.measure).toBe('mass');
    expect(total?.value).toBe(12); // exact double: 30 × 0.001 × 400
    expect(format(total!.value, total!.measure, { approx: true })).toBe('≈ 12 kg');
  });

  it('per acre: 12 kg ÷ 3.5 = 3.4285714285714284 kg, rendered ≈ 3.43 kg', () => {
    const total = totalFor(item, { waterLiters: 400 })!;
    const perAcre = total.value / 3.5;
    expect(perAcre).toBeCloseTo(3.4285714285714284, 12);
    expect(format(perAcre, total.measure, { approx: true })).toBe('≈ 3.43 kg');
  });

  it('per liter: the entered concentration, exactly 0.03 kg/L, rendered 30 g', () => {
    const parsed = parseUnit(item.unit)!;
    expect(parsed.basis).toBe('per_liter_water');
    const ratePerLiter = item.quantity * parsed.factorToCanonical;
    expect(ratePerLiter).toBe(0.03); // exact double
    expect(formatParts(ratePerLiter, parsed.measure)).toEqual({ value: 30, scale: 'g' });
  });

  it('per plot without a water volume: null (concentration-only), never guessed', () => {
    expect(totalFor(item, { areaAcres: 3.5 })).toBeNull();
  });
});

describe('§5 vector: 100 ppm GA3 in 400 L water (3.5 acre farm)', () => {
  const item = { quantity: 100, unit: 'ppm' };

  it('per plot: 0.04 kg (float-noise only), rendered ≈ 40 g', () => {
    const total = totalFor(item, { waterLiters: 400 });
    expect(total).not.toBeNull();
    expect(total?.measure).toBe('mass');
    expect(total?.value).toBeCloseTo(0.04, 12); // 100 × 1e-6 × 400
    expect(format(total!.value, total!.measure, { approx: true })).toBe('≈ 40 g');
  });

  it('per acre: 40 g ÷ 3.5 = 11.428571428571427 g, rendered ≈ 11.4 g', () => {
    const total = totalFor(item, { waterLiters: 400 })!;
    const perAcre = total.value / 3.5;
    expect(perAcre * 1000).toBeCloseTo(11.428571428571427, 9);
    expect(format(perAcre, total.measure, { approx: true })).toBe('≈ 11.4 g');
  });

  it('per liter: 100 ppm is natively 100 mg/L', () => {
    const parsed = parseUnit(item.unit)!;
    expect(parsed.basis).toBe('per_liter_water');
    const ratePerLiter = item.quantity * parsed.factorToCanonical;
    expect(ratePerLiter).toBeCloseTo(0.0001, 15); // kg per liter of water
    expect(formatParts(ratePerLiter, parsed.measure)).toEqual({ value: 100, scale: 'mg' });
  });

  it('without a water volume ppm resolves to null — bucketed, not guessed', () => {
    expect(totalFor(item, {})).toBeNull();
    expect(totalFor(item, { areaAcres: 3.5 })).toBeNull();
  });
});

describe("§5 vector: legacy row 500 'g/acre' on a 1.5 acre plot", () => {
  const item = { quantity: 500, unit: 'g/acre' };

  it('per plot: exactly 0.75 kg, rendered ≈ 750 g', () => {
    const total = totalFor(item, { areaAcres: 1.5 });
    expect(total).not.toBeNull();
    expect(total?.measure).toBe('mass');
    expect(total?.value).toBe(0.75); // exact double: 500 × 0.001 × 1.5
    expect(format(total!.value, total!.measure, { approx: true })).toBe('≈ 750 g');
  });

  it('per acre: the rate itself, exactly 0.5 kg/acre, rendered 500 g', () => {
    const parsed = parseUnit(item.unit)!;
    const ratePerAcre = item.quantity * parsed.factorToCanonical;
    expect(ratePerAcre).toBe(0.5); // exact double
    expect(formatParts(ratePerAcre, parsed.measure)).toEqual({ value: 500, scale: 'g' });
  });
});

describe('§5 vector: label claim 500 mL/ha (annexure source) prefilled onto a 3.5 acre plot', () => {
  const item = { quantity: 500, unit: 'mL/ha' };

  it('per acre: 500 ÷ 2.47105 = 202.34313348576518 ml, rendered ≈ 202 ml', () => {
    const parsed = parseUnit(item.unit)!;
    expect(parsed.measure).toBe('volume');
    expect(parsed.basis).toBe('per_acre');
    const ratePerAcreL = item.quantity * parsed.factorToCanonical;
    expect(ratePerAcreL * 1000).toBeCloseTo(202.34313348576518, 9);
    expect(format(ratePerAcreL, parsed.measure, { approx: true })).toBe('≈ 202 ml');
  });

  it('per plot: ≈ 0.7082009672001781 L, rendered ≈ 708 ml', () => {
    const total = totalFor(item, { areaAcres: 3.5 });
    expect(total).not.toBeNull();
    expect(total?.measure).toBe('volume');
    expect(total?.value).toBeCloseTo(0.7082009672001781, 12);
    expect(format(total!.value, total!.measure, { approx: true })).toBe('≈ 708 ml');
  });
});

describe('§5 vector: 10 kg (total, tank) — passes through in any context', () => {
  const item = { quantity: 10, unit: 'kg' };

  it('per plot: exactly 10 kg with no context at all', () => {
    const total = totalFor(item, {});
    expect(total).toEqual({ value: 10, measure: 'mass' });
    expect(format(total!.value, total!.measure)).toBe('10 kg');
  });

  it('per plot: context present but irrelevant — still exactly 10 kg', () => {
    expect(totalFor(item, { areaAcres: 3.5, waterLiters: 400 })).toEqual({
      value: 10,
      measure: 'mass',
    });
  });

  it('per acre lens: ÷ area (10 ÷ 3.5 = 2.857142857142857 kg, ≈ 2.86 kg)', () => {
    const total = totalFor(item, { areaAcres: 3.5 })!;
    const perAcre = total.value / 3.5;
    expect(perAcre).toBeCloseTo(2.857142857142857, 12);
    expect(format(perAcre, total.measure, { approx: true })).toBe('≈ 2.86 kg');
  });

  it('per liter lens: ÷ water if logged (10 ÷ 400 = exactly 0.025 kg/L, ≈ 25 g)', () => {
    const total = totalFor(item, { waterLiters: 400 })!;
    const perLiter = total.value / 400;
    expect(perLiter).toBe(0.025); // exact double
    expect(format(perLiter, total.measure, { approx: true })).toBe('≈ 25 g');
  });
});
