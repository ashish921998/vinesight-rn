/**
 * OfflineBanner – A persistent, non-intrusive banner that slides in when the
 * device loses connectivity and auto-dismisses with a brief "Back online"
 * confirmation when connectivity is restored.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useM3 } from '@/styles/use-theme';
import { colors as baseColors, fontSize, fontWeight, spacing, borderRadius } from '@/styles/theme';

const SLIDE_DURATION = 300;

export function OfflineBanner() {
  const { isConnected, isInternetReachable, justReconnected, isLoading } = useNetworkStatus();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isOffline = !isConnected || !isInternetReachable;
  const showBanner = isOffline || justReconnected;

  useEffect(() => {
    if (isLoading) return;

    if (showBanner) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showBanner, isLoading, translateY, opacity]);

  if (isLoading) return null;

  const backgroundColor = isOffline ? '#ff9500' : baseColors.success;
  const textColor = '#ffffff';
  const iconName = isOffline ? 'cloud-offline-outline' : 'checkmark-circle-outline';
  const message = isOffline
    ? "You're offline — changes will sync when reconnected"
    : 'Back online';

  return (
    <Animated.View
      pointerEvents={showBanner ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing[1],
          backgroundColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={16} color={textColor} />
        <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: spacing[2],
    paddingHorizontal: spacing[4],
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
