/**
 * WorkerCard Component
 * Displays a single worker with avatar, rate, and advance balance
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Worker } from '../../types';

interface WorkerCardProps {
  worker: Worker;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkerCard({ worker, onPress, onEdit, onDelete }: WorkerCardProps) {
  const initial = worker.name.charAt(0).toUpperCase();
  const formattedRate = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(worker.daily_rate);
  const formattedAdvance = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(worker.advance_balance);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 active:opacity-80"
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-3">
        <Text className="text-lg font-semibold text-primary">{initial}</Text>
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">{worker.name}</Text>
        <View className="flex-row items-center mt-1">
          <Ionicons name="cash-outline" size={12} color="#6B7280" />
          <Text className="text-sm text-gray-500 ml-1">
            {formattedRate}
            <Text className="text-xs text-gray-400"> /day</Text>
          </Text>
        </View>
      </View>

      {/* Advance Balance (if any) */}
      {worker.advance_balance > 0 && (
        <View className="flex-row items-center">
          <Ionicons name="arrow-up-circle" size={12} color="#F59E0B" />
          <Text className="text-sm font-semibold text-amber-500 ml-1">{formattedAdvance}</Text>
        </View>
      )}

      {/* Actions */}
      {(onEdit || onDelete) && (
        <View className="flex-row items-center ml-3 gap-2">
          {onEdit && (
            <Pressable onPress={onEdit} className="p-2">
              <Ionicons name="pencil" size={18} color="#3B82F6" />
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} className="p-2">
              <Ionicons name="trash" size={18} color="#EF4444" />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}
