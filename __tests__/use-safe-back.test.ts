import { renderHook } from '@testing-library/react-native';

import { useSafeBack } from '@/hooks/use-safe-back';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack }),
}));

describe('useSafeBack', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pops the stack when there is a screen to go back to', () => {
    mockCanGoBack.mockReturnValue(true);
    const { result } = renderHook(() => useSafeBack());

    result.current();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('dispatches only once when dismissal is requested twice before navigation updates', () => {
    jest.useFakeTimers();
    mockCanGoBack.mockReturnValue(true);
    const { result } = renderHook(() => useSafeBack());

    result.current();
    result.current();

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    result.current();

    expect(mockCanGoBack).toHaveBeenCalledTimes(2);
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('replaces to the tabs home when the stack has nothing to pop', () => {
    // This is the GO_BACK-orphan case: a modal reached as a root route.
    mockCanGoBack.mockReturnValue(false);
    const { result } = renderHook(() => useSafeBack());

    result.current();

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('replaces to a custom fallback route when provided', () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = renderHook(() => useSafeBack('/farm/5'));

    result.current();

    expect(mockReplace).toHaveBeenCalledWith('/farm/5');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
