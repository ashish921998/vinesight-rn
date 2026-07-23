import React from 'react';
import { View, Text } from 'react-native';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

/**
 * Standard header for every bottom sheet. Presentational only — sheets are
 * dismissed via the native grabber + drag-down, so there is no close button.
 *
 * Title: fontSize.lg / bold / onSurface, left-aligned, a11y header.
 * Optional subtitle in onSurfaceVariant; optional leading node (icon tile etc.).
 */
export function SheetHeader({
  title,
  subtitle,
  leading,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
}) {
  const m3 = useM3();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingHorizontal: spacing[5],
        // Compact, like the farm-details add-log modal header — the native
        // grabber already sits above, so a tall top pad just wasted space.
        paddingTop: spacing[3],
        paddingBottom: spacing[2],
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
