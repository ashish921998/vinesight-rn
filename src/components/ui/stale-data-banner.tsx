/**
 * StaleDataBanner – Shows when displayed data was last refreshed.
 *
 * Renders a subtle "Last updated X minutes ago" bar at the top of a
 * cached screen. Automatically updates the relative time label.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useM3 } from '@/styles/use-theme';
import { fontSize, fontWeight, spacing } from '@/styles/theme';

interface StaleDataBannerProps {
  /** ISO timestamp (or Date) of when the data was last fetched. */
  lastUpdated: string | Date | null | undefined;
  /** Hide the banner when data is fresher than this (ms). Default 60 000 (1 min). */
  freshThreshold?: number;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function StaleDataBanner({
  lastUpdated,
  freshThreshold = 60_000,
}: StaleDataBannerProps) {
  const m3 = useM3();
  const [, setTick] = useState(0);

  // Re-render every 30 s so the relative label stays current.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!lastUpdated) return null;

  const date = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  if (isNaN(date.getTime())) return null;

  const age = Date.now() - date.getTime();
  if (age < freshThreshold) return null;

  const relativeLabel = formatRelativeTime(date);

  return (
    <View
      style={[styles.container, { backgroundColor: m3.surface.surfaceContainerLow }]}
      accessibilityRole="status"
      accessibilityLabel={`Data last updated ${relativeLabel}`}
    >
      <Ionicons
        name="time-outline"
        size={14}
        color={m3.colorScheme.onSurfaceVariant}
      />
      <Text style={[styles.text, { color: m3.colorScheme.onSurfaceVariant }]}>
        Last updated {relativeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    gap: spacing[1],
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
  },
});
