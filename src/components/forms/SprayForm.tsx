import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NumericInput } from './FormField';
import { CHEMICAL_UNITS, type ChemicalUnit } from '../../constants/calculatorModels';

export interface ChemicalEntry {
  name: string;
  quantity: number;
  unit: ChemicalUnit;
}

export interface SprayFormData {
  waterVolume: number;
  chemicals: ChemicalEntry[];
  notes?: string;
}

interface SprayFormProps {
  data: SprayFormData;
  onChange: (data: SprayFormData) => void;
}

export function SprayForm({ data, onChange }: SprayFormProps) {
  const isValid =
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity > 0);

  const addChemical = () => {
    if (data.chemicals.length < 10) {
      onChange({
        ...data,
        chemicals: [...data.chemicals, { name: '', quantity: 0, unit: 'gm/L' }],
      });
    }
  };

  const updateChemical = (index: number, updates: Partial<ChemicalEntry>) => {
    const newChemicals = [...data.chemicals];
    newChemicals[index] = { ...newChemicals[index], ...updates };
    onChange({ ...data, chemicals: newChemicals });
  };

  const removeChemical = (index: number) => {
    const newChemicals = data.chemicals.filter((_, i) => i !== index);
    onChange({ ...data, chemicals: newChemicals });
  };

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mr-3">
          <Ionicons name="flask" size={20} color="#8B5CF6" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-surface-900">Spray Application</Text>
          <Text className="text-sm text-surface-500">Log chemicals and water volume</Text>
        </View>
      </View>

      {/* Water Volume Input */}
      <NumericInput
        label="Water Volume"
        icon="water-outline"
        iconColor="#8B5CF6"
        placeholder="Enter volume"
        value={data.waterVolume}
        onValueChange={(waterVolume) => onChange({ ...data, waterVolume })}
        unit="Liters"
        required
        decimals={0}
        hint="Total water used for the spray mix"
      />

      {/* Chemicals Section */}
      <View className="mt-2">
        <View className="flex-row items-center mb-3">
          <Ionicons name="beaker-outline" size={16} color="#408059" style={{ marginRight: 6 }} />
          <Text className="text-sm font-semibold text-surface-800">
            Chemicals <Text className="text-red-500">*</Text>
          </Text>
        </View>

        {/* Chemicals List */}
        {data.chemicals.map((chemical, index) => (
          <ChemicalRow
            key={index}
            chemical={chemical}
            onUpdate={(updates) => updateChemical(index, updates)}
            onRemove={() => removeChemical(index)}
            showRemove={data.chemicals.length > 1}
          />
        ))}

        {/* Add Chemical Button */}
        {data.chemicals.length < 10 && (
          <TouchableOpacity
            onPress={addChemical}
            className="flex-row items-center py-3 mt-2"
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={20} color="#8B5CF6" />
            <Text className="text-sm font-medium text-purple-600 ml-2">Add Chemical</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Validation indicator */}
      <View className="flex-row items-center mt-4 pt-4 border-t border-surface-100">
        <Ionicons
          name={isValid ? 'checkmark-circle' : 'alert-circle-outline'}
          size={16}
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text className={`text-sm ml-2 ${isValid ? 'text-green-600' : 'text-surface-500'}`}>
          {isValid ? 'Ready to add' : 'Add water volume and at least one chemical'}
        </Text>
      </View>
    </View>
  );
}

// Chemical Row Component
interface ChemicalRowProps {
  chemical: ChemicalEntry;
  onUpdate: (updates: Partial<ChemicalEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
}

function ChemicalRow({ chemical, onUpdate, onRemove, showRemove }: ChemicalRowProps) {
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  return (
    <View className="bg-surface-50 rounded-xl p-3 mb-3">
      {/* Chemical Name Row */}
      <View className="flex-row items-center mb-2">
        <TextInput
          className="flex-1 bg-white rounded-lg px-3 py-2.5 text-base text-surface-900"
          placeholder="Chemical name"
          placeholderTextColor="#9CA3AF"
          value={chemical.name}
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
          value={chemical.quantity > 0 ? chemical.quantity.toString() : ''}
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
          <Text className="text-base text-surface-900">{chemical.unit}</Text>
          <Ionicons
            name={showUnitPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      {/* Unit Options Dropdown */}
      {showUnitPicker && (
        <View className="mt-2 bg-white rounded-lg border border-surface-200 overflow-hidden">
          {CHEMICAL_UNITS.map((unit) => (
            <TouchableOpacity
              key={unit}
              onPress={() => {
                onUpdate({ unit });
                setShowUnitPicker(false);
              }}
              className={`px-3 py-2.5 border-b border-surface-100 ${
                unit === chemical.unit ? 'bg-primary-50' : ''
              }`}
            >
              <Text
                className={`text-sm ${
                  unit === chemical.unit ? 'text-primary-600 font-medium' : 'text-surface-700'
                }`}
              >
                {unit}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function validateSprayForm(data: SprayFormData): boolean {
  return (
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity > 0)
  );
}

// Create empty spray form data
export function createEmptySprayFormData(): SprayFormData {
  return {
    waterVolume: 0,
    chemicals: [{ name: '', quantity: 0, unit: 'gm/L' }],
  };
}
