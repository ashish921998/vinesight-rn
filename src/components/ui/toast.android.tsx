import React, { useEffect, useRef, useState } from 'react';
import { Host, Snackbar, SnackbarHost, type SnackbarHostRef } from '@expo/ui/jetpack-compose';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { triggerHaptic, triggerHapticError, triggerHapticSuccess } from '@/utils/haptics';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant; duration: number };

let counter = 0;
const listeners = new Set<(toastItem: ToastItem) => void>();

function emit(message: string, variant: ToastVariant, duration = 2600) {
  if (!message) return;
  counter += 1;
  listeners.forEach((listener) => listener({ id: counter, message, variant, duration }));
}

export const toast = {
  success: (message: string, duration?: number) => emit(message, 'success', duration),
  error: (message: string, duration?: number) => emit(message, 'error', duration),
  info: (message: string, duration?: number) => emit(message, 'info', duration),
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const snackbarHostRef = useRef<SnackbarHostRef>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [variant, setVariant] = useState<ToastVariant>('info');

  useEffect(() => {
    const onToast = (toastItem: ToastItem) => {
      if (toastItem.variant === 'success') triggerHapticSuccess();
      else if (toastItem.variant === 'error') triggerHapticError();
      else triggerHaptic();

      setVariant(toastItem.variant);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        void snackbarHostRef.current?.showSnackbar({
          message: toastItem.message,
          duration: toastItem.duration > 4000 ? 'long' : 'short',
          withDismissAction: toastItem.variant === 'error',
        });
      }, 0);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  const palette = {
    success: { background: m3.colorScheme.success, foreground: m3.colorScheme.onSuccess },
    error: { background: m3.colorScheme.error, foreground: m3.colorScheme.onError },
    info: { background: m3.colorScheme.primary, foreground: m3.colorScheme.onPrimary },
  }[variant];

  return (
    <Host
      matchContents
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: spacing[4],
        right: spacing[4],
        bottom: insets.bottom + spacing[4],
        zIndex: 1000,
      }}
    >
      <SnackbarHost ref={snackbarHostRef}>
        <Snackbar
          containerColor={palette.background}
          contentColor={palette.foreground}
          actionContentColor={palette.foreground}
          dismissActionContentColor={palette.foreground}
        />
      </SnackbarHost>
    </Host>
  );
}
