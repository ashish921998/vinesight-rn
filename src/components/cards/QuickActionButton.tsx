/**
 * QuickActionButton Component
 * Circular icon button with label for dashboard quick actions
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';

interface QuickActionButtonProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export function QuickActionButton({ title, icon, color, onPress }: QuickActionButtonProps) {
  return (
    <Pressable onPress={onPress} className="items-center active:opacity-70">
      <View
        className="w-12 h-12 rounded-full items-center justify-center mb-2"
        style={{ backgroundColor: `${color}1A` }}
      >
        <Symbol name={icon} size={20} color={color} />
      </View>
      <Text className="text-xs font-medium text-center" style={{ color: '#000000' }}>
        {title}
      </Text>
    </Pressable>
  );
}
