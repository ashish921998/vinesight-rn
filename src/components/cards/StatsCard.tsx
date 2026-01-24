/**
 * StatsCard Component
 * Displays a single stat with icon, value, and title
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatsCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
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
  const content = (
    <View
      className="rounded-xl p-4"
      style={{
        backgroundColor: '#ffffff',
      }}
    >
      <View className="flex-row items-center justify-between">
        <Ionicons name={icon} size={20} color={finalColor} style={{ opacity: 1 }} />
        <Text className="text-2xl font-bold" style={{ color: '#000000' }}>
          {value}
        </Text>
      </View>
      <Text className="text-xs mt-3" style={{ color: '#8e8e93' }}>
        {title}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="active:opacity-80">
        {content}
      </Pressable>
    );
  }

  return content;
}
