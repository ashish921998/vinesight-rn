/**
 * QuickActionButton Component
 * Circular icon button with label for dashboard quick actions
 * Cellar Ledger design: 44x44 icon container with tinted bg
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontWeight, fontSize } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useThemeColors } from '@/styles/use-theme';

interface QuickActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function QuickActionButton({ title, icon, color, onPress }: QuickActionButtonProps) {
  const colors = useThemeColors();

  const containerStyle: ViewStyle = {
    alignItems: 'center',
    minWidth: 68,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.sm, // 12px
    overflow: 'hidden',
  };

  // Cellar Ledger: Icon container 44x44, borderRadius 12, 12% opacity category-tinted bg
  const iconContainerStyle: ViewStyle = {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm, // 12px
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    backgroundColor: colorWithOpacity(color, 0.12),
  };

  // Cellar Ledger: Label 12px/500, bark color
  const textStyle: TextStyle = {
    fontSize: fontSize.xs, // 12px
    fontWeight: fontWeight.medium, // 500
    textAlign: 'center',
    color: colors.surface[500], // bark
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
                  ? colorWithOpacity(colors.surface[900], 0.12)
                  : 'transparent',
              },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}
