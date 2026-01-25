import React from 'react';
import { View, Text, type NativeSyntheticEvent, type TextInputFocusEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NumericInput } from './FormField';

export interface IrrigationFormData {
  duration: number;
  notes?: string;
}

interface IrrigationFormProps {
  data: IrrigationFormData;
  onChange: (data: IrrigationFormData) => void;
  farmArea?: number;
  systemDischarge?: number;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function IrrigationForm({
  data,
  onChange,
  farmArea,
  systemDischarge,
  onInputFocus,
}: IrrigationFormProps) {
  const isValid = data.duration > 0;

  // Calculate estimated water applied
  const estimatedWater =
    systemDischarge && data.duration > 0 ? (data.duration * systemDischarge).toFixed(1) : null;

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
          <Ionicons name="water" size={20} color="#3B82F6" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">Irrigation</Text>
          <Text className="text-sm text-surface-500">Log irrigation duration</Text>
        </View>
      </View>

      {/* Duration Input */}
      <NumericInput
        label="Duration"
        icon="time-outline"
        iconColor="#3B82F6"
        placeholder="Enter duration"
        value={data.duration}
        onValueChange={(duration) => onChange({ ...data, duration })}
        unit="hours"
        required
        decimals={1}
        hint="How long was the irrigation cycle?"
        onFocus={onInputFocus}
      />

      {/* Info cards */}
      {(farmArea || estimatedWater) && (
        <View className="flex-row flex-wrap gap-3 mt-2">
          {farmArea && (
            <View className="flex-1 min-w-[140px] bg-surface-50 rounded-xl p-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="resize-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-surface-500 ml-1">Area</Text>
              </View>
              <Text className="text-sm font-semibold text-surface-900">
                {farmArea.toFixed(2)} acres
              </Text>
            </View>
          )}

          {estimatedWater && (
            <View className="flex-1 min-w-[140px] bg-blue-50 rounded-xl p-3">
              <View className="flex-row items-center mb-1">
                <Ionicons name="water-outline" size={14} color="#3B82F6" />
                <Text className="text-xs text-blue-600 ml-1">Est. Water</Text>
              </View>
              <Text className="text-sm font-semibold text-blue-700">{estimatedWater} mm</Text>
            </View>
          )}
        </View>
      )}

      {/* Validation indicator */}
      <View className="flex-row items-center mt-4 pt-4 border-t border-surface-100">
        <Ionicons
          name={isValid ? 'checkmark-circle' : 'alert-circle-outline'}
          size={16}
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text className={`text-sm ml-2 ${isValid ? 'text-green-600' : 'text-surface-500'}`}>
          {isValid ? 'Ready to add' : 'Enter duration to continue'}
        </Text>
      </View>
    </View>
  );
}

export function validateIrrigationForm(data: IrrigationFormData): boolean {
  return data.duration > 0;
}
