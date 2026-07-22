import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useDeleteDailyNote } from '@/hooks/use-records';

const mockRecords = {
  deleteDailyNote: jest.fn(),
};
jest.mock('@/data-access', () => {
  return { getDataAccess: jest.fn(() => ({ records: mockRecords })) };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteDailyNote', () => {
  beforeEach(() => {
    mockRecords.deleteDailyNote.mockReset();
  });

  it('deletes by id when id > 0', async () => {
    mockRecords.deleteDailyNote.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 42, farmId: 7, date: '2026-06-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRecords.deleteDailyNote).toHaveBeenCalledWith({
      id: 42,
      farmId: 7,
      date: '2026-06-01',
    });
  });

  it('falls back to farm_id + date when id === 0 (receipt-screen note)', async () => {
    mockRecords.deleteDailyNote.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 0, farmId: 7, date: '2026-06-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRecords.deleteDailyNote).toHaveBeenCalledWith({
      id: 0,
      farmId: 7,
      date: '2026-06-01',
    });
  });

  it('throws when supabase returns an error', async () => {
    mockRecords.deleteDailyNote.mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 5, farmId: 7, date: '2026-06-01' }),
      ).rejects.toThrow('delete failed');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
