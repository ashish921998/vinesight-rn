import React, { useEffect, useRef } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHaptic } from '@/utils/haptics';
import appLogoDark from '../../../../assets/icons/ios-dark.png';
import appLogoLight from '../../../../assets/icons/ios-light.png';

interface HeroSlideProps {
  isActive: boolean;
}

export function HeroSlide({ isActive }: HeroSlideProps) {
  const { width } = useWindowDimensions();
  const isDark = useIsDark();
  const m3 = useM3();
  const appLogo = isDark ? appLogoDark : appLogoLight;
  const hasTriggered = useRef(false);
  const isCompact = width < 390;

  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!isActive || hasTriggered.current) return;
    hasTriggered.current = true;

    triggerHaptic();
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 400 });
    progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [isActive, logoOpacity, logoScale, progress]);

  const headlineOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.4, 1], [0, 0, 1]),
  );
  const headlineScale = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.4, 1], [0.95, 0.95, 1]),
  );
  const subtitleOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.7, 1], [0, 0, 1]),
  );
  const subtitleScale = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.7, 1], [0.95, 0.95, 1]),
  );

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const headlineAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ scale: headlineScale.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ scale: subtitleScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
      <View
        style={[
          styles.heroPanel,
          {
            backgroundColor: colorWithOpacity(
              isDark ? m3.surface.surfaceContainerHigh : m3.colorScheme.surface,
              isDark ? 0.58 : 0.92,
            ),
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.12),
          },
        ]}
      >
        <View
          style={[
            styles.heroAccent,
            { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.14) },
          ]}
        />

        <View style={styles.content}>
          <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
            <View
              style={[
                styles.logoCircle,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                },
              ]}
            >
              <Image
                source={appLogo as ImageSourcePropType}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.kickerRow, headlineAnimatedStyle]}>
            <View
              style={[
                styles.kickerPill,
                { backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1) },
              ]}
            >
              <Text style={[styles.kickerText, { color: m3.colorScheme.primary }]}>
                Built for vineyard teams
              </Text>
            </View>
            <Text
              style={[
                styles.headline,
                {
                  color: m3.colorScheme.onSurface,
                  fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
                  fontSize: fontSize['3xl'],
                  fontWeight: '400',
                },
              ]}
            >
              Your vineyard, one app
            </Text>
            <Text style={[styles.subtitle, { color: m3.colorScheme.onSurfaceVariant }]}>
              Track irrigation, sprays, harvests, and tasks. All in one place.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.metricsRow, subtitleAnimatedStyle]}>
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
                  borderColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                },
              ]}
            >
              <Text style={[styles.metricValue, { color: m3.colorScheme.onSurface }]}>1 app</Text>
              <Text style={[styles.metricLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                for field, shed, and payroll
              </Text>
            </View>
            <View
              style={[
                styles.metricCard,
                {
                  backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.09),
                  borderColor: colorWithOpacity(m3.colorScheme.secondary, 0.14),
                },
              ]}
            >
              <Text style={[styles.metricValue, { color: m3.colorScheme.onSurface }]}>Daily</Text>
              <Text style={[styles.metricLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                decisions backed by live logs
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.statementCard,
              { borderLeftColor: m3.colorScheme.primary },
              subtitleAnimatedStyle,
            ]}
          >
            <Text
              style={[
                styles.statementText,
                {
                  color: m3.colorScheme.onSurface,
                  fontSize: isCompact ? fontSize.lg : fontSize.xl,
                },
              ]}
            >
              Less guesswork. Fewer losses. A cleaner operation from sunrise to dispatch.
            </Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[20],
    paddingBottom: spacing[24],
  },
  heroPanel: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: borderRadius['4xl'],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[6],
  },
  heroAccent: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: borderRadius.full,
    top: -70,
    right: -60,
  },
  content: {
    gap: spacing[5],
  },
  logoWrapper: {
    alignSelf: 'flex-start',
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoImage: {
    width: 54,
    height: 54,
  },
  kickerRow: {
    gap: spacing[3],
  },
  kickerPill: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  kickerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    lineHeight: 42,
  },
  subtitle: {
    maxWidth: 420,
    fontSize: fontSize.base,
    lineHeight: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  metricCard: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  },
  metricValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  metricLabel: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  statementCard: {
    borderLeftWidth: 3,
    paddingLeft: spacing[4],
    paddingVertical: spacing[2],
  },
  statementText: {
    fontWeight: fontWeight.semibold,
    lineHeight: 28,
  },
});
