/**
 * QuickActionButton Component
 * Circular icon button with label for dashboard quick actions
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface QuickActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function QuickActionButton({ title, icon, color, onPress }: QuickActionButtonProps) {
  const buildTranslucentColor = (input: string, alpha = 0.1) => {
    const normalized = input.trim();
    const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(normalized);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((c) => `${c}${c}`)
          .join('');
      }
      if (hex.length === 8) {
        hex = hex.slice(0, 6);
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }

    const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(normalized);
    if (rgbMatch) {
      const parts = rgbMatch[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        const r = Number(parts[0]);
        const g = Number(parts[1]);
        const b = Number(parts[2]);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      }
    }

    return `rgba(0, 0, 0, ${alpha})`;
  };
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
    backgroundColor: buildTranslucentColor(color, 0.1),
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
        <IconSymbol name={icon} size={20} color={color} />
      </View>
      <Text style={textStyle} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}
