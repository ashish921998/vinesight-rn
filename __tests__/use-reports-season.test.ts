import {
  clampDateRangeToSeasonBounds,
  filterRecordsForSeason,
  shouldIncludeUnassigned,
} from '@/hooks/use-reports';
import type { ReportFilters } from '@/types/report';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn(),
}));

jest.mock(
  'expo-file-system/legacy',
  () => ({
    cacheDirectory: '/tmp/',
    writeAsStringAsync: jest.fn(),
  }),
  { virtual: true },
);

interface SeasonalRecord {
  id: number;
  season_id?: number | null;
}

const RECORDS: SeasonalRecord[] = [
  { id: 1, season_id: 10 },
  { id: 2, season_id: 11 },
  { id: 3, season_id: null },
  { id: 4 },
];

describe('use-reports season helpers', () => {
  it('filters records by selected season_id', () => {
    const next = filterRecordsForSeason(RECORDS, 10, false);
    expect(next.map((item) => item.id)).toEqual([1]);
  });

  it('selected season excludes unassigned records', () => {
    const next = filterRecordsForSeason(RECORDS, 11, true);
    expect(next.map((item) => item.id)).toEqual([2]);
  });

  it('all seasons includes unassigned records by default', () => {
    const filters: ReportFilters = {
      farmId: 1,
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
    };
    const includeUnassigned = shouldIncludeUnassigned(filters);
    const next = filterRecordsForSeason(RECORDS, undefined, includeUnassigned);
    expect(next.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('all seasons can exclude unassigned records when explicitly disabled', () => {
    const next = filterRecordsForSeason(RECORDS, undefined, false);
    expect(next.map((item) => item.id)).toEqual([1, 2]);
  });

  it('clamps date range to selected season bounds', () => {
    const clamped = clampDateRangeToSeasonBounds(
      {
        from: '2025-10-01',
        to: '2026-03-20',
      },
      {
        from: '2026-01-15',
        to: '2026-02-15',
      },
    );

    expect(clamped).toEqual({
      from: '2026-01-15',
      to: '2026-02-15',
    });
  });
});
