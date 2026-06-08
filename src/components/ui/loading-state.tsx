/**
 * LoadingState — shared interaction-state component for loading screens.
 *
 * A centered column with an ActivityIndicator tinted with the M3 primary role
 * and an optional muted label below it.
 */

import React from 'react';
import { View, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import { fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

interface LoadingStateProps {
  /** Optional muted label shown beneath the spinner. */
  label?: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  const m3 = useM3();

  return (
    <View style={containerStyle}>
      <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      {label ? (
        <Text
          style={{
            fontSize: fontSize.base,
            marginTop: spacing[4],
            color: m3.colorScheme.onSurfaceVariant,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const containerStyle: ViewStyle = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  padding: spacing[8],
};
