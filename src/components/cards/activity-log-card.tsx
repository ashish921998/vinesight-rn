/**
 * ActivityLogCard Component
 * Displays a single activity log entry (irrigation, spray, harvest, etc.)
 */

import React from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
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

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  };

  const iconContainerStyle: ViewStyle = {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: `${logType.color}26`,
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
  };

  const descriptionTextStyle: TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  };

  const metaContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  };

  const farmTextStyle: TextStyle = {
    fontSize: 12,
    color: '#8e8e93',
  };

  const separatorTextStyle: TextStyle = {
    fontSize: 12,
    marginHorizontal: 4,
    color: '#c7c7cc',
  };

  const dateTextStyle: TextStyle = {
    fontSize: 12,
    color: '#c7c7cc',
  };

  const content = (
    <View style={containerStyle}>
      {/* Icon */}
      <View style={iconContainerStyle}>
        <Symbol name={logType.icon} size={18} color={logType.color} />
      </View>

      {/* Content */}
      <View style={contentContainerStyle}>
        <Text style={descriptionTextStyle} numberOfLines={1}>
          {displayDescription || logType.label}
        </Text>
        <View style={metaContainerStyle}>
          {farmName && (
            <>
              <Text style={farmTextStyle}>{farmName}</Text>
              <Text style={separatorTextStyle}>•</Text>
            </>
          )}
          <Text style={dateTextStyle}>{displayDate}</Text>
        </View>
      </View>

      {/* Chevron */}
      <Symbol name="chevron.right" size={16} color="#c7c7cc" />
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
