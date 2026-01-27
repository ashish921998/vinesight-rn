import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { UnitPickerModal } from '../ui/UnitPickerModal';
import { FERTILIZER_UNITS, type FertilizerUnit } from '../../constants/calculatorModels';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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
  onInputFocus?: TextInputProps['onFocus'];
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: '#DCFCE7',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <Symbol name="leaf.fill" size={20} color="#22C55E" />
        </View>
        <View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[900],
            }}
          >
            Fertigation
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            Log fertilizer application
          </Text>
        </View>
      </View>

      {/* Fertilizers Section */}
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 6 }}>
              <Symbol name="flask" size={16} color="#408059" />
            </View>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.surface[800],
              }}
            >
              Fertilizers <Text style={{ color: colors.error }}>*</Text>
            </Text>
          </View>
          {totalInputs > 0 && (
            <View
              style={{
                backgroundColor: '#DCFCE7',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: borderRadius.full,
              }}
            >
              <Text
                style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: '#15803D' }}
              >
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
          <Pressable
            onPress={addFertilizer}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing[3],
              marginTop: spacing[2],
            }}
          >
            <Symbol name="plus.circle.fill" size={20} color="#22C55E" />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: '#16A34A',
                marginLeft: spacing[2],
              }}
            >
              Add Fertilizer
            </Text>
          </Pressable>
        )}
      </View>

      {/* Summary */}
      {totalInputs > 0 && (
        <View
          style={{
            backgroundColor: '#ECFDF3',
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: '#15803D',
              marginBottom: spacing[2],
            }}
          >
            Fertilizers Summary
          </Text>
          {data.fertilizers
            .filter((f) => f.name.trim() && f.quantity > 0)
            .map((f, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing[1],
                }}
              >
                <Text style={{ fontSize: fontSize.sm, color: '#166534' }}>{f.name}</Text>
                <Text
                  style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: '#15803D' }}
                >
                  {f.quantity} {f.unit}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Validation indicator */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing[4],
          paddingTop: spacing[4],
          borderTopWidth: 1,
          borderTopColor: colors.surface[100],
        }}
      >
        <Symbol
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
          size={16}
          color={isValid ? '#22C55E' : '#9CA3AF'}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? '#16A34A' : colors.surface[500],
          }}
        >
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
  onInputFocus?: TextInputProps['onFocus'];
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
      style={{
        borderRadius: borderRadius.xl,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        backgroundColor: isRowComplete ? '#ECFDF3' : colors.surface[50],
        borderColor: isRowComplete ? '#BBF7D0' : 'transparent',
      }}
    >
      {/* Fertilizer Name Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={{
            flex: 1,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            fontSize: fontSize.base,
            color: colors.surface[900],
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: isNameFocused ? '#4ADE80' : colors.surface[200],
          }}
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
          <Pressable
            onPress={onRemove}
            style={{ marginLeft: spacing[2], padding: spacing[2] }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Symbol name="minus.circle.fill" size={24} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Quantity and Unit Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] }}>
        <TextInput
          style={{
            flex: 1,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            fontSize: fontSize.base,
            color: colors.surface[900],
            textAlign: 'center',
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: isQuantityFocused ? '#4ADE80' : colors.surface[200],
          }}
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
        />

        {/* Unit Picker */}
        <Pressable
          onPress={() => setShowUnitPicker(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.white,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            marginLeft: spacing[2],
            borderWidth: 1,
            borderColor: colors.surface[200],
          }}
        >
          <Text style={{ fontSize: fontSize.base, color: colors.surface[900] }}>
            {fertilizer.unit}
          </Text>
          <Symbol name="chevron.right" size={18} color="#6B7280" />
        </Pressable>
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
