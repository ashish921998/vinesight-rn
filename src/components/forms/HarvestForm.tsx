import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { NumericInput } from './FormField';
import { HARVEST_GRADES, type HarvestGrade } from '../../constants/calculatorModels';

export interface HarvestFormData {
  quantity: number;
  grade: HarvestGrade | '';
  price?: number;
  buyer?: string;
  notes?: string;
}

interface HarvestFormProps {
  data: HarvestFormData;
  onChange: (data: HarvestFormData) => void;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function HarvestForm({ data, onChange, onInputFocus }: HarvestFormProps) {
  const isValid = data.quantity > 0 && data.grade !== '';

  // Calculate total value if price is set
  const totalValue =
    data.price && data.quantity > 0 ? (data.quantity * data.price).toFixed(0) : null;

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
          <Symbol name="basket.fill" size={20} color="#F59E0B" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">Harvest</Text>
          <Text className="text-sm text-surface-500">Log harvest quantity and details</Text>
        </View>
      </View>

      {/* Quantity Input */}
      <NumericInput
        label="Quantity"
        icon="scale-outline"
        iconColor="#F59E0B"
        placeholder="Enter quantity"
        value={data.quantity}
        onValueChange={(quantity) => onChange({ ...data, quantity })}
        unit="kg"
        required
        decimals={1}
        hint="Total harvested weight"
        onFocus={onInputFocus}
      />

      {/* Grade Selection */}
      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          <View style={{ marginRight: 6 }}>
            <Symbol name="star" size={16} color="#408059" />
          </View>
          <Text className="text-sm font-semibold text-surface-800">
            Grade <Text className="text-red-500">*</Text>
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {HARVEST_GRADES.map((grade) => (
            <TouchableOpacity
              key={grade}
              onPress={() => onChange({ ...data, grade })}
              className={`px-4 py-2.5 rounded-xl border ${
                data.grade === grade
                  ? 'bg-amber-500 border-amber-500'
                  : 'bg-white border-surface-200'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  data.grade === grade ? 'text-white' : 'text-surface-700'
                }`}
              >
                {grade}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Price Input (Optional) */}
      <NumericInput
        label="Price per kg"
        icon="cash-outline"
        iconColor="#22C55E"
        placeholder="Enter price"
        value={data.price || 0}
        onValueChange={(price) => onChange({ ...data, price: price || undefined })}
        unit="₹"
        decimals={0}
        hint="Optional - price per kilogram"
        onFocus={onInputFocus}
      />

      {/* Buyer Input (Optional) */}
      <View className="mb-4">
        <View className="flex-row items-center mb-1.5">
          <View style={{ marginRight: 6 }}>
            <Symbol name="person" size={16} color="#408059" />
          </View>
          <Text className="text-sm font-semibold text-surface-800">Buyer</Text>
        </View>

        <View className="flex-row items-center px-4 py-3 rounded-xl border border-surface-200 bg-white">
          <View style={{ marginRight: 10 }}>
            <Symbol name="person" size={20} color="#6B7280" />
          </View>
          <TextInput
            className="flex-1 text-base text-surface-900"
            placeholder="Enter buyer name (optional)"
            placeholderTextColor="#9CA3AF"
            value={data.buyer || ''}
            onChangeText={(buyer) => onChange({ ...data, buyer: buyer || undefined })}
            onFocus={onInputFocus}
          />
        </View>
        <Text className="text-xs text-surface-500 mt-1">Optional - who bought the harvest</Text>
      </View>

      {/* Summary Card */}
      {(totalValue || data.grade) && (
        <View className="bg-amber-50 rounded-xl p-4 mb-4">
          <Text className="text-sm font-semibold text-amber-700 mb-2">Summary</Text>
          <View className="flex-row flex-wrap gap-4">
            {data.quantity > 0 && (
              <View>
                <Text className="text-xs text-amber-600">Quantity</Text>
                <Text className="text-base font-semibold text-amber-800">
                  {data.quantity.toFixed(1)} kg
                </Text>
              </View>
            )}
            {data.grade && (
              <View>
                <Text className="text-xs text-amber-600">Grade</Text>
                <Text className="text-base font-semibold text-amber-800">{data.grade}</Text>
              </View>
            )}
            {totalValue && (
              <View>
                <Text className="text-xs text-amber-600">Total Value</Text>
                <Text className="text-base font-semibold text-amber-800">₹{totalValue}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Validation indicator */}
      <View className="flex-row items-center pt-4 border-t border-surface-100">
        <Symbol
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
          size={16}
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text className={`text-sm ml-2 ${isValid ? 'text-green-600' : 'text-surface-500'}`}>
          {isValid ? 'Ready to add' : 'Enter quantity and select grade'}
        </Text>
      </View>
    </View>
  );
}

export function validateHarvestForm(data: HarvestFormData): boolean {
  return data.quantity > 0 && data.grade !== '';
}

// Create empty harvest form data
export function createEmptyHarvestFormData(): HarvestFormData {
  return {
    quantity: 0,
    grade: '',
  };
}
