/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import type { IrrigationRecord, SprayRecord, HarvestRecord, ExpenseRecord, FertigationRecord } from '../../types';

type RecordData = IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;

interface ActivityLogCardProps {
  type: LogTypeId;
  date: string;
  description?: string;
  data?: RecordData;
  farmName?: string;
  onPress?: () => void;
}

// Generate description from record data
function getDescriptionFromData(type: LogTypeId, data?: RecordData): string {
  if (!data) return '';
  
  switch (type) {
    case 'irrigation':
      const irrigation = data as IrrigationRecord;
      return `${irrigation.duration?.toFixed(1) || 0}h duration`;
    case 'spray':
      const spray = data as SprayRecord;
      return spray.chemical || 'Spray application';
    case 'harvest':
      const harvest = data as HarvestRecord;
      return `${harvest.quantity?.toFixed(1) || 0}kg - ${harvest.grade || 'N/A'}`;
    case 'expense':
      const expense = data as ExpenseRecord;
      return `₹${expense.cost?.toLocaleString() || 0} - ${expense.type || 'General'}`;
    case 'fertigation':
      const fertigation = data as FertigationRecord;
      const fertCount = fertigation.fertilizers?.length || 0;
      return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''} applied`;
    default:
      return '';
  }
}

export function ActivityLogCard({
  type,
  date,
  description,
  data,
  farmName,
  onPress,
}: ActivityLogCardProps) {
  const logType = getLogType(type);
  const parsedDate = fromSupabaseDateString(date);
  const displayDescription = description || getDescriptionFromData(type, data);
  const displayDate = parsedDate
    ? parsedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : date;

  const content = (
    <View className="flex-row items-center bg-primary/5 rounded-xl px-3 py-3">
      {/* Icon */}
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: `${logType.color}15` }}
      >
        <Ionicons
          name={logType.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={logType.color}
        />
      </View>

      {/* Content */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-gray-900">
            {logType.label}
          </Text>
          <Text className="text-xs text-gray-500">{displayDate}</Text>
        </View>
        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
          {displayDescription}
        </Text>
        {farmName && (
          <Text className="text-xs text-primary mt-0.5">{farmName}</Text>
        )}
      </View>
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
