import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol } from '@/components/ui/symbol';
import { spacing, componentRadius, fontSize, fontWeight, shadows } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { triggerHaptic, triggerHapticError, triggerHapticSuccess } from '@/utils/haptics';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant; duration: number };

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

function emit(message: string, variant: ToastVariant, duration = 2600) {
  if (!message) return;
  counter += 1;
  const item: ToastItem = { id: counter, message, variant, duration };
  listeners.forEach((l) => l(item));
}

/**
 * Imperative toast API — call from anywhere (including deep, non-hook code).
 * Messages must already be translated; pass `t('...')` in.
 * Rendered by a single <ToastHost /> mounted at the app root.
 */
export const toast = {
  success: (message: string, duration?: number) => emit(message, 'success', duration),
  error: (message: string, duration?: number) => emit(message, 'error', duration),
  info: (message: string, duration?: number) => emit(message, 'info', duration),
};

/** Mount once, near the app root, inside SafeAreaProvider. Shows the latest toast. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const [current, setCurrent] = useState<ToastItem | null>(null);
  // Lazy-init Animated.Values once; using state (not a ref) keeps the values
  // stable without reading a ref during render.
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(20));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setCurrent(null);
    });
  }, [opacity, translateY]);

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setCurrent(item);
      if (item.variant === 'success') triggerHapticSuccess();
      else if (item.variant === 'error') triggerHapticError();
      else triggerHaptic();
      opacity.setValue(0);
      translateY.setValue(20);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
      hideTimer.current = setTimeout(hide, item.duration);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity, translateY, hide]);

  if (!current) return null;

  const palette: Record<ToastVariant, { bg: string; icon: string }> = {
    success: { bg: m3.colorScheme.success, icon: 'checkmark.circle.fill' },
    error: { bg: m3.colorScheme.error, icon: 'exclamationmark.circle.fill' },
    info: { bg: m3.colorScheme.primary, icon: 'info.circle.fill' },
  };
  const { bg, icon } = palette[current.variant];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + spacing[4],
        alignItems: 'center',
        paddingHorizontal: spacing[4],
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        onPress={hide}
        accessibilityRole="alert"
        accessibilityLabel={current.message}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          maxWidth: 480,
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[4],
          borderRadius: componentRadius.sheet,
          backgroundColor: bg,
          ...shadows.lg,
        }}
      >
        <Symbol name={icon} size={20} color={m3.colorScheme.onPrimary} />
        <Text
          style={{
            flexShrink: 1,
            color: m3.colorScheme.onPrimary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
          }}
        >
          {current.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
