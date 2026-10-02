import { relativeDayKey } from '@/utils/date';

describe('relativeDayKey', () => {
  const today = '2026-07-25';

  it('labels today and yesterday, and nothing older', () => {
    expect(relativeDayKey('2026-07-25', today)).toBe('today');
    expect(relativeDayKey('2026-07-24', today)).toBe('yesterday');
    expect(relativeDayKey('2026-07-23', today)).toBeNull();
  });

  it('crosses month and year boundaries', () => {
    expect(relativeDayKey('2026-06-30', '2026-07-01')).toBe('yesterday');
    expect(relativeDayKey('2025-12-31', '2026-01-01')).toBe('yesterday');
  });

  it('ignores the time part of a timestamp', () => {
    expect(relativeDayKey('2026-07-25T18:30:00Z', today)).toBe('today');
  });
});
