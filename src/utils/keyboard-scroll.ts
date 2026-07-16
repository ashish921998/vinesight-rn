interface KeyboardScrollOffsetParams {
  currentOffset: number;
  inputY: number;
  inputHeight: number;
  keyboardTop: number;
  buffer?: number;
}

export function calculateKeyboardScrollOffset({
  currentOffset,
  inputY,
  inputHeight,
  keyboardTop,
  buffer = 24,
}: KeyboardScrollOffsetParams): number | null {
  const visibleBottom = keyboardTop - buffer;
  const inputBottom = inputY + inputHeight;

  if (inputBottom <= visibleBottom) return null;

  return Math.max(0, currentOffset + inputBottom - visibleBottom);
}
