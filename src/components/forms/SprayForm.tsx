import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NumericInput } from './FormField';
import { UnitPickerModal } from '../ui/UnitPickerModal';
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
        decimals={2}
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
            key={`${chemical.name}-${chemical.quantity}-${chemical.unit}`}
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
  const [quantityText, setQuantityText] = useState(
    chemical.quantity > 0 ? chemical.quantity.toString() : '',
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);

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

  const isRowComplete = chemical.name.trim() && chemical.quantity > 0;

  return (
    <View
      className={`rounded-xl p-3 mb-3 border ${
        isRowComplete ? 'bg-green-50 border-green-200' : 'bg-surface-50 border-transparent'
      }`}
    >
      {/* Chemical Name Row */}
      <View className="flex-row items-center">
        <TextInput
          className={`flex-1 rounded-lg px-3 py-2.5 text-base text-surface-900 bg-white border ${
            isNameFocused ? 'border-purple-400' : 'border-surface-200'
          }`}
          placeholder="Chemical name"
          placeholderTextColor="#9CA3AF"
          value={chemical.name}
          onChangeText={(name) => onUpdate({ name })}
          onFocus={() => setIsNameFocused(true)}
          onBlur={() => setIsNameFocused(false)}
        />
        {showRemove && (
          <TouchableOpacity
            onPress={onRemove}
            className="ml-2 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="remove-circle" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Quantity and Unit Row */}
      <View className="flex-row items-center mt-2">
        <TextInput
          className={`rounded-lg px-3 py-2.5 text-base text-surface-900 text-center bg-white border ${
            isQuantityFocused ? 'border-purple-400' : 'border-surface-200'
          }`}
          placeholder="Qty"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          onFocus={() => setIsQuantityFocused(true)}
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
          <Text className="text-base text-surface-900">{chemical.unit}</Text>
          <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Unit Picker Modal */}
      <UnitPickerModal
        visible={showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(unit) => onUpdate({ unit })}
        selectedValue={chemical.unit}
        options={CHEMICAL_UNITS}
        title="Select Unit"
      />
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
