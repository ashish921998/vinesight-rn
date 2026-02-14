/**
 * OfflineBanner
 * Displays a banner at the top of the screen when the device is offline.
 * Animates in/out smoothly using React Native Reanimated.
 */

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useIsOnline } from '@/services/offline';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing, borderRadius } from '@/styles/theme';

// ============================================================
// MARK: - Component
// ============================================================

export function OfflineBanner() {
  const isOnline = useIsOnline();
  const m3 = useM3();
  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!isOnline) {
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(-60, { duration: 250, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: 250 });
    }
  }, [isOnline, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: m3.colorScheme.error },
        animatedStyle,
      ]}
      pointerEvents={isOnline ? 'none' : 'auto'}
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={16} color={m3.colorScheme.onError} />
        <Text style={[styles.text, { color: m3.colorScheme.onError }]}>
          You are offline. Changes will sync when connected.
        </Text>
      </View>
    </Animated.View>
  );
}

// ============================================================
// MARK: - Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});

export default OfflineBanner;
