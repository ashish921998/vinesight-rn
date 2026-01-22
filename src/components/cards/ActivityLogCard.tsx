/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLogType, type LogTypeId } from '../../constants';
import { fromSupabaseDateString } from '../../types';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '../../types';

type RecordData =
  | IrrigationRecord
  | SprayRecord
  | HarvestRecord
  | ExpenseRecord
  | FertigationRecord;

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
    case 'irrigation': {
      const irrigation = data as IrrigationRecord;
      return `${irrigation.duration?.toFixed(1) || 0}h duration`;
    }
    case 'spray': {
      const spray = data as SprayRecord;
      return spray.chemical || 'Spray application';
    }
    case 'harvest': {
      const harvest = data as HarvestRecord;
      return `${harvest.quantity?.toFixed(1) || 0}kg - ${harvest.grade || 'N/A'}`;
    }
    case 'expense': {
      const expense = data as ExpenseRecord;
      return `₹${expense.cost?.toLocaleString() || 0} - ${expense.type || 'General'}`;
    }
    case 'fertigation': {
      const fertigation = data as FertigationRecord;
      const fertCount = fertigation.fertilizers?.length || 0;
      return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''} applied`;
    }
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
    <View
      className="flex-row items-center rounded-xl px-3 py-2"
      style={{
        backgroundColor: '#ffffff',
      }}
    >
      {/* Icon */}
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: `${logType.color}26` }}
      >
        <Ionicons
          name={logType.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={logType.color}
        />
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-sm font-semibold" style={{ color: '#000000' }} numberOfLines={1}>
          {displayDescription || logType.label}
        </Text>
        <View className="flex-row items-center mt-1">
          {farmName && (
            <>
              <Text className="text-xs" style={{ color: '#8e8e93' }}>
                {farmName}
              </Text>
              <Text className="text-xs mx-1" style={{ color: '#c7c7cc' }}>
                •
              </Text>
            </>
          )}
          <Text className="text-xs" style={{ color: '#c7c7cc' }}>
            {displayDate}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={16} color="#c7c7cc" />
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
