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
import { EXPENSE_TYPES, type ExpenseTypeId } from '../../constants/calculatorModels';

export interface ExpenseFormData {
  type: ExpenseTypeId | '';
  cost: number;
  remarks?: string;
  notes?: string;
}

interface ExpenseFormProps {
  data: ExpenseFormData;
  onChange: (data: ExpenseFormData) => void;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

// Icon mapping for expense types
const EXPENSE_ICONS: Record<ExpenseTypeId, string> = {
  Equipment: 'wrench.and.screwdriver',
  Fuel: 'car',
  'Seeds/Plants': 'leaf',
  Packaging: 'cube',
  Transport: 'bus',
  Maintenance: 'hammer',
  Other: 'ellipsis',
};

export function ExpenseForm({ data, onChange, onInputFocus }: ExpenseFormProps) {
  const isValid = data.cost > 0 && data.type !== '';

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-3">
          <Symbol name="dollarsign.circle.fill" size={20} color="#EF4444" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">Expense</Text>
          <Text className="text-sm text-surface-500">Log farm expense</Text>
        </View>
      </View>

      {/* Category Selection */}
      <View className="mb-4">
        <View className="flex-row items-center mb-2">
          <View style={{ marginRight: 6 }}>
            <Symbol name="list.bullet" size={16} color="#408059" />
          </View>
          <Text className="text-sm font-semibold text-surface-800">
            Category <Text className="text-red-500">*</Text>
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {EXPENSE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => onChange({ ...data, type })}
              className={`flex-row items-center px-3 py-2.5 rounded-xl border ${
                data.type === type ? 'bg-red-500 border-red-500' : 'bg-white border-surface-200'
              }`}
              activeOpacity={0.7}
            >
              <Symbol
                name={EXPENSE_ICONS[type]}
                size={16}
                color={data.type === type ? '#FFFFFF' : '#6B7280'}
                style={{ marginRight: 6 }}
              />
              <Text
                className={`text-sm font-medium ${
                  data.type === type ? 'text-white' : 'text-surface-700'
                }`}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Amount Input */}
      <NumericInput
        label="Amount"
        icon="cash-outline"
        iconColor="#EF4444"
        placeholder="Enter amount"
        value={data.cost}
        onValueChange={(cost) => onChange({ ...data, cost })}
        unit="₹"
        required
        decimals={0}
        hint="Total expense amount"
        onFocus={onInputFocus}
      />

      {/* Remarks Input (Optional) */}
      <View className="mb-4">
        <View className="flex-row items-center mb-1.5">
          <View style={{ marginRight: 6 }}>
            <Symbol name="doc.text" size={16} color="#408059" />
          </View>
          <Text className="text-sm font-semibold text-surface-800">Remarks</Text>
        </View>

        <View className="px-4 py-3 rounded-xl border border-surface-200 bg-white">
          <TextInput
            className="text-base text-surface-900"
            placeholder="Add notes about this expense (optional)"
            placeholderTextColor="#9CA3AF"
            value={data.remarks || ''}
            onChangeText={(remarks) => onChange({ ...data, remarks: remarks || undefined })}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            onFocus={onInputFocus}
          />
        </View>
        <Text className="text-xs text-surface-500 mt-1">Optional - describe the expense</Text>
      </View>

      {/* Summary */}
      {data.type && data.cost > 0 && (
        <View className="bg-red-50 rounded-xl p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Symbol
                name={data.type ? EXPENSE_ICONS[data.type] : 'dollarsign.circle.fill'}
                size={20}
                color="#DC2626"
              />
              <Text className="text-sm font-medium text-red-700 ml-2">{data.type}</Text>
            </View>
            <Text className="text-lg font-bold text-red-700">₹{data.cost.toLocaleString()}</Text>
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
          {isValid ? 'Ready to add' : 'Select category and enter amount'}
        </Text>
      </View>
    </View>
  );
}

export function validateExpenseForm(data: ExpenseFormData): boolean {
  return data.cost > 0 && data.type !== '';
}

// Create empty expense form data
export function createEmptyExpenseFormData(): ExpenseFormData {
  return {
    type: '',
    cost: 0,
  };
}
