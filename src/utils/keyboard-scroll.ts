interface KeyboardScrollOffsetParams {
  currentOffset: number;
  inputY: number;
  inputHeight: number;
  keyboardTop: number;
  buffer?: number;
}

interface ResolveKeyboardTopParams {
  screenY: number;
  keyboardHeight: number;
  windowHeight: number;
}

export function resolveKeyboardTop({
  screenY,
  keyboardHeight,
  windowHeight,
}: ResolveKeyboardTopParams): number {
  return Number.isFinite(screenY) && screenY > 0 ? screenY : windowHeight - keyboardHeight;
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
