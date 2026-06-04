import { renderHook, act } from '@testing-library/react-native';
import { useTypewriter } from '@/hooks/use-typewriter';

describe('useTypewriter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows the full text immediately when disabled', () => {
    const { result } = renderHook(() => useTypewriter('Hello farmer', false));
    expect(result.current.text).toBe('Hello farmer');
    expect(result.current.isRevealing).toBe(false);
  });

  it('starts empty and reveals progressively when enabled', () => {
    const { result } = renderHook(() =>
      useTypewriter('abcdef', true, { charsPerTick: 2, tickMs: 10 }),
    );

    expect(result.current.text).toBe('');
    expect(result.current.isRevealing).toBe(true);

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.text).toBe('ab');
    expect(result.current.isRevealing).toBe(true);

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.text).toBe('abcd');
  });

  it('reveals the entire text and stops revealing once complete', () => {
    const { result } = renderHook(() =>
      useTypewriter('abcdef', true, { charsPerTick: 2, tickMs: 10 }),
    );

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.text).toBe('abcdef');
    expect(result.current.isRevealing).toBe(false);
  });

  it('handles an empty string without revealing', () => {
    const { result } = renderHook(() => useTypewriter('', true));
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current.text).toBe('');
    expect(result.current.isRevealing).toBe(false);
  });
});
