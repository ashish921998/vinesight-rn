import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { spacing, borderRadius } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  delay?: number;
}

function SkeletonBlock({ width, height, radius = borderRadius.md, delay = 0 }: SkeletonBlockProps) {
  const m3 = useM3();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 800 }), -1, true));
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colorWithOpacity(m3.colorScheme.onSurface, 0.08),
        },
        animatedStyle,
      ]}
    />
  );
}

export function AssistantAnswerSkeleton() {
  const m3 = useM3();

  return (
    <View
      style={{
        backgroundColor: m3.surface.surfaceContainerLow,
        borderRadius: borderRadius['2xl'],
        padding: spacing[4],
        gap: spacing[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        <SkeletonBlock width={36} height={36} radius={borderRadius.full} delay={0} />
        <SkeletonBlock width={80} height={16} delay={100} />
        <View style={{ flex: 1 }} />
        <SkeletonBlock width={90} height={22} radius={borderRadius.md} delay={200} />
      </View>

      <View
        style={{
          backgroundColor: colorWithOpacity(m3.colorScheme.onSurface, 0.04),
          borderRadius: borderRadius.lg,
          padding: spacing[3],
          gap: spacing[2],
        }}
      >
        <SkeletonBlock width={100} height={12} delay={150} />
        <SkeletonBlock width={120} height={28} delay={250} />
      </View>

      <View style={{ gap: spacing[2] }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing[2],
              borderBottomWidth: i < 2 ? 1 : 0,
              borderBottomColor: m3.colorScheme.outlineVariant,
              gap: spacing[2],
            }}
          >
            <SkeletonBlock width={60} height={12} delay={300 + i * 100} />
            <SkeletonBlock
              width={`${55 - i * 10}%` as `${number}%`}
              height={14}
              delay={350 + i * 100}
            />
            <View style={{ flex: 1 }} />
            <SkeletonBlock width={50} height={12} delay={400 + i * 100} />
          </View>
        ))}
      </View>

      <SkeletonBlock width="100%" height={44} radius={borderRadius.xl} delay={600} />
    </View>
  );
}
