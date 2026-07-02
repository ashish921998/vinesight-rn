import { ACRES_PER_HECTARE, parseUnit } from '@/lib/quantity';

describe('parseUnit — grammar and canonical factors', () => {
  it('parses bare mass units to canonical kg factors', () => {
    expect(parseUnit('kg')).toEqual({ measure: 'mass', basis: 'total', factorToCanonical: 1 });
    expect(parseUnit('g')).toEqual({ measure: 'mass', basis: 'total', factorToCanonical: 0.001 });
    expect(parseUnit('gm')).toEqual({ measure: 'mass', basis: 'total', factorToCanonical: 0.001 });
    expect(parseUnit('mg')).toEqual({
      measure: 'mass',
      basis: 'total',
      factorToCanonical: 0.000001,
    });
  });

  it('parses bare volume units to canonical L factors', () => {
    expect(parseUnit('L')).toEqual({ measure: 'volume', basis: 'total', factorToCanonical: 1 });
    expect(parseUnit('litre')).toEqual({
      measure: 'volume',
      basis: 'total',
      factorToCanonical: 1,
    });
    expect(parseUnit('ml')).toEqual({
      measure: 'volume',
      basis: 'total',
      factorToCanonical: 0.001,
    });
  });

  it('parses count units as count, factor 1', () => {
    expect(parseUnit('pcs')).toEqual({ measure: 'count', basis: 'total', factorToCanonical: 1 });
    expect(parseUnit('packet/acre')).toEqual({
      measure: 'count',
      basis: 'per_acre',
      factorToCanonical: 1,
    });
  });

  it('parses per-acre and per-liter-water bases fused into the unit string', () => {
    expect(parseUnit('kg/acre')).toEqual({
      measure: 'mass',
      basis: 'per_acre',
      factorToCanonical: 1,
    });
    expect(parseUnit('g/acre')).toEqual({
      measure: 'mass',
      basis: 'per_acre',
      factorToCanonical: 0.001,
    });
    expect(parseUnit('gm/L')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.001,
    });
    expect(parseUnit('ml/L')).toEqual({
      measure: 'volume',
      basis: 'per_liter_water',
      factorToCanonical: 0.001,
    });
  });

  it('is case- and whitespace-tolerant', () => {
    expect(parseUnit(' KG ')).toEqual({ measure: 'mass', basis: 'total', factorToCanonical: 1 });
    expect(parseUnit('Litre')).toEqual({
      measure: 'volume',
      basis: 'total',
      factorToCanonical: 1,
    });
    expect(parseUnit('GM/L')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.001,
    });
    expect(parseUnit(' g / L ')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.001,
    });
    expect(parseUnit('Kg / Acre')).toEqual({
      measure: 'mass',
      basis: 'per_acre',
      factorToCanonical: 1,
    });
  });

  it('treats ppm as mass per liter of spray water at mg scale (1 ppm = 1 mg/L)', () => {
    expect(parseUnit('ppm')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.000001,
    });
    expect(parseUnit(' PPM ')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.000001,
    });
    // mg/L is the same point on the grid, spelled out.
    expect(parseUnit('mg/L')).toEqual({
      measure: 'mass',
      basis: 'per_liter_water',
      factorToCanonical: 0.000001,
    });
  });
});

describe("parseUnit — 'L/acre' is volume and can never resolve to mass", () => {
  // The bug that motivates the kernel: a consultant's 'L/acre' fell through a
  // resolver to a silent 'kg' fallback, turning liters into kilograms.
  it.each(['L/acre', 'l/acre', 'L/ACRE', ' L / Acre ', 'liter/acre', 'litre/acre'])(
    'parses %s as volume + per_acre, never mass',
    (raw) => {
      const parsed = parseUnit(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.measure).toBe('volume');
      expect(parsed?.measure).not.toBe('mass');
      expect(parsed?.basis).toBe('per_acre');
      expect(parsed?.factorToCanonical).toBe(1);
    },
  );
});

describe('parseUnit — per-hectare source spellings normalize to per-acre (÷ 2.47105)', () => {
  it('parses kg/ha as mass per_acre with the hectare factor folded in', () => {
    const parsed = parseUnit('kg/ha');
    expect(parsed).not.toBeNull();
    expect(parsed?.measure).toBe('mass');
    expect(parsed?.basis).toBe('per_acre');
    expect(parsed?.factorToCanonical).toBeCloseTo(1 / 2.47105, 15);
  });

  it('converts 5 kg/ha to ≈ 2.0234 kg/acre', () => {
    const parsed = parseUnit('kg/ha');
    const perAcreKg = 5 * (parsed?.factorToCanonical ?? NaN);
    expect(perAcreKg).toBeCloseTo(2.0234, 4);
    expect(perAcreKg).toBeCloseTo(2.0234313348576514, 12);
  });

  it.each([
    ['g/ha', 'mass'],
    ['gm/ha', 'mass'],
    ['mL/ha', 'volume'],
    ['L/ha', 'volume'],
    ['kg/hectare', 'mass'],
    ['kg/hectares', 'mass'],
  ])('parses %s as %s + per_acre', (raw, measure) => {
    const parsed = parseUnit(raw);
    expect(parsed?.measure).toBe(measure);
    expect(parsed?.basis).toBe('per_acre');
  });

  it('exports the exact acre-per-hectare constant', () => {
    expect(ACRES_PER_HECTARE).toBe(2.47105);
  });
});

describe('parseUnit — unknown input returns null, never a silent kg fallback', () => {
  it.each([
    'banana',
    '',
    '   ',
    'kgg',
    'kg/',
    '/acre',
    'acre',
    'kg//acre',
    'kg/banana',
    'banana/acre',
    'ppm/acre',
    'ppm/L',
    'unit/L', // a count can never be a water concentration
    'pcs/L',
    'kg/kg',
  ])('returns null for %j', (raw) => {
    expect(parseUnit(raw)).toBeNull();
  });

  it('never falls back to a mass interpretation for unknown strings', () => {
    const parsed = parseUnit('banana');
    expect(parsed).toBeNull();
    expect(parsed?.measure).toBeUndefined();
  });
});
