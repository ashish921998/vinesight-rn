import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { NumericInput, type NumericInputHandle } from './FormField';
import { UnitPickerModal } from '../ui/UnitPickerModal';
import { CHEMICAL_UNITS, type ChemicalUnit } from '../../constants/calculatorModels';

export interface ChemicalEntry {
  id: string;
  name: string;
  quantity: number;
  unit: ChemicalUnit;
}

function generateId(): string {
  return `chem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface SprayFormData {
  waterVolume: number;
  chemicals: ChemicalEntry[];
  notes?: string;
}

interface SprayFormProps {
  data: SprayFormData;
  onChange: (data: SprayFormData) => void;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

export function SprayForm({ data, onChange, onInputFocus }: SprayFormProps) {
  const isValid =
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity > 0);

  const chemicalRefsMapRef = useRef<
    Map<
      string,
      { name: React.RefObject<TextInput | null>; quantity: React.RefObject<TextInput | null> }
    >
  >(new Map());

  const chemicalRefs = useMemo(() => {
    /* eslint-disable react-hooks/refs */
    const map = chemicalRefsMapRef.current;
    const result: {
      name: React.RefObject<TextInput | null>;
      quantity: React.RefObject<TextInput | null>;
    }[] = [];

    for (const chemical of data.chemicals) {
      let refs = map.get(chemical.id);
      if (!refs) {
        refs = {
          name: React.createRef<TextInput | null>(),
          quantity: React.createRef<TextInput | null>(),
        };
        map.set(chemical.id, refs);
      }
      result.push(refs);
    }

    const existingIds = new Set(data.chemicals.map((c) => c.id));
    for (const [id] of map.entries()) {
      if (!existingIds.has(id)) {
        map.delete(id);
      }
    }

    return result;
  }, [data.chemicals]);

  const waterVolumeRef = useRef<NumericInputHandle>(null);

  const addChemical = () => {
    if (data.chemicals.length < 10) {
      onChange({
        ...data,
        chemicals: [...data.chemicals, { id: generateId(), name: '', quantity: 0, unit: 'gm/L' }],
      });
    }
  };

  const updateChemical = (id: string, updates: Partial<ChemicalEntry>) => {
    const newChemicals = data.chemicals.map((c) => (c.id === id ? { ...c, ...updates } : c));
    onChange({ ...data, chemicals: newChemicals });
  };

  const removeChemical = (id: string) => {
    const newChemicals = data.chemicals.filter((c) => c.id !== id);
    onChange({ ...data, chemicals: newChemicals });
  };

  const focusFirstChemicalName = () => {
    const ref = chemicalRefs[0]?.name.current;
    if (ref) {
      ref.focus();
    }
  };

  const focusNextChemicalName = (index: number) => {
    const nextIndex = index + 1;
    const ref = chemicalRefs[nextIndex]?.name.current;
    if (ref) {
      ref.focus();
    }
  };

  return (
    <View>
      {/* Header with icon */}
      <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mr-3">
          <Symbol name="flask.fill" size={20} color="#8B5CF6" />
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
        ref={waterVolumeRef}
        onSubmitEditing={focusFirstChemicalName}
        blurOnSubmit={false}
        returnKeyType="next"
        onFocus={onInputFocus}
      />

      {/* Chemicals Section */}
      <View className="mt-2">
        <View className="flex-row items-center mb-3">
          <View style={{ marginRight: 6 }}>
            <Symbol name="flask" size={16} color="#408059" />
          </View>
          <Text className="text-sm font-semibold text-surface-800">
            Chemicals <Text className="text-red-500">*</Text>
          </Text>
        </View>

        {/* Chemicals List */}
        {data.chemicals.map((chemical, index) => (
          <ChemicalRow
            key={chemical.id}
            chemical={chemical}
            index={index}
            chemicalCount={data.chemicals.length}
            onUpdate={(updates) => updateChemical(chemical.id, updates)}
            onRemove={() => removeChemical(chemical.id)}
            showRemove={data.chemicals.length > 1}
            nameRef={chemicalRefs[index].name}
            quantityRef={chemicalRefs[index].quantity}
            onNextChemical={focusNextChemicalName}
            onInputFocus={onInputFocus}
          />
        ))}

        {/* Add Chemical Button */}
        {data.chemicals.length < 10 && (
          <TouchableOpacity
            onPress={addChemical}
            className="flex-row items-center py-3 mt-2"
            activeOpacity={0.7}
          >
            <Symbol name="plus.circle.fill" size={20} color="#8B5CF6" />
            <Text className="text-sm font-medium text-purple-600 ml-2">Add Chemical</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Validation indicator */}
      <View className="flex-row items-center mt-4 pt-4 border-t border-surface-100">
        <Symbol
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
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
  index: number;
  chemicalCount: number;
  onUpdate: (updates: Partial<ChemicalEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
  nameRef: React.RefObject<TextInput | null>;
  quantityRef: React.RefObject<TextInput | null>;
  onNextChemical: (index: number) => void;
  onInputFocus?: (event: NativeSyntheticEvent<TextInputFocusEventData>) => void;
}

function ChemicalRow({
  chemical,
  index,
  chemicalCount,
  onUpdate,
  onRemove,
  showRemove,
  nameRef,
  quantityRef,
  onNextChemical,
  onInputFocus,
}: ChemicalRowProps) {
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

  const handleNameSubmit = () => {
    if (quantityRef.current) {
      quantityRef.current.focus();
    }
  };

  const handleQuantitySubmit = () => {
    if (index < chemicalCount - 1) {
      onNextChemical(index);
    }
  };

  return (
    <View
      className={`rounded-xl p-3 mb-3 border ${
        isRowComplete ? 'bg-green-50 border-green-200' : 'bg-surface-50 border-transparent'
      }`}
    >
      {/* Chemical Name Row */}
      <View className="flex-row items-center">
        <TextInput
          ref={nameRef}
          className={`flex-1 rounded-lg px-3 py-2.5 text-base text-surface-900 bg-white border ${
            isNameFocused ? 'border-purple-400' : 'border-surface-200'
          }`}
          placeholder="Chemical name"
          placeholderTextColor="#9CA3AF"
          value={chemical.name}
          onChangeText={(name) => onUpdate({ name })}
          onFocus={(event) => {
            setIsNameFocused(true);
            onInputFocus?.(event);
          }}
          onBlur={() => setIsNameFocused(false)}
          onSubmitEditing={handleNameSubmit}
          returnKeyType="next"
          blurOnSubmit={false}
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
          ref={quantityRef}
          className={`rounded-lg px-3 py-2.5 text-base text-surface-900 text-center bg-white border ${
            isQuantityFocused ? 'border-purple-400' : 'border-surface-200'
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
          onSubmitEditing={handleQuantitySubmit}
          returnKeyType={index < chemicalCount - 1 ? 'next' : 'done'}
          blurOnSubmit={index >= chemicalCount - 1}
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
          <Symbol name="chevron.right" size={18} color="#6B7280" />
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
    chemicals: [{ id: generateId(), name: '', quantity: 0, unit: 'gm/L' }],
  };
}
