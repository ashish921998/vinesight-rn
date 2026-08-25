import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Symbol } from '@/components/ui/symbol';
import { springs } from '@/styles/motion';
import { componentRadius, fontSize, fontWeight, shadows, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHaptic, triggerHapticError, triggerHapticSuccess } from '@/utils/haptics';

type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  duration?: number;
  actionLabel?: string;
  onActionPress?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
  exiting?: boolean;
}

type ToastArgument = number | ToastOptions | undefined;

const ENTER_OFFSET = 144;
const HIDDEN_SCALE = 0.82;
const EXIT_OFFSET = 56;
const SWIPE_EXIT_OFFSET = 96;
const EXIT_DURATION = 180;
const FADE_DURATION = 200;
const DISMISS_DISTANCE = 56;
const DISMISS_VELOCITY = 800;
const STACK_PEEK = 14;
const STACK_SCALE_STEP = 0.045;
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 2600;
const EXIT_EASING = Easing.bezier(0.23, 1, 0.32, 1);

let counter = 0;
const listeners = new Set<(toastItem: ToastItem) => void>();

function normalizeOptions(argument: ToastArgument): ToastOptions & { duration: number } {
  if (typeof argument === 'number') return { duration: argument };
  return { ...argument, duration: argument?.duration ?? DEFAULT_DURATION };
}

function emit(message: string, variant: ToastVariant, argument?: ToastArgument) {
  if (!message) return;
  counter += 1;
  listeners.forEach((listener) =>
    listener({ id: counter, message, variant, ...normalizeOptions(argument) }),
  );
}

/**
 * Imperative toast API for translated messages. The second argument remains
 * compatible with the historic duration number and also accepts an action.
 */
export const toast = {
  success: (message: string, options?: ToastArgument) => emit(message, 'success', options),
  error: (message: string, options?: ToastArgument) => emit(message, 'error', options),
  info: (message: string, options?: ToastArgument) => emit(message, 'info', options),
};

function rubberBand(distance: number) {
  'worklet';
  return (36 * distance) / (distance + 120);
}

interface ToastCardProps {
  item: ToastItem;
  index: number;
  onDismissStart: (id: number) => void;
  onDismissed: (id: number) => void;
}

