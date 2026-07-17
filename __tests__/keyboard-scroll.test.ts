import { calculateKeyboardScrollOffset, resolveKeyboardTop } from '@/utils/keyboard-scroll';

describe('resolveKeyboardTop', () => {
  it('preserves the standard iOS docked-keyboard position', () => {
    expect(
      resolveKeyboardTop({
        screenY: 553,
        keyboardHeight: 291,
        windowHeight: 844,
      }),
    ).toBe(553);
  });

  it('falls back to window height minus keyboard height when screenY is unavailable', () => {
    expect(
      resolveKeyboardTop({
        screenY: 0,
        keyboardHeight: 291,
        windowHeight: 844,
      }),
    ).toBe(553);
  });
});

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

  it('keeps an iPhone input above the docked keyboard with the requested buffer', () => {
    expect(
      calculateKeyboardScrollOffset({
        currentOffset: 0,
        inputY: 510,
        inputHeight: 44,
        keyboardTop: 553,
        buffer: 24,
      }),
    ).toBe(25);
  });
});
