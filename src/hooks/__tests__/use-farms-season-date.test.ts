import { getInitialSeasonStartDate, shouldAutoStartInitialSeason } from '@/hooks/use-farms';

describe('getInitialSeasonStartDate — most recent February 1st anchor', () => {
  it('returns Feb 1 of the current year for any month Feb–Dec', () => {
    expect(getInitialSeasonStartDate(new Date(2026, 6, 22))).toEqual(new Date(2026, 1, 1)); // July 2026
    expect(getInitialSeasonStartDate(new Date(2026, 1, 1))).toEqual(new Date(2026, 1, 1)); // Feb itself
    expect(getInitialSeasonStartDate(new Date(2026, 11, 31))).toEqual(new Date(2026, 1, 1)); // Dec
  });

  it('rolls back to last year when the current month is January', () => {
    // January 2027 → the agronomic year started Feb 2026
    expect(getInitialSeasonStartDate(new Date(2027, 0, 15))).toEqual(new Date(2026, 1, 1));
    expect(getInitialSeasonStartDate(new Date(2027, 0, 1))).toEqual(new Date(2026, 1, 1));
  });

  it('ignores the day/time of the reference date — always lands on day 1', () => {
    const result = getInitialSeasonStartDate(new Date(2026, 4, 19, 23, 59, 59));
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(1); // February
  });

  it('defaults to now when called with no argument', () => {
    const before = new Date();
    const result = getInitialSeasonStartDate();
    const after = new Date();
    const expectedYear = before.getMonth() === 0 ? before.getFullYear() - 1 : before.getFullYear();
    expect(result.getFullYear()).toBe(expectedYear);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(1);
    expect(after).toBeDefined(); // sanity
  });
});

describe('shouldAutoStartInitialSeason — always-on', () => {
  it('returns true regardless of pruning date', () => {
    expect(shouldAutoStartInitialSeason({ date_of_pruning: '2026-02-01' })).toBe(true);
    expect(shouldAutoStartInitialSeason({ date_of_pruning: null })).toBe(true);
    expect(shouldAutoStartInitialSeason({ date_of_pruning: undefined })).toBe(true);
  });
});
