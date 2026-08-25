import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { springs } from '@/styles/motion';
import { fontSize, fontWeight, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

interface OnboardingStageHeaderProps {
  isActive: boolean;
  title: string;
  subtitle: string;
}

function AnimatedWord({
  word,
  index,
  isActive,
  color,
}: {
  word: string;
  index: number;
  isActive: boolean;
  color: string;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (!isActive) {
      progress.set(0);
      return;
    }
    progress.set(reducedMotion ? 1 : withDelay(index * 55, withSpring(1, springs.default)));
  }, [index, isActive, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [
      { translateY: interpolate(progress.get(), [0, 1], [14, 0]) },
      { scale: interpolate(progress.get(), [0, 1], [0.94, 1]) },
    ],
  }));

  return (
    <Animated.Text accessible={false} style={[styles.title, { color }, animatedStyle]}>
      {word}{' '}
    </Animated.Text>
  );
}

/**
 * Keeps the useful part of the spring-onboarding reference—the localized
 * staggered heading—without inserting demo artwork into the farm task.
 */
export function OnboardingStageHeader({ isActive, title, subtitle }: OnboardingStageHeaderProps) {
  const m3 = useM3();
  const words = title.trim().split(/\s+/u);
  const wordItems = words.map((word, index) => ({
    word,
    index,
    key: words.slice(0, index + 1).join(' '),
  }));

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={title}
        style={styles.titleRow}
      >
        {wordItems.map((item) => (
          <AnimatedWord
            key={item.key}
            word={item.word}
            index={item.index}
            isActive={isActive}
            color={m3.colorScheme.onSurface}
          />
        ))}
      </View>
      <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: fontSize.base,
    lineHeight: 24,
  },
});
