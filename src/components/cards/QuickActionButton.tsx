/**
 * QuickActionButton Component
 * Circular icon button with label for dashboard quick actions
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface QuickActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function QuickActionButton({ title, icon, color, onPress }: QuickActionButtonProps) {
  const containerStyle: ViewStyle = {
    alignItems: 'center',
  };

  const iconContainerStyle: ViewStyle = {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    backgroundColor: `${color}1A`,
  };

  const textStyle: TextStyle = {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    color: '#000000',
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [containerStyle, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={iconContainerStyle}>
        <Symbol name={icon} size={20} color={color} />
      </View>
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}
