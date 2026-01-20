/**
 * FarmCard Component
 * Card showing farm info with status, water balance, region
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Farm } from '../../types';
import { isLowWater } from '../../types';

interface FarmCardProps {
  farm: Farm;
  onPress?: () => void;
}

export function FarmCard({ farm, onPress }: FarmCardProps) {
  const needsAttention = isLowWater(farm);
  const statusText = needsAttention ? 'NEEDS ATTENTION' : 'HEALTHY';
  const statusColor = needsAttention ? 'text-red-500' : 'text-purple-500';
  const statusBg = needsAttention ? 'bg-red-50' : 'bg-purple-50';

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-3xl p-5 border border-gray-100 active:opacity-90"
    >
      {/* Header: Name & Status */}
      <View className="flex-row items-start justify-between mb-4">
        <Text className="text-xl font-medium text-gray-900 flex-1 mr-2">
          {farm.name}
        </Text>
        <View className={`${statusBg} px-2 py-1 rounded-full`}>
          <Text className={`text-xs font-bold ${statusColor}`}>
            {statusText}
          </Text>
        </View>
      </View>

      {/* Subheader: Variety & Area */}
      <View className="flex-row items-center justify-between mb-4">
        {farm.crop_variety ? (
          <View className="bg-primary/10 px-2 py-1 rounded-md">
            <Text className="text-xs font-bold text-primary uppercase">
              {farm.crop_variety}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Text className="text-sm text-gray-500">
          {farm.area.toFixed(1)} Acres
        </Text>
      </View>

      {/* Data Grid */}
      <View className="flex-row gap-3">
        {/* Water Balance Box */}
        <View className="flex-1 bg-gray-100 rounded-xl p-3">
          <View className="flex-row items-center gap-2">
            <View className="w-3 h-3 rounded-full bg-amber-700" />
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase">
                WATER BALANCE
              </Text>
              <Text className="text-base font-semibold text-gray-900">
                {farm.remaining_water != null
                  ? `${farm.remaining_water.toFixed(1)} mm`
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Region Box */}
        <View className="flex-1 bg-gray-100 rounded-xl p-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location" size={12} color="#6B7280" />
            <View>
              <Text className="text-[10px] font-bold text-gray-500 uppercase">
                REGION
              </Text>
              <Text
                className="text-sm font-medium text-gray-900"
                numberOfLines={1}
              >
                {farm.region || 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
