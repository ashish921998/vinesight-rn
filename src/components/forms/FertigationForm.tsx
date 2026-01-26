import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { UnitPickerModal } from '../ui/UnitPickerModal';
import { FERTILIZER_UNITS, type FertilizerUnit } from '../../constants/calculatorModels';

export interface FertilizerEntry {
  name: string;
  quantity: number;
  unit: FertilizerUnit;
}

export interface FertigationFormData {
  fertilizers: FertilizerEntry[];
  notes?: string;
}

interface FertigationFormProps {
  data: FertigationFormData;
  onChange: (data: FertigationFormData) => void;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function FertigationForm({ data, onChange, onInputFocus }: FertigationFormProps) {
  const isValid =
    data.fertilizers.length > 0 && data.fertilizers.every((f) => f.name.trim() && f.quantity > 0);

  const addFertilizer = () => {
    if (data.fertilizers.length < 10) {
      onChange({
        ...data,
        fertilizers: [...data.fertilizers, { name: '', quantity: 0, unit: 'kg/acre' }],
      });
    }
  };

  const updateFertilizer = (index: number, updates: Partial<FertilizerEntry>) => {
    const newFertilizers = [...data.fertilizers];
    newFertilizers[index] = { ...newFertilizers[index], ...updates };
    onChange({ ...data, fertilizers: newFertilizers });
  };

  const removeFertilizer = (index: number) => {
    const newFertilizers = data.fertilizers.filter((_, i) => i !== index);
    onChange({ ...data, fertilizers: newFertilizers });
  };

  // Calculate total inputs count
  const totalInputs = data.fertilizers.filter((f) => f.name.trim() && f.quantity > 0).length;

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
          <Symbol name="leaf.fill" size={20} color="#22C55E" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">Fertigation</Text>
          <Text className="text-sm text-surface-500">Log fertilizer application</Text>
        </View>
      </View>

      {/* Fertilizers Section */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View style={{ marginRight: 6 }}>
              <Symbol name="flask" size={16} color="#408059" />
            </View>
            <Text className="text-sm font-semibold text-surface-800">
              Fertilizers <Text className="text-red-500">*</Text>
            </Text>
          </View>
          {totalInputs > 0 && (
            <View className="bg-green-100 px-2.5 py-1 rounded-full">
              <Text className="text-xs font-medium text-green-700">
                {totalInputs} input{totalInputs !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Fertilizers List */}
        {data.fertilizers.map((fertilizer, index) => (
          <FertilizerRow
            key={`${fertilizer.name}-${fertilizer.quantity}-${fertilizer.unit}`}
            fertilizer={fertilizer}
            onUpdate={(updates) => updateFertilizer(index, updates)}
            onRemove={() => removeFertilizer(index)}
            showRemove={data.fertilizers.length > 1}
            onInputFocus={onInputFocus}
          />
        ))}

        {/* Add Fertilizer Button */}
        {data.fertilizers.length < 10 && (
          <TouchableOpacity
            onPress={addFertilizer}
            className="flex-row items-center py-3 mt-2"
            activeOpacity={0.7}
          >
            <Symbol name="plus.circle.fill" size={20} color="#22C55E" />
            <Text className="text-sm font-medium text-green-600 ml-2">Add Fertilizer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary */}
      {totalInputs > 0 && (
        <View className="bg-green-50 rounded-xl p-4 mt-4">
          <Text className="text-sm font-semibold text-green-700 mb-2">Fertilizers Summary</Text>
          {data.fertilizers
            .filter((f) => f.name.trim() && f.quantity > 0)
            .map((f, idx) => (
              <View key={idx} className="flex-row items-center justify-between py-1">
                <Text className="text-sm text-green-800">{f.name}</Text>
                <Text className="text-sm font-medium text-green-700">
                  {f.quantity} {f.unit}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Validation indicator */}
      <View className="flex-row items-center mt-4 pt-4 border-t border-surface-100">
        <Symbol
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
          size={16}
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text className={`text-sm ml-2 ${isValid ? 'text-green-600' : 'text-surface-500'}`}>
          {isValid ? 'Ready to add' : 'Add at least one fertilizer with quantity'}
        </Text>
      </View>
    </View>
  );
}

// Fertilizer Row Component
interface FertilizerRowProps {
  fertilizer: FertilizerEntry;
  onUpdate: (updates: Partial<FertilizerEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

function FertilizerRow({
  fertilizer,
  onUpdate,
  onRemove,
  showRemove,
  onInputFocus,
}: FertilizerRowProps) {
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);
  const [quantityText, setQuantityText] = useState(
    fertilizer.quantity > 0 ? fertilizer.quantity.toString() : '',
  );

  const handleQuantityChange = (text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');
    let sanitizedText = parts[0];
    if (parts.length > 1) {
      sanitizedText += '.' + parts[1].slice(0, 2);
    }
    setQuantityText(sanitizedText);
    const qty = parseFloat(sanitizedText) || 0;
    onUpdate({ quantity: qty });
  };

  const isRowComplete = fertilizer.name.trim() && fertilizer.quantity > 0;

  return (
    <View
      className={`rounded-xl p-3 mb-3 border ${
        isRowComplete ? 'bg-green-50 border-green-200' : 'bg-surface-50 border-transparent'
      }`}
    >
      {/* Fertilizer Name Row */}
      <View className="flex-row items-center">
        <TextInput
          className={`flex-1 rounded-lg px-3 py-2.5 text-base text-surface-900 bg-white border ${
            isNameFocused ? 'border-green-400' : 'border-surface-200'
          }`}
          placeholder="Fertilizer name"
          placeholderTextColor="#9CA3AF"
          value={fertilizer.name}
          onChangeText={(name) => onUpdate({ name })}
          onFocus={(event) => {
            setIsNameFocused(true);
            onInputFocus?.(event);
          }}
          onBlur={() => setIsNameFocused(false)}
        />
        {showRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="ml-2 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Symbol name="minus.circle.fill" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quantity and Unit Row */}
      <View className="flex-row items-center mt-2">
        <TextInput
          className={`rounded-lg px-3 py-2.5 text-base text-surface-900 text-center bg-white border ${
            isQuantityFocused ? 'border-green-400' : 'border-surface-200'
          }`}
          placeholder="Qty"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          onFocus={(event) => {
            setIsQuantityFocused(true);
            onInputFocus?.(event);
          }}
          onBlur={() => setIsQuantityFocused(false)}
          style={{ flex: 1 }}
        />

        {/* Unit Picker */}
        <TouchableOpacity
          onPress={() => setShowUnitPicker(true)}
          activeOpacity={0.7}
          className="flex-row items-center justify-between bg-white rounded-lg px-3 py-2.5 ml-2 border border-surface-200"
          style={{ flex: 1 }}
        >
          <Text className="text-base text-surface-900">{fertilizer.unit}</Text>
          <Symbol name="chevron.right" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Unit Picker Modal */}
      <UnitPickerModal
        visible={showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(unit) => onUpdate({ unit })}
        selectedValue={fertilizer.unit}
        options={FERTILIZER_UNITS}
        title="Select Unit"
      />
    </View>
  );
}

export function validateFertigationForm(data: FertigationFormData): boolean {
  return (
    data.fertilizers.length > 0 && data.fertilizers.every((f) => f.name.trim() && f.quantity > 0)
  );
}

// Create empty fertigation form data
export function createEmptyFertigationFormData(): FertigationFormData {
  return {
    fertilizers: [{ name: '', quantity: 0, unit: 'kg/acre' }],
  };
}
