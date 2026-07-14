import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

const MAX_CONSECUTIVE_FLUSH_FAILURES = 3;

let unsubscribe: (() => void) | undefined;
let isOnline = true;
let consecutiveFlushFailures = 0;
const listeners = new Set<() => void>();

function setOnline(nextOnline: boolean) {
  if (isOnline === nextOnline) return;
  isOnline = nextOnline;
  onlineManager.setOnline(nextOnline);
  listeners.forEach((listener) => listener());
}

export function startOnlineManager() {
  if (unsubscribe) return unsubscribe;

  unsubscribe = NetInfo.addEventListener((state) => {
    const reachable = state.isInternetReachable;
    setOnline(state.isConnected === true && reachable !== false);
    if (state.isConnected === true && reachable !== false) consecutiveFlushFailures = 0;
  });

  return unsubscribe;
}

export function subscribeToOnlineStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOnlineStatus() {
  return isOnline;
}

export function recordFlushSuccess() {
  consecutiveFlushFailures = 0;
}

export function recordFlushFailure() {
  consecutiveFlushFailures += 1;
  if (consecutiveFlushFailures >= MAX_CONSECUTIVE_FLUSH_FAILURES) setOnline(false);
}

export function stopOnlineManagerForTests() {
  unsubscribe?.();
  unsubscribe = undefined;
  consecutiveFlushFailures = 0;
  setOnline(true);
}
