import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { Host, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { fontSize, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label }: LoadingStateProps) {
  const m3 = useM3();

  return (
    <View style={containerStyle}>
      <Host matchContents>
        <LoadingIndicator color={m3.colorScheme.primary} />
      </Host>
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
