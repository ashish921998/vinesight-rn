import { InteractionManager, Platform } from 'react-native';

/**
 * Wait for all pending interactions (animations, layout) to finish,
 * then wait two animation frames for layout to commit.
 */
function waitForSettledLayout(): Promise<void> {
  // On Android, runAfterInteractions can delay too long when tour animations
  // are active. Use frame-based settling to keep overlay tracking responsive.
  if (Platform.OS === 'android') {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  });
}

/**
 * A single requestAnimationFrame as a promise.
 */
function raf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export interface StableRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsClose(a: StableRect, b: StableRect, epsilon: number): boolean {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.width - b.width) <= epsilon &&
    Math.abs(a.height - b.height) <= epsilon
  );
}

/**
 * Measures a target using the provided function, waiting for interactions
 * to settle and then checking that two consecutive measurements converge
 * (delta ≤ epsilon px). This replaces fixed delays and retry loops.
 *
 * @param measureFn  Async function that returns a rect or null.
 * @param options.maxFrames  Max rAF ticks to wait for convergence (default 8).
 * @param options.epsilon    Max px difference to consider stable (default 1).
 * @param options.signal     AbortSignal to cancel early.
 * @returns The stable rect, or null if measurement failed or was cancelled.
 */
export async function measureStable(
  measureFn: () => Promise<StableRect | null>,
  options?: { maxFrames?: number; epsilon?: number; signal?: AbortSignal },
): Promise<StableRect | null> {
  const { maxFrames = 8, epsilon = 1, signal } = options ?? {};

  if (signal?.aborted) return null;

  // Wait for animations/interactions to finish + 2 frames for layout commit
  await waitForSettledLayout();
  if (signal?.aborted) return null;

  let prev = await measureFn();
  if (!prev) return null;
  if (signal?.aborted) return null;

  for (let i = 0; i < maxFrames; i++) {
    await raf();
    if (signal?.aborted) return null;

    const next = await measureFn();
    if (!next) return prev; // lost the node, return last known
    if (signal?.aborted) return null;

    if (rectsClose(prev, next, epsilon)) {
      return next;
    }
    prev = next;
  }

  // Didn't converge but return best effort
  return prev;
}
