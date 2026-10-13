import { useEffect, useRef } from 'react';
import {
  Keyboard,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from 'react-native';
import { calculateKeyboardScrollOffset, resolveKeyboardTop } from '@/utils/keyboard-scroll';

/**
 * Scrolls `targetRef` (the screen's primary button) above the keyboard when it
 * opens, so the user never has to dismiss the keyboard to reach it.
 *
 * Spread `scrollProps` on the ScrollView and attach `targetRef` to a
 * `collapsable={false}` View wrapping the button.
 */
export function useRevealAboveKeyboard() {
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const targetRef = useRef<View>(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = resolveKeyboardTop({
        screenY: event.endCoordinates.screenY,
        keyboardHeight: event.endCoordinates.height,
        windowHeight,
      });
      targetRef.current?.measureInWindow((_x, y, _width, height) => {
        const nextOffset = calculateKeyboardScrollOffset({
          currentOffset: offsetRef.current,
          inputY: y,
          inputHeight: height,
          keyboardTop,
          buffer: 16,
        });
        if (nextOffset != null) scrollRef.current?.scrollTo({ y: nextOffset, animated: true });
      });
    });
    return () => listener.remove();
  }, [windowHeight]);

  return {
    targetRef,
    scrollProps: {
      ref: scrollRef,
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = event.nativeEvent.contentOffset.y;
      },
    },
  };
}