function ToastCard({ item, index, onDismissStart, onDismissed }: ToastCardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const m3 = useM3();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const stackY = useSharedValue(-index * STACK_PEEK);
  const stackScale = useSharedValue(1 - index * STACK_SCALE_STEP);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishDismiss = useCallback(() => onDismissed(item.id), [item.id, onDismissed]);

  const dismiss = useCallback(
    (kind: 'timeout' | 'close' | 'swipe') => {
      if (exitingRef.current) return;
      exitingRef.current = true;
      clearTimer();
      onDismissStart(item.id);

      // runOnJS (not scheduleOnRN) here: scheduling from an animation callback
      // trips the Reanimated JSI use-after-free on Android New Architecture.
      opacity.set(
        withTiming(0, { duration: EXIT_DURATION }, (finished) => {
          if (finished) runOnJS(finishDismiss)();
        }),
      );

      if (reducedMotion) return;
      if (kind === 'swipe') {
        dragY.set(
          withTiming(dragY.get() + SWIPE_EXIT_OFFSET, {
            duration: EXIT_DURATION,
            easing: EXIT_EASING,
          }),
        );
      } else if (indexRef.current === 0) {
        dragY.set(withTiming(EXIT_OFFSET, { duration: EXIT_DURATION, easing: EXIT_EASING }));
      }
    },
    [clearTimer, dragY, finishDismiss, item.id, onDismissStart, opacity, reducedMotion],
  );

  const restartTimer = useCallback(() => {
    if (exitingRef.current) return;
    clearTimer();
    timerRef.current = setTimeout(() => dismiss('timeout'), item.duration);
  }, [clearTimer, dismiss, item.duration]);

  const dismissFromSwipe = useCallback(() => {
    triggerHaptic();
    dismiss('swipe');
  }, [dismiss]);

  useEffect(() => {
    progress.set(reducedMotion ? 1 : withSpring(1, springs.default));
    opacity.set(withTiming(1, { duration: FADE_DURATION, easing: EXIT_EASING }));
    restartTimer();
    return clearTimer;
  }, [clearTimer, opacity, progress, reducedMotion, restartTimer]);

  useEffect(() => {
    if (exitingRef.current) return;
    const y = -index * STACK_PEEK;
    const scale = 1 - index * STACK_SCALE_STEP;
    stackY.set(reducedMotion ? y : withSpring(y, springs.gentle));
    stackScale.set(reducedMotion ? scale : withSpring(scale, springs.gentle));
    opacity.set(withTiming(index >= MAX_VISIBLE ? 0 : 1, { duration: FADE_DURATION }));
  }, [index, opacity, reducedMotion, stackScale, stackY]);

  const pan = Gesture.Pan()
    .enabled(index === 0)
    .activeOffsetY([-8, 8])
    .failOffsetX([-32, 32])
    .onBegin(() => scheduleOnRN(clearTimer))
    .onUpdate((event) => {
      dragY.set(event.translationY >= 0 ? event.translationY : -rubberBand(-event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(dismissFromSwipe);
      } else {
        dragY.set(withSpring(0, springs.momentum));
        scheduleOnRN(restartTimer);
      }
    })
    .onFinalize((_event, success) => {
      if (!success) scheduleOnRN(restartTimer);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const entrance = progress.get();
    return {
      opacity: opacity.get(),
      transform: [
        { translateY: (1 - entrance) * ENTER_OFFSET + stackY.get() + dragY.get() },
        { scale: (HIDDEN_SCALE + (1 - HIDDEN_SCALE) * entrance) * stackScale.get() },
      ],
    };
  });

  const variantColor = {
    success: m3.colorScheme.success,
    error: m3.colorScheme.error,
    info: m3.colorScheme.inversePrimary,
  }[item.variant];
  const icon = {
    success: 'checkmark.circle.fill',
    error: 'exclamationmark.circle.fill',
    info: 'info.circle.fill',
  }[item.variant];

  const handleAction = () => {
    item.onActionPress?.();
    dismiss('close');
  };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        pointerEvents={index === 0 ? 'auto' : 'none'}
        style={[
          styles.toast,
          {
            bottom: insets.bottom + spacing[4],
            backgroundColor: m3.colorScheme.inverseSurface,
            borderColor: colorWithOpacity(m3.colorScheme.inverseOnSurface, 0.14),
            zIndex: 1000 - index,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colorWithOpacity(variantColor, 0.18) },
            ]}
          >
            <Symbol name={icon} size={18} color={variantColor} />
          </View>

          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            numberOfLines={3}
            style={[styles.message, { color: m3.colorScheme.inverseOnSurface }]}
          >
            {item.message}
          </Text>

          {item.actionLabel && item.onActionPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.actionLabel}
              hitSlop={spacing[2]}
              onPress={handleAction}
              style={styles.actionButton}
            >
              <Text style={[styles.actionLabel, { color: m3.colorScheme.inversePrimary }]}>
                {item.actionLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={spacing[2]}
            onPress={() => dismiss('close')}
            style={styles.closeButton}
          >
            <Symbol name="xmark" size={16} color={m3.colorScheme.inverseOnSurface} />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Mount once near the app root, inside SafeAreaProvider and GestureHandlerRootView. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      if (item.variant === 'success') triggerHapticSuccess();
      else if (item.variant === 'error') triggerHapticError();
      else triggerHaptic();
      setToasts((current) => [...current, item]);
    };

    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  const handleDismissStart = useCallback((id: number) => {
    setToasts((current) =>
      current.map((item) => (item.id === id ? { ...item, exiting: true } : item)),
    );
  }, []);

  const handleDismissed = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {toasts.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          index={toasts.filter((candidate) => !candidate.exiting && candidate.id > item.id).length}
          onDismissStart={handleDismissStart}
          onDismissed={handleDismissed}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    width: '92%',
    maxWidth: 520,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: componentRadius.card,
    ...shadows.lg,
  },
  content: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
    paddingVertical: spacing[2],
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: componentRadius.pill,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  actionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[1],
  },
  actionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: componentRadius.pill,
  },
});
