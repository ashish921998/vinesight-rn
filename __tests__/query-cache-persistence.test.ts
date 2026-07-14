import { queryDehydrateOptions } from '@/lib/query-cache';

describe('query cache persistence filters', () => {
  it('persists only paused record-write mutations', () => {
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
        state: { isPaused: true },
      }),
    ).toBe(true);
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['record-write', 'irrigation_records', 'create'] },
        state: { isPaused: false },
      }),
    ).toBe(false);
    expect(
      queryDehydrateOptions.shouldDehydrateMutation({
        options: { mutationKey: ['other-write'] },
        state: { isPaused: true },
      }),
    ).toBe(false);
  });

  it('persists only successful allowlisted queries', () => {
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['irrigationRecords', 'list'],
        state: { status: 'success' },
      }),
    ).toBe(true);
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['irrigationRecords', 'list'],
        state: { status: 'error' },
      }),
    ).toBe(false);
    expect(
      queryDehydrateOptions.shouldDehydrateQuery({
        queryKey: ['profile'],
        state: { status: 'success' },
      }),
    ).toBe(false);
  });
});
