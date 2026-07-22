import { supabase } from '@/lib/supabase';
import {
  SupabaseDataAccess,
  isMissingDisplayOrderColumnError,
} from '@/data-access/SupabaseDataAccess';

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: jest.fn() },
}));

describe('SupabaseDataAccess.records.deleteDailyNote', () => {
  function mockDeleteChain() {
    const eqCalls: Array<[string, unknown]> = [];
    const chain = {
      eq(column: string, value: unknown) {
        eqCalls.push([column, value]);
        return chain;
      },
      then(resolve: (result: { error: null }) => unknown) {
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    (supabase.from as jest.Mock).mockReturnValue({ delete: () => chain });
    return eqCalls;
  }

  beforeEach(() => {
    (supabase.from as jest.Mock).mockReset();
  });

  it('deletes by id when id > 0', async () => {
    const eqCalls = mockDeleteChain();

    await new SupabaseDataAccess().records.deleteDailyNote({
      id: 42,
      farmId: 7,
      date: '2026-06-01',
    });

    expect(supabase.from).toHaveBeenCalledWith('daily_notes');
    expect(eqCalls).toEqual([
      ['farm_id', 7],
      ['id', 42],
    ]);
  });

  it('falls back to farm_id + date when id === 0 (receipt-screen note)', async () => {
    const eqCalls = mockDeleteChain();

    await new SupabaseDataAccess().records.deleteDailyNote({
      id: 0,
      farmId: 7,
      date: '2026-06-01',
    });

    expect(eqCalls).toEqual([
      ['farm_id', 7],
      ['date', '2026-06-01'],
    ]);
  });
});

describe('isMissingDisplayOrderColumnError', () => {
  it('matches by code and by schema-cache message', () => {
    expect(isMissingDisplayOrderColumnError({ code: '42703' })).toBe(true);
    expect(isMissingDisplayOrderColumnError({ code: 'PGRST204' })).toBe(true);
    expect(
      isMissingDisplayOrderColumnError({
        message: "Could not find the 'display_order' column of 'farms' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isMissingDisplayOrderColumnError({ message: 'column "display_order" does not exist' }),
    ).toBe(true);
    expect(isMissingDisplayOrderColumnError(null)).toBe(false);
    expect(isMissingDisplayOrderColumnError({ code: '23505', message: 'duplicate key' })).toBe(
      false,
    );
  });
});
