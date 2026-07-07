import { dedupePhiRules } from '@/hooks/use-chemical-catalog';

const TODAY = '2026-07-06';

interface RuleOverrides {
  product_id?: number;
  crop?: string;
  phi_days?: number;
  verified?: boolean;
  source_note?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

function rule(overrides: RuleOverrides = {}) {
  return {
    product_id: 1,
    crop: 'grape',
    phi_days: 30,
    verified: true,
    source_note: null,
    effective_from: null,
    effective_to: null,
    ...overrides,
  };
}

describe('dedupePhiRules', () => {
  it('picks the strictest (max phi_days) of two verified rules regardless of order', () => {
    const shorter = rule({ phi_days: 30, source_note: 'shorter' });
    const stricter = rule({ phi_days: 66, source_note: 'stricter' });

    expect(dedupePhiRules([shorter, stricter], TODAY).get(1)).toBe(stricter);
    expect(dedupePhiRules([stricter, shorter], TODAY).get(1)).toBe(stricter);
  });

  it('lets verified beat unverified regardless of phi_days', () => {
    const unverifiedStrict = rule({ phi_days: 90, verified: false });
    const verifiedLoose = rule({ phi_days: 15, verified: true });

    expect(dedupePhiRules([unverifiedStrict, verifiedLoose], TODAY).get(1)).toBe(verifiedLoose);
    expect(dedupePhiRules([verifiedLoose, unverifiedStrict], TODAY).get(1)).toBe(verifiedLoose);
  });

  it('does not let an unverified rule displace a verified one even with larger phi_days', () => {
    const verified = rule({ phi_days: 30, verified: true });
    const unverified = rule({ phi_days: 66, verified: false });

    expect(dedupePhiRules([verified, unverified], TODAY).get(1)).toBe(verified);
  });

  it('excludes an expired stricter rule so the current rule governs', () => {
    const expiredStricter = rule({ phi_days: 66, effective_to: '2026-07-05' });
    const current = rule({ phi_days: 30 });

    expect(dedupePhiRules([expiredStricter, current], TODAY).get(1)).toBe(current);
  });

  it('excludes a rule that is not yet effective', () => {
    const future = rule({ phi_days: 66, effective_from: '2026-07-07' });
    const current = rule({ phi_days: 30 });

    expect(dedupePhiRules([future, current], TODAY).get(1)).toBe(current);
  });

  it('treats window boundaries as inclusive', () => {
    const startsToday = rule({ phi_days: 66, effective_from: TODAY });
    const endsToday = rule({ phi_days: 45, effective_to: TODAY });

    const winner = dedupePhiRules([endsToday, startsToday], TODAY).get(1);
    expect(winner).toBe(startsToday);
  });

  it('treats null effective dates as always effective (matches all current prod rows)', () => {
    const openEnded = rule({ phi_days: 30 });

    expect(dedupePhiRules([openEnded], TODAY).get(1)).toBe(openEnded);
  });

  it('returns no rule for a product whose only rules are out of window', () => {
    const expired = rule({ effective_to: '2026-01-01' });
    const future = rule({ effective_from: '2027-01-01' });

    expect(dedupePhiRules([expired, future], TODAY).has(1)).toBe(false);
  });

  it('dedupes per product independently', () => {
    const p1Loose = rule({ product_id: 1, phi_days: 15 });
    const p1Strict = rule({ product_id: 1, phi_days: 60 });
    const p2Only = rule({ product_id: 2, phi_days: 7 });

    const result = dedupePhiRules([p1Loose, p1Strict, p2Only], TODAY);
    expect(result.get(1)).toBe(p1Strict);
    expect(result.get(2)).toBe(p2Only);
  });

  it('defaults "today" to the device-LOCAL calendar date, not UTC', () => {
    // Local-midnight construction: new Date(y, m, d, 1:00) is 01:00 in the
    // test runner's OWN zone, so for any zone east of UTC the UTC date is
    // still "yesterday" — a UTC-derived default (toISOString) would exclude a
    // rule that became effective on the local date. (Concrete case: 01:00 IST
    // on 2026-07-07 is 19:30 UTC on 2026-07-06.)
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 7, 1, 0, 0));
    try {
      const effectiveToday = rule({ phi_days: 66, effective_from: '2026-07-07' });
      const older = rule({ phi_days: 30 });
      expect(dedupePhiRules([older, effectiveToday]).get(1)).toBe(effectiveToday);
    } finally {
      jest.useRealTimers();
    }
  });
});
