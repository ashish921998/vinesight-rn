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
  color = '#22C55E',
  iconColor,
  subtitle,
  onPress,
}: StatsCardProps) {
  const finalColor = iconColor || color;
  const content = (
    <View className="bg-white rounded-xl p-4 border border-gray-100">
      <View className="flex-row items-center justify-between">
        <View 
          className="w-10 h-10 rounded-lg items-center justify-center"
          style={{ backgroundColor: `${finalColor}15` }}
        >
          <Ionicons name={icon} size={20} color={finalColor} />
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold text-gray-900">{value}</Text>
          {subtitle && (
            <Text className="text-xs text-gray-500">{subtitle}</Text>
          )}
        </View>
      </View>
      <Text className="text-sm text-gray-500 mt-3">{title}</Text>
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
