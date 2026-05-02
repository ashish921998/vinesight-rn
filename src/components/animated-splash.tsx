import { View, Image } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing, size, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import appLogoLight from '../../assets/icons/ios-light.png';

interface SplashProps {
  onComplete?: () => void;
  duration?: number;
}

export function AnimatedSplash({ onComplete, duration = 2500 }: SplashProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const [isMounted, setIsMounted] = useState(true);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const logoOpacity = useSharedValue(0);

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
      if (onComplete) {
        onComplete();
      }
      opacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
      setShouldRender(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete, scale, opacity, logoOpacity]);

  useEffect(() => {
    if (!shouldRender) {
      const exitTimer = setTimeout(() => {
        setIsMounted(false);
      }, 300);
      return () => clearTimeout(exitTimer);
    }
  }, [shouldRender]);

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
          backgroundColor: colors.surface[50],
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
                color: colors.surface[900],
                marginBottom: spacing[2],
              },
            ]}
          >
            Vinesight
          </Animated.Text>

          <Animated.Text
            style={[
              textOpacity,
              { color: colorWithOpacity(colors.surface[700], 0.9), fontSize: fontSize.lg },
            ]}
          >
            Farm Management
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
