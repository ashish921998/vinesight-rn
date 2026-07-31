import {
  shouldAutoStartInitialSeason,
  ensureInitialFarmSeason,
  getInitialSeasonStartDate,
} from '@/hooks/use-farms';
import { supabase } from '@/lib/supabase';
import type { Farm } from '@/types';

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

// Chainable query builder whose terminal `maybeSingle` resolves to the given
// result — mirrors the existing-season lookup in ensureInitialFarmSeason.
function mockExistingSeasonLookup(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'limit']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  mockFrom.mockReturnValue(builder);
  return builder;
}

const baseFarm = (overrides: Partial<Farm>): Farm =>
  ({
    id: 42,
    name: 'North Plot',
    date_of_pruning: null,
    crop: 'grape',
    ...overrides,
  }) as Farm;

describe('shouldAutoStartInitialSeason', () => {
  // The gate is now always-on: every new farm auto-starts a season so it is
  // immediately loggable (the one-tap first log must not hit a missing-season
  // wall). The anchor date logic is covered by getInitialSeasonStartDate below.
  it('is true when the farm has a pruning date', () => {
    expect(shouldAutoStartInitialSeason({ date_of_pruning: '2026-01-15' })).toBe(true);
  });

  it('is still true when the farm has no pruning date (always-on)', () => {
    expect(shouldAutoStartInitialSeason({ date_of_pruning: null })).toBe(true);
  });
});

describe('ensureInitialFarmSeason', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it('anchors the auto-started season to the pruning date', async () => {
    mockExistingSeasonLookup({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    await ensureInitialFarmSeason(
      baseFarm({ date_of_pruning: '2026-01-15' }),
      'user-1',
      'Season 2026',
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'start_farm_season',
      expect.objectContaining({ p_farm_id: 42, p_start_date: '2026-01-15' }),
    );
  });

  it('falls back to the most recent February 1st when no pruning date is given', async () => {
    mockExistingSeasonLookup({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    // No pruning date → season anchors to the most recent Feb 1st (via the
    // same helper the production code uses), not "today".
    await ensureInitialFarmSeason(baseFarm({ date_of_pruning: null }), 'user-1');

    expect(mockRpc).toHaveBeenCalledWith(
      'start_farm_season',
      expect.objectContaining({ p_farm_id: 42 }),
    );
    const calledRpc = mockRpc.mock.calls[0];
    const expectedAnchor = new Date(
      getInitialSeasonStartDate().getFullYear(),
      getInitialSeasonStartDate().getMonth(),
      getInitialSeasonStartDate().getDate(),
    );
    expect(calledRpc[1].p_start_date).toBe(
      `${expectedAnchor.getFullYear()}-${String(expectedAnchor.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(expectedAnchor.getDate()).padStart(2, '0')}`,
    );
  });

  it('does not create a second season when one already exists', async () => {
    mockExistingSeasonLookup({ data: { id: 7 }, error: null });

    await ensureInitialFarmSeason(baseFarm({ date_of_pruning: '2026-01-15' }), 'user-1');

    expect(mockRpc).not.toHaveBeenCalled();
  });
});
