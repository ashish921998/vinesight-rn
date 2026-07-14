import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

let unsubscribe: (() => void) | undefined;
let isOnline = true;
const listeners = new Set<() => void>();

function setOnline(nextOnline: boolean) {
  if (isOnline === nextOnline) return;
  isOnline = nextOnline;
  onlineManager.setOnline(nextOnline);
  listeners.forEach((listener) => listener());
}

export function startOnlineManager() {
  if (unsubscribe) return unsubscribe;

  const unsubscribeNative = NetInfo.addEventListener((state) => {
    const reachable = state.isInternetReachable;
    setOnline(state.isConnected === true && reachable !== false);
  });
  const stop = () => {
    unsubscribeNative();
    if (unsubscribe === stop) unsubscribe = undefined;
  };
  unsubscribe = stop;

  return stop;
}

export function subscribeToOnlineStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOnlineStatus() {
  return isOnline;
}

export function stopOnlineManagerForTests() {
  unsubscribe?.();
  unsubscribe = undefined;
  setOnline(true);
}
