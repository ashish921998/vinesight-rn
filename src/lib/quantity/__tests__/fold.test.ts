import { fold } from '@/lib/quantity';
import { UNIT_ALIASES_TO_COUNT } from '@/constants/units';

describe('fold — measures never merge', () => {
  it('keeps mass, volume and count in separate buckets', () => {
    const result = fold([
      { quantity: 2, unit: 'kg' },
      { quantity: 3, unit: 'L' },
      { quantity: 4, unit: 'pcs' },
    ]);
    expect(result.totals).toEqual({ mass: 2, volume: 3, count: 4 });
    expect(result.skipped).toEqual([]);
  });

  it('sums within a measure across unit scales at full precision', () => {
    const result = fold([
      { quantity: 1, unit: 'kg' },
      { quantity: 250, unit: 'g' },
      { quantity: 500, unit: 'ml' },
      { quantity: 1, unit: 'liter' },
    ]);
    expect(result.totals.mass).toBe(1.25);
    expect(result.totals.volume).toBe(1.5);
    expect(result.totals.count).toBeUndefined();
  });

  it("folds 'L/acre' into volume even alongside mass items — liters can never become kilograms", () => {
    const result = fold(
      [
        { quantity: 2, unit: 'L/acre' },
        { quantity: 5, unit: 'kg' },
      ],
      { areaAcres: 3 },
    );
    expect(result.totals.volume).toBe(6);
    expect(result.totals.mass).toBe(5); // untouched by the L/acre item
    expect(result.skipped).toEqual([]);
  });
});

describe('fold — count is fold-only and never joins mass or volume', () => {
  it.each([...UNIT_ALIASES_TO_COUNT])('count alias %j lands in the count bucket only', (alias) => {
    const result = fold([{ quantity: 2, unit: alias }]);
    expect(result.totals.count).toBe(2);
    expect(result.totals.mass).toBeUndefined();
    expect(result.totals.volume).toBeUndefined();
  });

  it('mixed count + mass + volume items leave each total untouched by the others', () => {
    const result = fold(
      [
        { quantity: 5, unit: 'kg' },
        { quantity: 3, unit: 'packet' },
        { quantity: 2, unit: 'bags' },
        { quantity: 1.5, unit: 'L' },
      ],
      { areaAcres: 2 },
    );
    expect(result.totals).toEqual({ mass: 5, volume: 1.5, count: 5 });
  });

  it('supports count per acre (report-service space) — still count, scaled by area', () => {
    const result = fold([{ quantity: 2, unit: 'packet/acre' }], { areaAcres: 3 });
    expect(result.totals).toEqual({ count: 6 });
  });
});

describe('fold — ppm folds as mg/L only when water volume is present', () => {
  it('with waterLiters: 100 ppm × 400 L = 0.04 kg of mass', () => {
    const result = fold([{ quantity: 100, unit: 'ppm' }], { waterLiters: 400 });
    expect(result.totals.mass).toBeCloseTo(0.04, 12);
    expect(result.skipped).toEqual([]);
  });

  it('without waterLiters: bucketed as missing_water, never guessed into totals', () => {
    const item = { quantity: 100, unit: 'ppm' };
    const result = fold([item], { areaAcres: 3.5 });
    expect(result.totals).toEqual({});
    expect(result.skipped).toEqual([{ item, reason: 'missing_water' }]);
  });

  it("'gm/L' behaves the same: concentration-only without water volume", () => {
    const item = { quantity: 30, unit: 'gm/L' };
    expect(fold([item], {}).skipped).toEqual([{ item, reason: 'missing_water' }]);
    expect(fold([item], { waterLiters: 400 }).totals.mass).toBe(12);
  });
});

describe('fold — skip buckets, never guesses', () => {
  it('per-acre items without an area are skipped as missing_area', () => {
    const item = { quantity: 5, unit: 'kg/acre' };
    const result = fold([item]);
    expect(result.totals).toEqual({});
    expect(result.skipped).toEqual([{ item, reason: 'missing_area' }]);
  });

  it('unknown units are skipped as unknown_unit — no silent kg fallback', () => {
    const item = { quantity: 5, unit: 'banana' };
    const result = fold([item], { areaAcres: 3, waterLiters: 400 });
    expect(result.totals).toEqual({});
    expect(result.skipped).toEqual([{ item, reason: 'unknown_unit' }]);
  });

  it('non-finite quantities are skipped as invalid_quantity', () => {
    const item = { quantity: Number.NaN, unit: 'kg' };
    const result = fold([item]);
    expect(result.totals).toEqual({});
    expect(result.skipped).toEqual([{ item, reason: 'invalid_quantity' }]);
  });

  it('resolvable items still fold when others are skipped', () => {
    const good = { quantity: 2, unit: 'kg' };
    const bad = { quantity: 100, unit: 'ppm' };
    const result = fold([good, bad], { areaAcres: 3 });
    expect(result.totals).toEqual({ mass: 2 });
    expect(result.skipped).toEqual([{ item: bad, reason: 'missing_water' }]);
  });

  it('preserves the caller item shape in skipped entries (generic pass-through)', () => {
    const item = { quantity: 1, unit: 'nonsense', name: 'Mystery tonic' };
    const result = fold([item]);
    expect(result.skipped[0]?.item.name).toBe('Mystery tonic');
  });
});

describe('fold — explicit quantityBasis column semantics', () => {
  it("bare unit + quantityBasis 'per_acre' multiplies by area (quick-add pattern)", () => {
    const result = fold([{ quantity: 5, unit: 'kg', quantityBasis: 'per_acre' as const }], {
      areaAcres: 2,
    });
    expect(result.totals).toEqual({ mass: 10 });
  });

  it('a basis fused into the unit string wins over the column (testimony rule)', () => {
    const result = fold([{ quantity: 5, unit: 'kg/acre', quantityBasis: 'total' as const }], {
      areaAcres: 2,
    });
    expect(result.totals).toEqual({ mass: 10 });
  });

  it("bare unit + quantityBasis 'per_acre' without area is bucketed as missing_area", () => {
    const item = { quantity: 5, unit: 'kg', quantityBasis: 'per_acre' as const };
    const result = fold([item]);
    expect(result.skipped).toEqual([{ item, reason: 'missing_area' }]);
  });
});
