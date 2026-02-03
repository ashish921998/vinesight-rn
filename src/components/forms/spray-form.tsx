import React, { useState, useRef, useMemo } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { CHEMICAL_UNITS, type ChemicalUnit } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@/styles/use-theme';

export interface ChemicalEntry {
  id: string;
  name: string;
  quantity: number | undefined;
  unit: ChemicalUnit;
}

function generateId(): string {
  return `chem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface SprayFormData {
  waterVolume: number | undefined;
  chemicals: ChemicalEntry[];
  notes?: string;
}

interface SprayFormProps {
  data: SprayFormData;
  onChange: (data: SprayFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
}

export function SprayForm({ data, onChange, onInputFocus }: SprayFormProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const isValid =
    data.waterVolume !== undefined &&
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0);

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
        chemicals: [
          ...data.chemicals,
          { id: generateId(), name: '', quantity: undefined, unit: 'gm/L' },
        ],
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
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.full,
            backgroundColor: '#F3E8FF',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing[3],
          }}
        >
          <Symbol name="flask.fill" size={20} color="#8B5CF6" />
        </View>
        <View>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[900],
            }}
          >
            {t('sprayForm.title')}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.surface[500] }}>
            {t('sprayForm.subtitle')}
          </Text>
        </View>
      </View>

      {/* Water Volume Input */}
      <NumericInput
        label={t('sprayForm.waterVolume.label')}
        icon="water-outline"
        iconColor="#8B5CF6"
        placeholder={t('sprayForm.waterVolume.placeholder')}
        value={data.waterVolume}
        onValueChange={(waterVolume) => onChange({ ...data, waterVolume })}
        unit={t('sprayForm.waterVolume.unitLiters')}
        required
        decimals={2}
        hint={t('sprayForm.waterVolume.hint')}
        ref={waterVolumeRef}
        onSubmitEditing={focusFirstChemicalName}
        blurOnSubmit={false}
        returnKeyType="next"
        onFocus={onInputFocus}
      />

      {/* Chemicals Section */}
      <View style={{ marginTop: spacing[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
          <View style={{ marginRight: 6 }}>
            <Symbol name="flask" size={16} color={colors.primary[600]} />
          </View>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: colors.surface[800],
            }}
          >
            {t('sprayForm.chemicals.label')} <Text style={{ color: colors.error }}>*</Text>
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
          <Pressable
            onPress={addChemical}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: spacing[3],
              marginTop: spacing[2],
            }}
          >
            <Symbol name="plus.circle.fill" size={20} color="#8B5CF6" />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: '#7C3AED',
                marginLeft: spacing[2],
              }}
            >
              {t('sprayForm.chemicals.addChemical')}
            </Text>
          </Pressable>
        )}
      </View>

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
          color={isValid ? colors.success : colors.gray[400]}
        />
        <Text
          style={{
            fontSize: fontSize.sm,
            marginLeft: spacing[2],
            color: isValid ? '#16A34A' : colors.surface[500],
          }}
        >
          {isValid ? t('sprayForm.validation.ready') : t('sprayForm.validation.incomplete')}
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
  onInputFocus?: TextInputProps['onFocus'];
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
  const { t } = useTranslation();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [quantityText, setQuantityText] = useState(
    chemical.quantity !== undefined && chemical.quantity > 0 ? chemical.quantity.toString() : '',
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
    const qty = sanitizedText === '' ? undefined : parseFloat(sanitizedText);
    onUpdate({ quantity: qty });
  };

  const isRowComplete =
    chemical.name.trim() && chemical.quantity !== undefined && chemical.quantity > 0;

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
      style={{
        borderRadius: borderRadius.xl,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        backgroundColor: isRowComplete ? '#F5F3FF' : colors.surface[50],
        borderColor: isRowComplete ? '#DDD6FE' : 'transparent',
      }}
    >
      {/* Chemical Name Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          ref={nameRef}
          style={{
            flex: 1,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            fontSize: fontSize.base,
            color: colors.surface[900],
            backgroundColor: colors.surface[100],
            borderWidth: 1,
            borderColor: isNameFocused ? '#A78BFA' : colors.surface[200],
          }}
          placeholder={t('sprayForm.chemicals.namePlaceholder')}
          placeholderTextColor={colors.gray[400]}
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
          <Pressable
            onPress={onRemove}
            style={{ marginLeft: spacing[2], padding: spacing[2] }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Symbol name="minus.circle.fill" size={24} color={colors.gray[400]} />
          </Pressable>
        )}
      </View>

      {/* Quantity and Unit Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] }}>
        <TextInput
          ref={quantityRef}
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
            borderColor: isQuantityFocused ? '#A78BFA' : colors.surface[200],
          }}
          placeholder={t('sprayForm.chemicals.qtyPlaceholder')}
          placeholderTextColor={colors.gray[400]}
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
            {chemical.unit}
          </Text>
          <Symbol name="chevron.right" size={18} color={colors.surface[600]} />
        </Pressable>
      </View>

      {/* Unit Picker Modal */}
      <UnitPickerModal
        visible={showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(unit) => onUpdate({ unit })}
        selectedValue={chemical.unit}
        options={CHEMICAL_UNITS}
        title={t('sprayForm.chemicals.selectUnit')}
      />
    </View>
  );
}

export function validateSprayForm(data: SprayFormData): boolean {
  return (
    data.waterVolume !== undefined &&
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
  );
}

// Create empty spray form data
export function createEmptySprayFormData(): SprayFormData {
  return {
    waterVolume: undefined,
    chemicals: [{ id: generateId(), name: '', quantity: undefined, unit: 'gm/L' }],
  };
}
