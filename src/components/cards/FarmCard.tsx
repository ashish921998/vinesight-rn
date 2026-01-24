/**
 * FarmCard Component
 * Card showing farm info with status, water balance, region
 */

import React from 'react';
import { View, Text, Pressable, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';

interface FarmCardProps {
  farm: Farm;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FarmCard({ farm, onPress, onEdit, onDelete }: FarmCardProps) {
  const needsAttention = isLowWater(farm);
  const statusText = needsAttention ? 'NEEDS ATTENTION' : 'HEALTHY';
  const statusColor = needsAttention ? '#ff3b30' : '#408059';
  const statusBg = needsAttention ? 'rgba(255, 59, 48, 0.1)' : 'rgba(64, 128, 89, 0.1)';

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl p-4 active:opacity-90"
      style={{
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header: Name & Status */}
      <View className="flex-row items-start justify-between mb-3">
        <Text className="text-lg font-medium flex-1 mr-2" style={{ color: '#000000' }}>
          {farm.name}
        </Text>
        <View className="flex-row items-center gap-2">
          {onEdit && (
            <TouchableOpacity
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
              style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={18} color="#408059" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={(e: GestureResponderEvent) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
              style={{ backgroundColor: 'rgba(255, 59, 48, 0.1)' }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#ff3b30" />
            </TouchableOpacity>
          )}
          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusBg }}>
            <Text className="text-xs font-bold uppercase" style={{ color: statusColor }}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>

      {/* Subheader: Variety & Area */}
      <View className="flex-row items-center justify-between mb-4">
        {farm.crop_variety ? (
          <View
            className="px-2 py-1 rounded-md"
            style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
          >
            <Text className="text-xs font-bold uppercase" style={{ color: '#408059' }}>
              {farm.crop_variety}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text className="text-sm" style={{ color: '#8e8e93' }}>
          {farm.area.toFixed(1)} Acres
        </Text>
      </View>

      {/* Data Grid */}
      <View className="flex-row gap-3">
        {/* Water Balance Box */}
        <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#f2f2f7' }}>
          <View className="flex-row items-center gap-2">
            <View className="w-3 h-3 rounded-full" style={{ backgroundColor: '#669475' }} />
            <View>
              <Text className="text-[10px] font-bold uppercase" style={{ color: '#8e8e93' }}>
                WATER BALANCE
              </Text>
              <Text className="text-base font-semibold" style={{ color: '#000000' }}>
                {farm.remaining_water != null ? `${farm.remaining_water.toFixed(1)} mm` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Region Box */}
        <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#f2f2f7' }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="location" size={12} color="#8e8e93" />
            <View>
              <Text className="text-[10px] font-bold uppercase" style={{ color: '#8e8e93' }}>
                REGION
              </Text>
              <Text className="text-sm font-medium" numberOfLines={1} style={{ color: '#000000' }}>
                {farm.region || 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
