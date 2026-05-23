import {
  saveEntryLogSession,
  type EntryLogSessionDraft,
  type EntryLogSessionAdapters,
} from '@/features/entry-log-session';
import type { Farm } from '@/types';

jest.mock('@/services/nutrient-flow-service', () => ({
  calculateNutrientTotalsForLog: jest.fn(() => ({
    nutrientTotalsElemental: {},
    nutrientTotalsElementalPerAcre: {},
    coveragePercent: 0,
  })),
}));

const farmA: Farm = {
  id: 101,
  name: 'Farm A',
  region: 'Nashik',
  area: 4,
  crop: 'Mango',
  crop_variety: '',
  planting_date: '',
  total_tank_capacity: 1000,
  system_discharge: 50,
  remaining_water: 200,
  date_of_pruning: '2026-01-01',
};

const farmB: Farm = {
  ...farmA,
  id: 202,
  name: 'Farm B',
};

function createAdapters(): jest.Mocked<EntryLogSessionAdapters> {
  return {
    createIrrigation: jest.fn().mockResolvedValue({ id: 11 }),
    createSpray: jest.fn().mockResolvedValue({ id: 12 }),
    createHarvest: jest.fn().mockResolvedValue({ id: 13 }),
    createExpense: jest.fn().mockResolvedValue({ id: 14 }),
    createFertigation: jest.fn().mockResolvedValue({ id: 15 }),
    upsertDailyNote: jest.fn().mockResolvedValue({ id: 16 }),
    getDailyNote: jest.fn().mockResolvedValue(null),
    updateWaterLevel: jest.fn().mockResolvedValue({}),
    deleteIrrigation: jest.fn().mockResolvedValue(undefined),
    deleteSpray: jest.fn().mockResolvedValue(undefined),
    deleteHarvest: jest.fn().mockResolvedValue(undefined),
    deleteExpense: jest.fn().mockResolvedValue(undefined),
    deleteFertigation: jest.fn().mockResolvedValue(undefined),
    deleteDailyNote: jest.fn().mockResolvedValue(undefined),
  };
}

function expenseDraft(overrides: Partial<EntryLogSessionDraft> = {}): EntryLogSessionDraft {
  return {
    id: 'expense-draft',
    type: 'expense',
    scope: 'all_farms',
    farmId: null,
    data: { type: 'Other', cost: 500 },
    displayDescription: '₹500 - Other',
    ...overrides,
  };
}

describe('saveEntryLogSession', () => {
  it('rolls back created all-farms records when one farm fails', async () => {
    const adapters = createAdapters();
    adapters.createExpense.mockImplementation(async (payload) => {
      if (payload.farm_id === 202) {
        throw new Error('Farm B failed');
      }
      return { id: 1010 };
    });

    const result = await saveEntryLogSession({
      pendingLogs: [expenseDraft()],
      dateStr: '2026-02-11',
      currentFarm: null,
      farms: [farmA, farmB],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.createExpense).toHaveBeenCalledTimes(2);
    expect(adapters.deleteExpense).toHaveBeenCalledWith({ id: 1010, farmId: 101 });
    if (result.status === 'failed') {
      expect(result.failures).toEqual([
        expect.objectContaining({
          pendingLogId: 'expense-draft',
          farmId: 202,
          type: 'expense',
        }),
      ]);
      expect(result.rollbackFailures).toEqual([]);
    }
  });

  it('blocks mixed all-farms and single-farm stacks before saving', async () => {
    const adapters = createAdapters();

    const result = await saveEntryLogSession({
      pendingLogs: [
        expenseDraft(),
        expenseDraft({
          id: 'single-expense',
          scope: 'single_farm',
          farmId: 101,
        }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA, farmB],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result).toEqual({ status: 'blocked', reason: 'mixed_scopes' });
    expect(adapters.createExpense).not.toHaveBeenCalled();
  });

  it('returns the source task record for a saved single-farm stack', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({ id: 909 });

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'irrigation-draft',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
          isSourceTaskLog: true,
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('saved');
    if (result.status === 'saved') {
      expect(result.sourceTaskRecord).toEqual({
        pendingLogId: 'irrigation-draft',
        type: 'irrigation',
        recordId: 909,
      });
    }
  });

  it('restores an existing daily note when a later draft fails', async () => {
    const adapters = createAdapters();
    adapters.getDailyNote.mockResolvedValue({
      id: 501,
      farm_id: 101,
      season_id: 77,
      date: '2026-02-11',
      notes: 'Original note',
      created_at: '2026-02-10T00:00:00Z',
      updated_at: '2026-02-10T00:00:00Z',
    });
    adapters.upsertDailyNote.mockResolvedValue({ id: 501 });
    adapters.createExpense.mockRejectedValue(new Error('Expense failed'));

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'note-draft',
          type: 'note',
          scope: 'single_farm',
          farmId: 101,
          data: { notes: 'Updated note' },
          displayDescription: 'Updated note',
        },
        expenseDraft({
          id: 'expense-draft',
          scope: 'single_farm',
          farmId: 101,
        }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.deleteDailyNote).not.toHaveBeenCalled();
    expect(adapters.upsertDailyNote).toHaveBeenLastCalledWith({
      farm_id: 101,
      date: '2026-02-11',
      notes: 'Original note',
    });
  });

  it('preserves a null daily note body when rolling back an updated note', async () => {
    const adapters = createAdapters();
    adapters.getDailyNote.mockResolvedValue({
      id: 501,
      farm_id: 101,
      date: '2026-02-11',
      notes: null,
    });
    adapters.upsertDailyNote.mockResolvedValue({ id: 501 });
    adapters.createExpense.mockRejectedValue(new Error('Expense failed'));

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'note-1',
          type: 'note',
          scope: 'single_farm',
          farmId: 101,
          data: { notes: 'Updated note' },
          displayDescription: 'Updated note',
        },
        expenseDraft({
          id: 'expense-1',
          scope: 'single_farm',
          farmId: 101,
        }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.deleteDailyNote).not.toHaveBeenCalled();
    expect(adapters.upsertDailyNote).toHaveBeenLastCalledWith({
      farm_id: 101,
      date: '2026-02-11',
      notes: null,
    });
  });

  it('saves same-day note drafts in queue order for a single farm', async () => {
    const adapters = createAdapters();

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'note-1',
          type: 'note',
          scope: 'single_farm',
          farmId: 101,
          data: { notes: 'First note' },
          displayDescription: 'First note',
        },
        {
          id: 'note-2',
          type: 'note',
          scope: 'single_farm',
          farmId: 101,
          data: { notes: 'Last note' },
          displayDescription: 'Last note',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('saved');
    expect(adapters.upsertDailyNote).toHaveBeenNthCalledWith(1, {
      farm_id: 101,
      date: '2026-02-11',
      notes: 'First note',
    });
    expect(adapters.upsertDailyNote).toHaveBeenNthCalledWith(2, {
      farm_id: 101,
      date: '2026-02-11',
      notes: 'Last note',
    });
  });
});
