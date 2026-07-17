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

  it('stamps the created irrigation record id onto a co-logged fertigation record', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({ id: 909 });
    adapters.createFertigation.mockResolvedValue({ id: 777 });

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'irrigation-draft',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
        },
        {
          id: 'fertigation-draft',
          type: 'fertigation',
          scope: 'single_farm',
          farmId: 101,
          data: { fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }] },
          displayDescription: '1 fertilizer',
          linkIrrigationFromPendingLogId: 'irrigation-draft',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('saved');
    expect(adapters.createFertigation).toHaveBeenCalledWith(
      expect.objectContaining({ irrigation_record_id: 909 }),
    );
  });

  it('saves linked irrigation before fertigation when the visible stack is reversed', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({ id: 909 });
    adapters.createFertigation.mockResolvedValue({ id: 777 });

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'fertigation-draft',
          type: 'fertigation',
          scope: 'single_farm',
          farmId: 101,
          data: { fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }] },
          displayDescription: '1 fertilizer',
          linkIrrigationFromPendingLogId: 'irrigation-draft',
        },
        {
          id: 'irrigation-draft',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('saved');
    expect(adapters.createIrrigation.mock.invocationCallOrder[0]).toBeLessThan(
      adapters.createFertigation.mock.invocationCallOrder[0]!,
    );
    expect(adapters.createFertigation).toHaveBeenCalledWith(
      expect.objectContaining({ irrigation_record_id: 909 }),
    );
  });

  it('rolls back UUID-only irrigation when linked fertigation cannot resolve a numeric id', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({
      id: null,
      client_uuid: 'irrigation-client-uuid',
    });

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'irrigation-draft',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
        },
        {
          id: 'fertigation-draft',
          type: 'fertigation',
          scope: 'single_farm',
          farmId: 101,
          data: { fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }] },
          displayDescription: '1 fertilizer',
          linkIrrigationFromPendingLogId: 'irrigation-draft',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.createFertigation).not.toHaveBeenCalled();
    expect(adapters.deleteIrrigation).toHaveBeenCalledWith({
      clientUuid: 'irrigation-client-uuid',
      farmId: 101,
    });
    if (result.status === 'failed') expect(result.rollbackFailures).toEqual([]);
  });

  it('reports a rollback failure when a created event has no usable identity', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({ id: null });

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'irrigation-draft',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
        },
        {
          id: 'fertigation-draft',
          type: 'fertigation',
          scope: 'single_farm',
          farmId: 101,
          data: { fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }] },
          displayDescription: '1 fertilizer',
          linkIrrigationFromPendingLogId: 'irrigation-draft',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.createFertigation).not.toHaveBeenCalled();
    expect(adapters.deleteIrrigation).not.toHaveBeenCalled();
    if (result.status === 'failed') {
      expect(result.rollbackFailures).toEqual([
        expect.objectContaining({
          pendingLogId: 'irrigation-draft',
          recordId: null,
          clientUuid: null,
          error: 'Cannot roll back record: no record ID or client UUID',
        }),
      ]);
    }
  });

  it('saves a fertigation record with a null link when no irrigation is attached', async () => {
    const adapters = createAdapters();

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'fertigation-draft',
          type: 'fertigation',
          scope: 'single_farm',
          farmId: 101,
          data: { fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg' }] },
          displayDescription: '1 fertilizer',
        },
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('saved');
    expect(adapters.createFertigation).toHaveBeenCalledWith(
      expect.objectContaining({ irrigation_record_id: null }),
    );
  });

  it('rolls back an earlier UUID-only record when a later draft fails', async () => {
    const adapters = createAdapters();
    adapters.createIrrigation.mockResolvedValue({
      id: null,
      client_uuid: 'earlier-irrigation-uuid',
    });
    adapters.createExpense.mockRejectedValue(new Error('Expense failed'));

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'irrigation-1',
          type: 'irrigation',
          scope: 'single_farm',
          farmId: 101,
          data: { duration: 2 },
          displayDescription: '2 hours',
        },
        expenseDraft({ id: 'expense-1', scope: 'single_farm', farmId: 101 }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    expect(adapters.deleteIrrigation).toHaveBeenCalledWith({
      clientUuid: 'earlier-irrigation-uuid',
      farmId: 101,
    });
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

  it('records a rollback failure when a note has no recordId and no previous note', async () => {
    const adapters = createAdapters();
    // upsertDailyNote returns no id — recordId becomes null
    adapters.upsertDailyNote.mockResolvedValue({} as never);
    adapters.createExpense.mockRejectedValue(new Error('Expense failed'));

    const result = await saveEntryLogSession({
      pendingLogs: [
        {
          id: 'note-draft',
          type: 'note',
          scope: 'single_farm',
          farmId: 101,
          data: { notes: 'A note' },
          displayDescription: 'A note',
        },
        expenseDraft({ id: 'expense-draft', scope: 'single_farm', farmId: 101 }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.rollbackFailures).toHaveLength(1);
      expect(result.rollbackFailures[0]).toMatchObject({
        pendingLogId: 'note-draft',
        type: 'note',
        farmId: 101,
      });
      expect(result.rollbackFailures[0]!.error).toMatch(/Cannot roll back note/);
    }
  });

  it('restores previous note content when note has no recordId but previousDailyNote exists', async () => {
    const adapters = createAdapters();
    adapters.getDailyNote.mockResolvedValue({
      id: 501,
      farm_id: 101,
      date: '2026-02-11',
      notes: 'Previous content',
    });
    // upsertDailyNote returns no id — recordId becomes null
    adapters.upsertDailyNote.mockResolvedValue({} as never);
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
        expenseDraft({ id: 'expense-draft', scope: 'single_farm', farmId: 101 }),
      ],
      dateStr: '2026-02-11',
      currentFarm: farmA,
      farms: [farmA],
      preferredAreaUnit: 'acres',
      adapters,
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.rollbackFailures).toHaveLength(0);
      expect(adapters.upsertDailyNote).toHaveBeenLastCalledWith({
        farm_id: 101,
        date: '2026-02-11',
        notes: 'Previous content',
      });
    }
  });

  it('rolls back same-day note drafts in reverse queue order', async () => {
    const adapters = createAdapters();
    adapters.getDailyNote.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 501,
      farm_id: 101,
      date: '2026-02-11',
      notes: 'First note',
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
    expect(adapters.upsertDailyNote).toHaveBeenNthCalledWith(3, {
      farm_id: 101,
      date: '2026-02-11',
      notes: 'First note',
    });
    expect(adapters.deleteDailyNote).toHaveBeenCalledWith({
      id: 501,
      farmId: 101,
      date: '2026-02-11',
    });
    expect(adapters.upsertDailyNote.mock.invocationCallOrder[2]).toBeLessThan(
      adapters.deleteDailyNote.mock.invocationCallOrder[0],
    );
  });
});
