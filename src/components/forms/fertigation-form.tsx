import React, { useState, useRef } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { FERTILIZER_UNITS, type FertilizerUnit } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export interface FertilizerEntry {
  id?: string;
  name: string;
  quantity?: number;
  unit: FertilizerUnit;
}

export interface FertigationFormData {
  waterVolume?: number;
  fertilizers: FertilizerEntry[];
  notes?: string;
}

interface FertigationFormProps {
  data: FertigationFormData;
  onChange: (data: FertigationFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
}

export function FertigationForm({ data, onChange, onInputFocus }: FertigationFormProps) {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();
  const isValid =
    data.fertilizers.length > 0 &&
    data.fertilizers.every((f) => f.name.trim() && (f.quantity ?? 0) > 0);

  const waterVolumeRef = useRef<NumericInputHandle>(null);

  const addFertilizer = () => {
    if (data.fertilizers.length < 10) {
      onChange({
        ...data,
        fertilizers: [
          ...data.fertilizers,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: '',
            quantity: 0,
            unit: 'kg/acre',
          },
        ],
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
  const totalInputs = data.fertilizers.filter((f) => f.name.trim() && (f.quantity ?? 0) > 0).length;

  return (
    <View>
      {/* Header with icon */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: colorWithOpacity(colors.success, 0.16),
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <IconSymbol
            name={resolveSymbolIconName(ICON_REGISTRY.fertigation)}
            size={20}
            color={colors.success}
          />
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

      {/* Water Volume Input */}
      <NumericInput
        label={t('fertigationForm.waterVolume.label')}
        icon="water-outline"
        iconColor={m3.colorScheme.tertiary}
        placeholder={t('fertigationForm.waterVolume.placeholder')}
        value={data.waterVolume}
        onValueChange={(waterVolume) => onChange({ ...data, waterVolume })}
        unit={t('fertigationForm.waterVolume.unitLiters')}
        decimals={2}
        hint={t('fertigationForm.waterVolume.hint')}
        ref={waterVolumeRef}
        onFocus={onInputFocus}
      />

      {/* Fertilizers Section */}
      <View style={{ marginTop: spacing[2] }}>
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
              <IconSymbol name="flask" size={16} color={colors.primary[600]} />
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
                backgroundColor: colorWithOpacity(colors.success, 0.16),
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: borderRadius.full,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.medium,
                  color: colors.success,
                }}
              >
                {totalInputs} input{totalInputs !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Fertilizers List */}
        {data.fertilizers.map((fertilizer, index) => (
          <FertilizerRow
            key={fertilizer.id ?? index}
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
            <IconSymbol name="plus.circle.fill" size={20} color={colors.success} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.success,
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
            backgroundColor: colorWithOpacity(colors.success, 0.12),
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.success,
              marginBottom: spacing[2],
            }}
          >
            Fertilizers Summary
          </Text>
          {data.fertilizers
            .filter((f) => f.name.trim() && (f.quantity ?? 0) > 0)
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
                <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                  {f.name}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: colors.success,
                  }}
                >
                  {f.quantity ?? 0} {f.unit}
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
        <IconSymbol
          name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
          size={16}
          color={isValid ? colors.success : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? colors.success : colors.surface[500],
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
  const colors = useThemeColors();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);
  const [quantityText, setQuantityText] = useState(
    fertilizer.quantity !== undefined && fertilizer.quantity > 0
      ? fertilizer.quantity.toString()
      : '',
  );
  const [isQuantityEditing, setIsQuantityEditing] = useState(false);

  // Sync quantityText with fertilizer.quantity when not editing
  if (!isQuantityEditing) {
    const syncedText =
      fertilizer.quantity !== undefined && fertilizer.quantity > 0
        ? fertilizer.quantity.toString()
        : '';
    if (quantityText !== syncedText) {
      setQuantityText(syncedText);
    }
  }

  const handleQuantityChange = (text: string) => {
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');
    let sanitizedText = parts[0];
    if (parts.length > 1) {
      sanitizedText += '.' + parts[1].slice(0, 2);
    }
    setQuantityText(sanitizedText);
    const qty = sanitizedText === '' ? undefined : parseFloat(sanitizedText);
    onUpdate({ quantity: qty });
  };

  const isRowComplete = fertilizer.name.trim() && (fertilizer.quantity ?? 0) > 0;

  return (
    <View
      style={{
        borderRadius: borderRadius.xl,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        backgroundColor: isRowComplete
          ? colorWithOpacity(colors.success, 0.12)
          : colors.surface[50],
        borderColor: isRowComplete ? colorWithOpacity(colors.success, 0.3) : 'transparent',
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
            backgroundColor: colors.surface[100],
            borderWidth: 1,
            borderColor: isNameFocused ? colors.success : colors.surface[200],
          }}
          placeholder="Fertilizer name"
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
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
            <IconSymbol
              name="minus.circle.fill"
              size={24}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
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
            backgroundColor: colors.surface[100],
            borderWidth: 1,
            borderColor: isQuantityFocused ? colors.success : colors.surface[200],
          }}
          placeholder="Qty"
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          onFocus={(event) => {
            setIsQuantityFocused(true);
            setIsQuantityEditing(true);
            onInputFocus?.(event);
          }}
          onBlur={() => {
            setIsQuantityFocused(false);
            setIsQuantityEditing(false);
          }}
        />

        {/* Unit Picker */}
        <Pressable
          onPress={() => setShowUnitPicker(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface[100],
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
          <IconSymbol name="chevron.right" size={18} color={colors.surface[600]} />
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
    data.fertilizers.length > 0 &&
    data.fertilizers.every((f) => f.name.trim() && (f.quantity ?? 0) > 0)
  );
}

// Create empty fertigation form data
export function createEmptyFertigationFormData(): FertigationFormData {
  return {
    waterVolume: undefined,
    fertilizers: [{ name: '', quantity: 0, unit: 'kg/acre' }],
  };
}
