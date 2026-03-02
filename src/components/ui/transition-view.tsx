import React from 'react';
import Animated from 'react-native-reanimated';
import { fadeIn, fadeOut, slideUp } from '@/lib/animations';
interface TransitionViewProps extends React.ComponentProps<typeof Animated.View> {
  children: React.ReactNode;
  variant?: 'fade' | 'slideUp';
}

export function TransitionView({ children, variant = 'fade', ...props }: TransitionViewProps) {
  return (
    <Animated.View entering={variant === 'fade' ? fadeIn : slideUp} exiting={fadeOut} {...props}>
      {children}
    </Animated.View>
  );
}
