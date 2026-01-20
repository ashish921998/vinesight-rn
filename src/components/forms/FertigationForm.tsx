import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

export function FertigationForm({ data, onChange }: FertigationFormProps) {
  const isValid = data.fertilizers.length > 0 && 
    data.fertilizers.every(f => f.name.trim() && f.quantity > 0);

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
  const totalInputs = data.fertilizers.filter(f => f.name.trim() && f.quantity > 0).length;

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
          <Ionicons name="leaf" size={20} color="#22C55E" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">
            Fertigation
          </Text>
          <Text className="text-sm text-surface-500">
            Log fertilizer application
          </Text>
        </View>
      </View>

      {/* Fertilizers Section */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Ionicons name="flask-outline" size={16} color="#408059" style={{ marginRight: 6 }} />
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
            key={index}
            fertilizer={fertilizer}
            onUpdate={(updates) => updateFertilizer(index, updates)}
            onRemove={() => removeFertilizer(index)}
            showRemove={data.fertilizers.length > 1}
          />
        ))}

        {/* Add Fertilizer Button */}
        {data.fertilizers.length < 10 && (
          <TouchableOpacity
            onPress={addFertilizer}
            className="flex-row items-center py-3 mt-2"
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={20} color="#22C55E" />
            <Text className="text-sm font-medium text-green-600 ml-2">
              Add Fertilizer
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary */}
      {totalInputs > 0 && (
        <View className="bg-green-50 rounded-xl p-4 mt-4">
          <Text className="text-sm font-semibold text-green-700 mb-2">
            Fertilizers Summary
          </Text>
          {data.fertilizers
            .filter(f => f.name.trim() && f.quantity > 0)
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
        <Ionicons 
          name={isValid ? "checkmark-circle" : "alert-circle-outline"} 
          size={16} 
          color={isValid ? "#22C55E" : "#9CA3AF"} 
        />
        <Text className={`text-sm ml-2 ${isValid ? 'text-green-600' : 'text-surface-500'}`}>
          {isValid 
            ? 'Ready to add' 
            : 'Add at least one fertilizer with quantity'}
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
}

function FertilizerRow({ fertilizer, onUpdate, onRemove, showRemove }: FertilizerRowProps) {
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  return (
    <View className="bg-surface-50 rounded-xl p-3 mb-3">
      {/* Fertilizer Name Row */}
      <View className="flex-row items-center mb-2">
        <TextInput
          className="flex-1 bg-white rounded-lg px-3 py-2.5 text-base text-surface-900"
          placeholder="Fertilizer name"
          placeholderTextColor="#9CA3AF"
          value={fertilizer.name}
          onChangeText={(name) => onUpdate({ name })}
        />
        {showRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="ml-2 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quantity and Unit Row */}
      <View className="flex-row items-center">
        <TextInput
          className="w-20 bg-white rounded-lg px-3 py-2.5 text-base text-surface-900"
          placeholder="Qty"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={fertilizer.quantity > 0 ? fertilizer.quantity.toString() : ''}
          onChangeText={(text) => {
            const qty = parseFloat(text) || 0;
            onUpdate({ quantity: qty });
          }}
        />
        
        {/* Unit Picker */}
        <TouchableOpacity
          onPress={() => setShowUnitPicker(!showUnitPicker)}
          className="flex-1 flex-row items-center justify-between bg-white rounded-lg px-3 py-2.5 ml-2"
        >
          <Text className="text-base text-surface-900">{fertilizer.unit}</Text>
          <Ionicons 
            name={showUnitPicker ? "chevron-up" : "chevron-down"} 
            size={18} 
            color="#6B7280" 
          />
        </TouchableOpacity>
      </View>

      {/* Unit Options Dropdown */}
      {showUnitPicker && (
        <View className="mt-2 bg-white rounded-lg border border-surface-200 overflow-hidden">
          {FERTILIZER_UNITS.map((unit) => (
            <TouchableOpacity
              key={unit}
              onPress={() => {
                onUpdate({ unit });
                setShowUnitPicker(false);
              }}
              className={`px-3 py-2.5 border-b border-surface-100 ${
                unit === fertilizer.unit ? 'bg-primary-50' : ''
              }`}
            >
              <Text className={`text-sm ${
                unit === fertilizer.unit ? 'text-primary-600 font-medium' : 'text-surface-700'
              }`}>
                {unit}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function validateFertigationForm(data: FertigationFormData): boolean {
  return data.fertilizers.length > 0 && 
    data.fertilizers.every(f => f.name.trim() && f.quantity > 0);
}

// Create empty fertigation form data
export function createEmptyFertigationFormData(): FertigationFormData {
  return {
    fertilizers: [{ name: '', quantity: 0, unit: 'kg/acre' }],
  };
}
