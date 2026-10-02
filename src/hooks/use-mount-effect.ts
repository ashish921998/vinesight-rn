import { useEffect } from 'react';

type Effect = () => void | (() => void);

export function useMountEffect(effect: Effect): void {
  // This is the explicit escape hatch for one-time external synchronization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
