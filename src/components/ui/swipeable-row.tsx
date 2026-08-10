import React, { type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, spacing } from '@/styles/theme';

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export interface SwipeAction {
  label: string;
  icon: string;
  onPress: () => void;
}

export interface SwipeableRowState {
  isOpen: boolean;
  close: () => void;
}

export function shouldClaimHorizontalSwipe(dx: number, dy: number, hasActions: boolean): boolean {
  if (!hasActions) return false;
  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);
  return horizontalDistance > 10 && horizontalDistance > verticalDistance;
}

interface SwipeableRowProps {
  /** Revealed by swiping right; rendered on the leading/left side. */
  leadingAction?: SwipeAction;
  /** Revealed by swiping left; rendered on the trailing/right side. */
  trailingAction?: SwipeAction;
  children: (state: SwipeableRowState) => ReactNode;
}

export function SwipeableRow({ leadingAction, trailingAction, children }: SwipeableRowProps) {
  const m3 = useM3();
  const translateX = React.useMemo(() => new Animated.Value(0), []);
  const [isOpen, setIsOpen] = React.useState(false);

  const close = React.useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setIsOpen(false);
  }, [translateX]);

  const open = React.useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        friction: 8,
      }).start();
      setIsOpen(true);
    },
    [translateX],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return shouldClaimHorizontalSwipe(
            gestureState.dx,
            gestureState.dy,
            Boolean(leadingAction || trailingAction),
          );
        },
        onPanResponderMove: (_, gestureState) => {
          const newX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, gestureState.dx));
          translateX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD && leadingAction) {
            open(SWIPE_THRESHOLD);
          } else if (gestureState.dx < -SWIPE_THRESHOLD && trailingAction) {
            open(-SWIPE_THRESHOLD);
          } else {
            close();
          }
        },
      }),
    [close, leadingAction, open, trailingAction, translateX],
  );

  const invokeAction = React.useCallback(
    (action: SwipeAction) => {
      close();
      action.onPress();
    },
    [close],
  );

  const renderAction = (action: SwipeAction | undefined) =>
    action ? (
      <Pressable
        onPress={() => invokeAction(action)}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={{
          backgroundColor: action === leadingAction ? m3.colorScheme.primary : m3.colorScheme.error,
          borderRadius: borderRadius.md,
          padding: spacing[2],
        }}
      >
        <SymbolIcon
          name={action.icon}
          size={20}
          color={action === leadingAction ? m3.colorScheme.onPrimary : m3.colorScheme.onError}
        />
      </Pressable>
    ) : (
      <View />
    );

  return (
    <View style={{ position: 'relative' }}>
      <View
        testID="swipe-actions"
        accessibilityElementsHidden={!isOpen}
        importantForAccessibility={isOpen ? 'yes' : 'no-hide-descendants'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
        }}
      >
        {renderAction(leadingAction)}
        {renderAction(trailingAction)}
      </View>
      <Animated.View
        testID="swipeable-content"
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children({ isOpen, close })}
      </Animated.View>
    </View>
  );
}
