import { calculateKeyboardScrollOffset } from '@/utils/keyboard-scroll';

describe('calculateKeyboardScrollOffset', () => {
  it('uses the keyboard screen position when Android adjustResize already shrank the window', () => {
    expect(
      calculateKeyboardScrollOffset({
        currentOffset: 120,
        inputY: 470,
        inputHeight: 50,
        keyboardTop: 500,
        buffer: 24,
      }),
    ).toBe(164);
  });

  it('does not scroll an input that is already visible above the keyboard', () => {
    expect(
      calculateKeyboardScrollOffset({
        currentOffset: 120,
        inputY: 390,
        inputHeight: 50,
        keyboardTop: 500,
        buffer: 24,
      }),
    ).toBeNull();
  });
});
