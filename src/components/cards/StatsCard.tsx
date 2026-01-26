/**
 * StatsCard Component
 * Displays a single stat with icon, value, and title
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';

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
  const content = (
    <View
      className="rounded-xl p-4"
      style={{
        backgroundColor: '#ffffff',
      }}
    >
      <View className="flex-row items-center justify-between">
        <Symbol name={icon} size={20} color={finalColor} weight="semibold" />
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
