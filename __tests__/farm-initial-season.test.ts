import { shouldAutoStartInitialSeason, ensureInitialFarmSeason } from '@/hooks/use-farms';
import type { Farm } from '@/types';

const mockFarms = {
  getExistingSeason: jest.fn(),
  startSeason: jest.fn(),
  createSeason: jest.fn(),
};
jest.mock('@/data-access', () => {
  return {
    getDataAccess: jest.fn(() => ({ farms: mockFarms })),
  };
});

const baseFarm = (overrides: Partial<Farm>): Farm =>
  ({
    id: 42,
    name: 'North Plot',
    date_of_pruning: null,
    crop: 'grape',
    ...overrides,
  }) as Farm;

describe('shouldAutoStartInitialSeason', () => {
  it('is true when the farm has a pruning date', () => {
    expect(shouldAutoStartInitialSeason({ date_of_pruning: '2026-01-15' })).toBe(true);
  });

  it('is false when the farm has no pruning date', () => {
    expect(shouldAutoStartInitialSeason({ date_of_pruning: null })).toBe(false);
  });
});

describe('ensureInitialFarmSeason', () => {
  beforeEach(() => {
    mockFarms.getExistingSeason.mockReset();
    mockFarms.startSeason.mockReset();
    mockFarms.createSeason.mockReset();
  });

  it('anchors the auto-started season to the pruning date', async () => {
    mockFarms.getExistingSeason.mockResolvedValue(null);
    mockFarms.startSeason.mockResolvedValue(undefined);

    await ensureInitialFarmSeason(
      baseFarm({ date_of_pruning: '2026-01-15' }),
      'user-1',
      'Season 2026',
    );

    expect(mockFarms.startSeason).toHaveBeenCalledWith(
      expect.objectContaining({ p_farm_id: 42, p_start_date: '2026-01-15' }),
    );
  });

  it('does not create a second season when one already exists', async () => {
    mockFarms.getExistingSeason.mockResolvedValue({ id: 7 });

    await ensureInitialFarmSeason(baseFarm({ date_of_pruning: '2026-01-15' }), 'user-1');

    expect(mockFarms.startSeason).not.toHaveBeenCalled();
  });
});
