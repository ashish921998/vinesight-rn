import { format, formatParts } from '@/lib/quantity';

describe('format — farmer-natural scale selection', () => {
  it('renders 0.75 kg as "750 g", never "0.75 kg"', () => {
    expect(formatParts(0.75, 'mass')).toEqual({ value: 750, scale: 'g' });
    expect(format(0.75, 'mass')).toBe('750 g');
  });

  it('keeps 1.5 kg at kg scale', () => {
    expect(formatParts(1.5, 'mass')).toEqual({ value: 1.5, scale: 'kg' });
    expect(format(1.5, 'mass')).toBe('1.5 kg');
  });

  it('drops below 1 g into mg', () => {
    expect(formatParts(0.0005, 'mass')).toEqual({ value: 500, scale: 'mg' });
    expect(format(0.0005, 'mass')).toBe('500 mg');
  });

  it('boundaries: exactly 1 g stays g, exactly 1 kg stays kg', () => {
    expect(formatParts(0.001, 'mass')).toEqual({ value: 1, scale: 'g' });
    expect(formatParts(1, 'mass')).toEqual({ value: 1, scale: 'kg' });
  });

  it('renders volumes under 1 L in ml', () => {
    expect(formatParts(0.875, 'volume')).toEqual({ value: 875, scale: 'ml' });
    expect(format(0.875, 'volume')).toBe('875 ml');
    expect(format(0.5, 'volume')).toBe('500 ml');
    expect(format(2, 'volume')).toBe('2 L');
    expect(formatParts(1, 'volume')).toEqual({ value: 1, scale: 'L' });
  });

  it('renders zero at the canonical scale', () => {
    expect(format(0, 'mass')).toBe('0 kg');
    expect(format(0, 'volume')).toBe('0 L');
  });

  it('count has no unit label — the item word belongs to the caller', () => {
    expect(formatParts(3, 'count')).toEqual({ value: 3, scale: 'count' });
    expect(format(3, 'count')).toBe('3');
    expect(format(2.5, 'count')).toBe('2.5');
  });
});

describe('format — rounding happens only at render', () => {
  it('kg/L carry at most 2 trimmed decimals', () => {
    expect(format(12, 'mass')).toBe('12 kg');
    expect(format(12 / 3.5, 'mass')).toBe('3.43 kg');
    expect(format(5000, 'mass')).toBe('5000 kg');
    expect(format(5000, 'volume')).toBe('5000 L');
    expect(format(2.857142857142857, 'mass')).toBe('2.86 kg');
  });

  it('sub-unit scales use ~3 significant figures (plan §5 renders)', () => {
    expect(formatParts(0.04 / 3.5, 'mass')).toEqual({ value: 11.4, scale: 'g' }); // 11.4285…
    expect(formatParts(0.2023431334857652, 'volume')).toEqual({ value: 202, scale: 'ml' });
    expect(formatParts(0.7082009672001781, 'volume')).toEqual({ value: 708, scale: 'ml' });
    expect(formatParts(0.0025, 'mass')).toEqual({ value: 2.5, scale: 'g' });
  });

  it('cleans upstream float noise at render (0.039999999999999994 kg → "40 g")', () => {
    expect(format(0.039999999999999994, 'mass')).toBe('40 g');
    expect(formatParts(0.0001, 'mass')).toEqual({ value: 100, scale: 'mg' }); // 100 ppm per-liter rate
  });

  it('representative §9 values round-trip their natural scales', () => {
    expect(format(0.02, 'mass')).toBe('20 g');
    expect(format(0.5, 'mass')).toBe('500 g');
    expect(format(2.5, 'mass')).toBe('2.5 kg');
    expect(format(875, 'mass')).toBe('875 kg');
    expect(format(5000, 'mass')).toBe('5000 kg');
  });
});

describe('format — ≈ prefix for derived values', () => {
  it('adds the prefix only when asked (derived figures)', () => {
    expect(format(0.875, 'volume', { approx: true })).toBe('≈ 875 ml');
    expect(format(0.875, 'volume')).toBe('875 ml');
    expect(format(0.7082009672001781, 'volume', { approx: true })).toBe('≈ 708 ml');
  });
});

describe('formatParts — non-finite values keep a measure-consistent scale', () => {
  it('never labels a non-finite count as mass', () => {
    expect(formatParts(Number.NaN, 'count')).toEqual({ value: Number.NaN, scale: 'count' });
    expect(formatParts(Infinity, 'count')).toEqual({ value: Infinity, scale: 'count' });
    expect(formatParts(Number.NaN, 'volume')).toEqual({ value: Number.NaN, scale: 'L' });
    expect(formatParts(Number.NaN, 'mass')).toEqual({ value: Number.NaN, scale: 'kg' });
  });
});
