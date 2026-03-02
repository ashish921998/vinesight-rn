import React, { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useM3 } from '@/styles/use-theme';
import { borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const m3 = useM3();
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.95,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius.lg,
          backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.16),
          opacity,
        } as never,
        style as never,
      ]}
    />
  );
}
