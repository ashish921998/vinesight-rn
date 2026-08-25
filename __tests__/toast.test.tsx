import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ToastHost, toast } from '@/components/ui/toast';

const mockTriggerHaptic = jest.fn();
const mockTriggerHapticError = jest.fn();
const mockTriggerHapticSuccess = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const reanimated = jest.requireActual('react-native-reanimated/mock');
  return {
    ...reanimated,
    useReducedMotion: () => false,
    withTiming: jest.fn(reanimated.withTiming),
  };
});

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      success: '#4F7A5A',
      error: '#B84C3A',
      inversePrimary: '#9CC5B1',
      inverseSurface: '#121613',
      inverseOnSurface: '#F0F2F0',
    },
  }),
}));

jest.mock('@/utils/haptics', () => ({
  triggerHaptic: () => mockTriggerHaptic(),
  triggerHapticError: () => mockTriggerHapticError(),
  triggerHapticSuccess: () => mockTriggerHapticSuccess(),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

describe('spring toast host', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the imperative API and stacks rapid messages', () => {
    const screen = render(<ToastHost />);

    act(() => {
      toast.success('Farm saved');
      toast.error('Sync failed');
    });

    expect(screen.getByText('Farm saved')).toBeTruthy();
    expect(screen.getByText('Sync failed')).toBeTruthy();
    expect(mockTriggerHapticSuccess).toHaveBeenCalledTimes(1);
    expect(mockTriggerHapticError).toHaveBeenCalledTimes(1);
  });

  it('supports an optional action without changing existing call sites', async () => {
    const onActionPress = jest.fn();
    const screen = render(<ToastHost />);

    act(() => {
      toast.info('Log is offline', { actionLabel: 'Retry', onActionPress });
    });
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
      await Promise.resolve();
    });

    expect(onActionPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
  });

  it('reveals a hidden toast when the visible stack shrinks', async () => {
    const withTimingMock = Reanimated.withTiming as jest.MockedFunction<
      typeof Reanimated.withTiming
    >;
    const screen = render(<ToastHost />);

    act(() => {
      toast.info('First', 60_000);
      toast.info('Second', 60_000);
      toast.info('Third', 60_000);
      toast.info('Fourth', 60_000);
    });
    withTimingMock.mockClear();

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss notification' });
    await act(async () => {
      fireEvent.press(dismissButtons[dismissButtons.length - 1]);
      await Promise.resolve();
    });

    expect(withTimingMock).toHaveBeenCalledWith(1, { duration: 200 });
  });
});
