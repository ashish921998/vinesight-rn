import { View, Image } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

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
    <Animated.View entering={FadeIn} exiting={FadeOut} style={containerStyle} className="flex-1">
      <View className="flex-1 items-center justify-center bg-primary-500">
        <Animated.View style={logoContainerStyle} className="items-center">
          <Animated.View style={logoStyle} className="mb-8 items-center justify-center">
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/splash-icon.png')}
              className="w-32 h-32"
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text style={textOpacity} className="text-4xl font-bold text-white mb-2">
            Vinesight
          </Animated.Text>

          <Animated.Text style={textOpacity} className="text-white/80 text-lg">
            Farm Management
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
