import { resolveOrCreateSeasonIdForDate } from '@/lib/season-context';
import { executeRecordWriteMutation } from '@/features/offline/record-mutations';
import { idempotentCreate, targetedUpdate } from '@/features/offline/record-writes';

jest.mock('@/lib/season-context', () => ({ resolveOrCreateSeasonIdForDate: jest.fn() }));
jest.mock('@/features/offline/record-writes', () => ({
  idempotentCreate: jest.fn(),
  targetedDelete: jest.fn(),
  targetedUpdate: jest.fn(),
}));

const mockedResolveSeason = resolveOrCreateSeasonIdForDate as jest.MockedFunction<
  typeof resolveOrCreateSeasonIdForDate
>;
const mockedCreate = idempotentCreate as jest.MockedFunction<typeof idempotentCreate>;
const mockedUpdate = targetedUpdate as jest.MockedFunction<typeof targetedUpdate>;

beforeEach(() => jest.clearAllMocks());

describe('executeRecordWriteMutation create', () => {
  it('persists the idempotent row before resolving and backfilling its season', async () => {
    mockedCreate.mockResolvedValue({
      id: 42,
      farm_id: 7,
      client_uuid: 'u1',
      season_id: null,
    });
    mockedResolveSeason.mockResolvedValue(12);
    mockedUpdate.mockResolvedValue({ id: 42, farm_id: 7, season_id: 12 });

    await executeRecordWriteMutation('irrigation_records', 'create', {
      farm_id: 7,
      date: '2026-07-14',
      client_uuid: 'u1',
    });

    expect(mockedCreate).toHaveBeenCalledWith(
      'irrigation_records',
      expect.objectContaining({ season_id: null }),
    );
    expect(mockedCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mockedResolveSeason.mock.invocationCallOrder[0],
    );
    expect(mockedUpdate).toHaveBeenCalledWith(
      'irrigation_records',
      { id: 42, clientUuid: 'u1', farmId: 7 },
      { season_id: 12 },
    );
  });

  it('keeps a supplied season without an extra resolution request', async () => {
    const row = { id: 42, farm_id: 7, season_id: 12 };
    mockedCreate.mockResolvedValue(row);

    await expect(
      executeRecordWriteMutation('irrigation_records', 'create', {
        farm_id: 7,
        date: '2026-07-14',
        season_id: 12,
      }),
    ).resolves.toBe(row);

    expect(mockedResolveSeason).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});
