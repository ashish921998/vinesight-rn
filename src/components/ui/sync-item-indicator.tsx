/**
 * SyncItemIndicator – Per-item sync status icon for list items / cards.
 *
 * Shows a small cloud icon with different states:
 *   • pending  – cloud-upload outline (muted)
 *   • syncing  – spinning sync icon
 *   • synced   – checkmark-circle (green, fades out)
 *   • failed   – cloud-offline (red, tappable to retry)
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type SyncItemStatus, useSyncStore, selectItemStatus } from '@/stores/sync-store';
import { useM3 } from '@/styles/use-theme';
import { colors as baseColors } from '@/styles/theme';

interface SyncItemIndicatorProps {
  /** The sync-queue item id to track. */
  itemId: string;
  /** Icon size (default 16). */
  size?: number;
  /** Called when the user taps a failed indicator to retry. */
  onRetry?: (itemId: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standalone variant that accepts a status prop directly instead of
 * reading from the store – useful for previews or external state.
 */
interface SyncItemIndicatorDirectProps {
  status: SyncItemStatus;
  size?: number;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

function IndicatorIcon({
  status,
  size = 16,
  onRetry,
  style,
}: SyncItemIndicatorDirectProps) {
  const m3 = useM3();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'syncing') {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [status, spinAnim]);

  useEffect(() => {
    if (status === 'synced') {
      fadeAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 2000,
        delay: 1000,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [status, fadeAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const iconProps = (() => {
    switch (status) {
      case 'pending':
        return {
          name: 'cloud-upload-outline' as const,
          color: m3.colorScheme.onSurfaceVariant,
        };
      case 'syncing':
        return {
          name: 'sync-outline' as const,
          color: m3.colorScheme.primary,
        };
      case 'synced':
        return {
          name: 'checkmark-circle' as const,
          color: baseColors.success,
        };
      case 'failed':
        return {
          name: 'cloud-offline' as const,
          color: baseColors.error,
        };
    }
  })();

  const icon = (
    <Animated.View
      style={[
        style,
        status === 'syncing' && { transform: [{ rotate: spin }] },
        status === 'synced' && { opacity: fadeAnim },
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Sync status: ${status}`}
    >
      <Ionicons name={iconProps.name} size={size} color={iconProps.color} />
    </Animated.View>
  );

  if (status === 'failed' && onRetry) {
    return (
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Retry sync"
      >
        {icon}
      </Pressable>
    );
  }

  return icon;
}

/**
 * Store-connected variant – reads status from the sync store by item id.
 */
export function SyncItemIndicator({
  itemId,
  size = 16,
  onRetry,
  style,
}: SyncItemIndicatorProps) {
  const status = useSyncStore(selectItemStatus(itemId));

  if (!status) return null;

  return (
    <IndicatorIcon
      status={status}
      size={size}
      onRetry={onRetry ? () => onRetry(itemId) : undefined}
      style={style}
    />
  );
}

/**
 * Direct variant – pass status as a prop.
 */
SyncItemIndicator.Direct = IndicatorIcon;
