import {
  formatLocalDate,
  addDays,
  parseDbDateToLocalDate,
  getDaysAfterPruning,
} from '@/utils/date';

describe('formatLocalDate', () => {
  it('formats a normal date with zero-padded month and day', () => {
    const date = new Date(2024, 0, 5); // Jan 5
    expect(formatLocalDate(date)).toBe('2024-01-05');
  });

  it('formats a date with double-digit month and day', () => {
    const date = new Date(2024, 11, 25); // Dec 25
    expect(formatLocalDate(date)).toBe('2024-12-25');
  });

  it('pads single-digit month', () => {
    const date = new Date(2024, 2, 15); // Mar 15
    expect(formatLocalDate(date)).toBe('2024-03-15');
  });

  it('pads single-digit day', () => {
    const date = new Date(2024, 10, 3); // Nov 3
    expect(formatLocalDate(date)).toBe('2024-11-03');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-01-01', 10)).toBe('2024-01-11');
  });

  it('adds days across month boundary', () => {
    expect(addDays('2024-01-30', 5)).toBe('2024-02-04');
  });

  it('subtracts days (negative)', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is leap year
  });

  it('returns null for invalid format', () => {
    expect(addDays('2024/01/01', 1)).toBeNull();
    expect(addDays('not-a-date', 1)).toBeNull();
    expect(addDays('2024-1-1', 1)).toBeNull();
  });

  it('returns null for invalid month', () => {
    expect(addDays('2024-13-01', 1)).toBeNull();
    expect(addDays('2024-00-01', 1)).toBeNull();
  });

  it('returns null for invalid day', () => {
    expect(addDays('2024-02-30', 1)).toBeNull();
  });
});

describe('parseDbDateToLocalDate', () => {
  it('parses a date-only string', () => {
    const result = parseDbDateToLocalDate('2024-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(5); // June = 5
    expect(result!.getDate()).toBe(15);
  });

  it('parses an ISO datetime with Z timezone', () => {
    const result = parseDbDateToLocalDate('2024-06-15T10:30:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  it('parses an ISO datetime with offset timezone', () => {
    const result = parseDbDateToLocalDate('2024-06-15T10:30:00+05:30');
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  it('returns null for ISO datetime without timezone', () => {
    expect(parseDbDateToLocalDate('2024-06-15T10:30:00')).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(parseDbDateToLocalDate('not-a-date')).toBeNull();
    expect(parseDbDateToLocalDate('')).toBeNull();
  });

  it('returns null for invalid date-only values (e.g. Feb 30)', () => {
    // new Date(2024, 1, 30) rolls over to March, so validation catches it
    expect(parseDbDateToLocalDate('2024-02-30')).toBeNull();
  });
});

describe('getDaysAfterPruning', () => {
  it('returns correct days between record and pruning date', () => {
    expect(getDaysAfterPruning('2024-06-15', '2024-06-10')).toBe(5);
  });

  it('returns 0 when record date equals pruning date', () => {
    expect(getDaysAfterPruning('2024-06-10', '2024-06-10')).toBe(0);
  });

  it('returns null when pruning date is null', () => {
    expect(getDaysAfterPruning('2024-06-15', null)).toBeNull();
  });

  it('returns null when pruning date is undefined', () => {
    expect(getDaysAfterPruning('2024-06-15', undefined)).toBeNull();
  });

  it('returns null when record date is before pruning date (negative days)', () => {
    expect(getDaysAfterPruning('2024-06-05', '2024-06-10')).toBeNull();
  });
});
