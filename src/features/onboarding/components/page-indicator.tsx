import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, type SharedValue } from 'react-native-reanimated';
import { spacing, borderRadius } from '@/styles/theme';

interface PageIndicatorProps {
  totalPages: number;
  currentPage: SharedValue<number>;
}

const DOT_SIZE = 8;
const ACTIVE_DOT_WIDTH = 24;
const ACTIVE_COLOR = '#408059';

const Dot = memo(function Dot({
  index,
  currentPage,
}: {
  index: number;
  currentPage: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const width = interpolate(
      currentPage.value,
      [index - 1, index, index + 1],
      [DOT_SIZE, ACTIVE_DOT_WIDTH, DOT_SIZE],
      'clamp',
    );

    const opacity = interpolate(
      currentPage.value,
      [index - 1, index, index + 1],
      [0.3, 1, 0.3],
      'clamp',
    );

    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          height: DOT_SIZE,
          borderRadius: borderRadius.full,
          backgroundColor: ACTIVE_COLOR,
        },
        animatedStyle,
      ]}
    />
  );
});

export function PageIndicator({ totalPages, currentPage }: PageIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }, (_, i) => (
        <Dot key={i} index={i} currentPage={currentPage} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  dot: {
    height: DOT_SIZE,
  },
});
