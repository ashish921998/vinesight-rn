/**
 * StatsCard Component
 * Displays a single stat with icon, value, and title
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color?: string;
  iconColor?: string;
  subtitle?: string;
  onPress?: () => void;
}

export function StatsCard({
  title,
  value,
  icon,
  color = '#408059',
  iconColor,
  onPress,
}: StatsCardProps) {
  const finalColor = iconColor || color;

  const containerStyle: ViewStyle = {
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    backgroundColor: colors.surface[100],
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const valueTextStyle: TextStyle = {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#000000',
  };

  const titleTextStyle: TextStyle = {
    fontSize: fontSize.xs,
    marginTop: spacing[3],
    color: colors.surface[500],
  };

  const content = (
    <View style={containerStyle}>
      <View style={headerStyle}>
        <Symbol name={icon} size={20} color={finalColor} weight="semibold" />
        <Text style={valueTextStyle}>{value}</Text>
      </View>
      <Text style={titleTextStyle}>{title}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
}
