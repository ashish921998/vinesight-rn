import { View, Image } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { spacing, size, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import appLogoLight from '../../assets/icons/ios-light.png';

const FADE_OUT_DURATION = 300;

interface SplashProps {
  onComplete?: () => void;
  duration?: number;
}

export function AnimatedSplash({ onComplete, duration = 2500 }: SplashProps) {
  const m3 = useM3();
  const [isMounted, setIsMounted] = useState(true);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);

  const finishSplash = useCallback(() => {
    setIsMounted(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(0.8, { duration: 800, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
      withTiming(1, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
    );

    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });

    logoOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
    );

    const timer = setTimeout(() => {
      opacity.value = withTiming(
        0,
        {
          duration: FADE_OUT_DURATION,
          easing: Easing.out(Easing.ease),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishSplash)();
          }
        },
      );
    }, duration);

    return () => {
      clearTimeout(timer);
      cancelAnimation(opacity);
    };
  }, [duration, finishSplash, scale, opacity, logoOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  const textOpacity = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
  }));

  if (!isMounted) {
    return null;
  }

  return (
    <Animated.View style={[containerStyle, { flex: 1 }]}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: m3.surface.s50,
        }}
      >
        <Animated.View style={[logoContainerStyle, { alignItems: 'center' }]}>
          <Animated.View
            style={[
              logoStyle,
              {
                marginBottom: spacing[8],
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Image
              source={appLogoLight}
              style={{
                width: size['4xl'],
                height: size['4xl'],
                borderRadius: borderRadius['3xl'],
              }}
              resizeMode="cover"
            />
          </Animated.View>

          <Animated.Text
            style={[
              textOpacity,
              {
                fontSize: fontSize['4xl'],
                fontWeight: fontWeight.bold,
                color: m3.surface.s900,
                marginBottom: spacing[2],
              },
            ]}
          >
            Vinesight
          </Animated.Text>

          <Animated.Text
            style={[
              textOpacity,
              { color: colorWithOpacity(m3.surface.s700, 0.9), fontSize: fontSize.lg },
            ]}
          >
            Farm Management
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
