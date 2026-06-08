import { useEffect, useState } from 'react';

interface UseTypewriterOptions {
  /** Characters revealed per tick. Higher = faster. */
  charsPerTick?: number;
  /** Milliseconds between ticks. */
  tickMs?: number;
}

interface UseTypewriterResult {
  /** The portion of `fullText` revealed so far. */
  text: string;
  /** True while characters are still being revealed. */
  isRevealing: boolean;
}

/**
 * Progressively reveals already-received text to create a ChatGPT/Claude-style
 * "streaming" feel without any server changes. When `enabled` is false (e.g. for
 * messages loaded from history) the full text is shown immediately.
 *
 * Assumes a stable `fullText` per hook instance — chat messages are keyed by id,
 * so each message gets its own instance and its content never changes mid-reveal.
 */
export function useTypewriter(
  fullText: string,
  enabled: boolean,
  options?: UseTypewriterOptions,
): UseTypewriterResult {
  const charsPerTick = options?.charsPerTick ?? 3;
  const tickMs = options?.tickMs ?? 16;

  const [count, setCount] = useState(enabled ? 0 : fullText.length);

  useEffect(() => {
    if (!enabled) return undefined;

    const interval = setInterval(() => {
      setCount((prev) => {
        const next = prev + charsPerTick;
        if (next >= fullText.length) {
          clearInterval(interval);
          return fullText.length;
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [fullText, enabled, charsPerTick, tickMs]);

  if (!enabled) {
    return { text: fullText, isRevealing: false };
  }

  const clamped = Math.min(count, fullText.length);
  return { text: fullText.slice(0, clamped), isRevealing: clamped < fullText.length };
}
