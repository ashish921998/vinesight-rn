/**
 * QuickActionButton Component
 * Circular icon button with label for dashboard quick actions
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface QuickActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function QuickActionButton({ title, icon, color, onPress }: QuickActionButtonProps) {
  const m3 = useM3();
  const containerStyle: ViewStyle = {
    alignItems: 'center',
    minWidth: 72,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: m3.shape.cornerMedium,
    overflow: 'hidden',
  };

  const iconContainerStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    backgroundColor: colorWithOpacity(color, 0.12),
  };

  const textStyle: TextStyle = {
    ...m3.typography.labelSmall,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    color: m3.colorScheme.onSurface,
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {({ pressed }) => (
        <View style={containerStyle}>
          <View style={iconContainerStyle}>
            <IconSymbol name={icon} size={20} color={color} />
          </View>
          <Text style={textStyle} numberOfLines={2}>
            {title}
          </Text>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: pressed
                  ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                  : 'transparent',
              },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}
