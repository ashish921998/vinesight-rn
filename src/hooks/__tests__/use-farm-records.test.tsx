import { renderHook } from '@testing-library/react-native';
import { useFarmRecords } from '../use-farm-records';
import {
  useDailyNotes,
  useExpenseRecords,
  useFertigationRecords,
  useHarvestRecords,
  useIrrigationRecords,
  useSprayRecords,
} from '../use-records';
import { useTemporaryWorkerEntries } from '../use-workers';

jest.mock('../use-records', () => ({
  useIrrigationRecords: jest.fn(),
  useSprayRecords: jest.fn(),
  useHarvestRecords: jest.fn(),
  useExpenseRecords: jest.fn(),
  useFertigationRecords: jest.fn(),
  useDailyNotes: jest.fn(),
}));

jest.mock('../use-workers', () => ({
  useTemporaryWorkerEntries: jest.fn(),
}));

const recordQuery = (data: unknown[]) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
});

describe('useFarmRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    [
      useIrrigationRecords,
      useSprayRecords,
      useHarvestRecords,
      useExpenseRecords,
      useFertigationRecords,
      useDailyNotes,
    ].forEach((hook) => {
      (hook as jest.Mock).mockReturnValue(recordQuery([]));
    });
  });

  it('fetches only the record data rendered by farm and logs screens', () => {
    renderHook(() => useFarmRecords(42));

    expect(useIrrigationRecords).toHaveBeenCalledWith(42);
    expect(useSprayRecords).toHaveBeenCalledWith(42);
    expect(useHarvestRecords).toHaveBeenCalledWith(42);
    expect(useExpenseRecords).toHaveBeenCalledWith(42);
    expect(useFertigationRecords).toHaveBeenCalledWith(42);
    expect(useDailyNotes).toHaveBeenCalledWith(42);
    expect(useTemporaryWorkerEntries).not.toHaveBeenCalled();
  });
});
