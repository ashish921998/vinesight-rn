/**
 * PendingSyncBadge
 *
 * Displays a small badge showing the number of unsynced offline changes
 * waiting in the PowerSync upload queue. Hidden when count is 0.
 *
 * Phase 3: Offline Writes & Conflict Resolution
 */

import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { usePendingSyncCount } from '@/hooks/use-pending-sync';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, borderRadius, spacing } from '@/styles/theme';

interface PendingSyncBadgeProps {
  /** Optional style override for the container */
  style?: ViewStyle;
}

/**
 * A compact badge that shows the number of pending offline writes.
 * Renders nothing when there are no pending changes.
 *
 * Usage:
 * ```tsx
 * <PendingSyncBadge />
 * <PendingSyncBadge style={{ position: 'absolute', top: 8, right: 8 }} />
 * ```
 */
export function PendingSyncBadge({ style }: PendingSyncBadgeProps) {
  const count = usePendingSyncCount();
  const m3 = useM3();

  if (count === 0) return null;

  const label = count > 99 ? '99+' : String(count);

  return (
    <View
      style={[
        {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
          borderRadius: borderRadius.full,
          gap: 4,
          backgroundColor: m3.colorScheme.tertiaryContainer,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${count} change${count === 1 ? '' : 's'} pending sync`}
    >
      <Text
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.bold,
          color: m3.colorScheme.onTertiaryContainer,
        }}
      >
        ↑
      </Text>
      <Text
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onTertiaryContainer,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
