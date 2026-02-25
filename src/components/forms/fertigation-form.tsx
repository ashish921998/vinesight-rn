import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, type TextInputProps } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { FERTILIZER_UNITS, type FertilizerUnit } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { NutrientCompositionItem, QuantityBasis } from '@/types';

export interface FertilizerEntry {
  id?: string;
  name: string;
  quantity?: number;
  unit: FertilizerUnit;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  compositionSnapshot?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

const DEFAULT_FERTILIZER_UNIT: FertilizerUnit = 'kg';

function isFertilizerUnit(value: string): value is FertilizerUnit {
  return FERTILIZER_UNITS.includes(value as FertilizerUnit);
}

function resolveFertilizerUnit(
  unit: string | null | undefined,
  fallback: FertilizerUnit = DEFAULT_FERTILIZER_UNIT,
): FertilizerUnit {
  const normalized = unit?.trim();
  const lowered = normalized?.toLowerCase();
  if (lowered === 'kg/acre') return 'kg';
  if (lowered === 'liter/acre' || lowered === 'litre/acre') return 'liter';
  if (lowered === 'litre') return 'liter';
  if (normalized && isFertilizerUnit(normalized)) return normalized;
  return fallback;
}

function resolveQuantityBasis(
  unit: string | null | undefined,
  basis?: QuantityBasis,
): QuantityBasis {
  if (basis) return basis;
  return unit?.trim().toLowerCase().includes('/acre') ? 'per_acre' : 'total';
}

function resolveQuickAddQuantityBasis(item: FertigationQuickAddItem): QuantityBasis {
  if (item.quantityBasis) return item.quantityBasis;
  const unit = item.unit?.trim();
  if (!unit) return 'per_acre';
  return resolveQuantityBasis(unit);
}

export interface FertigationFormData {
  waterVolume?: number;
  fertilizers: FertilizerEntry[];
  notes?: string;
}

export interface FertigationQuickAddItem {
  name: string;
  unit?: string | null;
  quantity?: number | null;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  composition?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

interface FertigationFormProps {
  data: FertigationFormData;
  onChange: (data: FertigationFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  quickAddItems?: FertigationQuickAddItem[];
  perAreaLabel?: string;
}

export function FertigationForm({
  data,
  onChange,
  onInputFocus,
  quickAddItems = [],
  perAreaLabel = 'Per acre',
}: FertigationFormProps) {
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
            unit: 'kg',
            quantityBasis: 'per_acre',
            warehouseItemId: null,
            catalogProductId: null,
            compositionSnapshot: null,
            densityKgPerL: null,
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

  const addQuickFertilizer = (item: FertigationQuickAddItem) => {
    const validatedUnit = resolveFertilizerUnit(item.unit);
    const normalizedName = item.name.trim().toLowerCase();
    const alreadyExists = data.fertilizers.some(
      (fertilizer) =>
        fertilizer.name.trim().toLowerCase() === normalizedName &&
        fertilizer.unit === validatedUnit,
    );
    if (alreadyExists) return;

    const firstIncompleteIndex = data.fertilizers.findIndex(
      (fertilizer) =>
        !fertilizer.name.trim() || fertilizer.quantity === undefined || fertilizer.quantity <= 0,
    );

    if (firstIncompleteIndex >= 0) {
      const nextFertilizers = [...data.fertilizers];
      const current = nextFertilizers[firstIncompleteIndex];
      if (!current) return;
      nextFertilizers[firstIncompleteIndex] = {
        ...current,
        name: item.name.trim(),
        unit: validatedUnit,
        quantity:
          current.quantity !== undefined && current.quantity > 0
            ? current.quantity
            : (item.quantity ?? 0),
        quantityBasis: current.quantityBasis ?? resolveQuickAddQuantityBasis(item),
        warehouseItemId: item.warehouseItemId ?? null,
        catalogProductId: item.catalogProductId ?? null,
        compositionSnapshot: item.composition ?? null,
        densityKgPerL: item.densityKgPerL ?? null,
      };
      onChange({
        ...data,
        fertilizers: nextFertilizers,
      });
      return;
    }

    if (data.fertilizers.length >= 10) return;

    onChange({
      ...data,
      fertilizers: [
        ...data.fertilizers,
        {
          id: `${normalizedName}-${validatedUnit.trim().toLowerCase()}`,
          name: item.name.trim(),
          quantity: item.quantity ?? 0,
          unit: validatedUnit,
          quantityBasis: resolveQuickAddQuantityBasis(item),
          warehouseItemId: item.warehouseItemId ?? null,
          catalogProductId: item.catalogProductId ?? null,
          compositionSnapshot: item.composition ?? null,
          densityKgPerL: item.densityKgPerL ?? null,
        },
      ],
    });
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
        {quickAddItems.length > 0 ? (
          <View style={{ marginBottom: spacing[3] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                color: colors.surface[500],
                marginBottom: spacing[2],
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {t('fertigationForm.quickAdd')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickAddItems.map((item, index) => (
                <Pressable
                  key={`${item.name}-${item.unit ?? 'unit'}-${index}`}
                  onPress={() => addQuickFertilizer(item)}
                  style={{
                    marginRight: spacing[2],
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.surface[100],
                    borderWidth: 1,
                    borderColor: colors.surface[200],
                  }}
                >
                  <Text style={{ fontSize: fontSize.sm, color: colors.surface[900] }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.unit ?? 'kg'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
            quickAddItems={quickAddItems}
            onUpdate={(updates) => updateFertilizer(index, updates)}
            onRemove={() => removeFertilizer(index)}
            showRemove={data.fertilizers.length > 1}
            onInputFocus={onInputFocus}
            perAreaLabel={perAreaLabel}
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
                  {f.quantityBasis === 'per_acre' ? ` (${perAreaLabel})` : ''}
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
  quickAddItems: FertigationQuickAddItem[];
  onUpdate: (updates: Partial<FertilizerEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
  onInputFocus?: TextInputProps['onFocus'];
  perAreaLabel: string;
}

function FertilizerRow({
  fertilizer,
  quickAddItems,
  onUpdate,
  onRemove,
  showRemove,
  onInputFocus,
  perAreaLabel,
}: FertilizerRowProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);
  const quantityRef = useRef<TextInput>(null);
  const [quantityText, setQuantityText] = useState(
    fertilizer.quantity !== undefined && fertilizer.quantity > 0
      ? fertilizer.quantity.toString()
      : '',
  );
  const [isQuantityEditing, setIsQuantityEditing] = useState(false);
  const syncedQuantityText =
    fertilizer.quantity !== undefined && fertilizer.quantity > 0
      ? fertilizer.quantity.toString()
      : '';
  const nameSuggestions = useMemo(() => {
    const query = fertilizer.name.trim().toLowerCase();
    if (!query) return [];
    return quickAddItems
      .filter((item) => item.name.trim().toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [fertilizer.name, quickAddItems]);
  const showNoMatchHint =
    isNameFocused && fertilizer.name.trim().length >= 2 && nameSuggestions.length === 0;
  const shouldShowSuggestions =
    isNameFocused && fertilizer.name.trim().length >= 2 && nameSuggestions.length > 0;

  useEffect(() => {
    if (isQuantityEditing) return;
    if (quantityText === syncedQuantityText) return;
    const frame = requestAnimationFrame(() => {
      setQuantityText(syncedQuantityText);
    });
    return () => cancelAnimationFrame(frame);
  }, [isQuantityEditing, quantityText, syncedQuantityText]);

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
  const applySuggestion = (item: FertigationQuickAddItem) => {
    const unit = resolveFertilizerUnit(item.unit, fertilizer.unit);
    const currentQuantity = fertilizer.quantity ?? 0;
    onUpdate({
      name: item.name,
      unit,
      quantity: currentQuantity > 0 ? currentQuantity : (item.quantity ?? 0),
      quantityBasis:
        fertilizer.quantityBasis ??
        resolveQuantityBasis(item.unit?.trim() ?? unit, item.quantityBasis),
      warehouseItemId: item.warehouseItemId ?? null,
      catalogProductId: item.catalogProductId ?? null,
      compositionSnapshot: item.composition ?? null,
      densityKgPerL: item.densityKgPerL ?? null,
    });
    if (currentQuantity <= 0 && item.quantity !== null && item.quantity !== undefined) {
      setQuantityText(item.quantity.toString());
    }
    quantityRef.current?.focus();
  };

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
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            style={{
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

          {shouldShowSuggestions ? (
            <View
              style={{
                position: 'absolute',
                top: 52,
                left: 0,
                right: 0,
                backgroundColor: colors.white,
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.surface[200],
                maxHeight: 208,
                overflow: 'hidden',
                zIndex: 20,
                elevation: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 8,
              }}
            >
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {nameSuggestions.map((item, suggestionIndex) => (
                  <Pressable
                    key={`${item.name}-${item.unit ?? 'unit'}-${suggestionIndex}`}
                    onPress={() => applySuggestion(item)}
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderTopWidth: suggestionIndex === 0 ? 0 : 1,
                      borderTopColor: colors.surface[100],
                    }}
                  >
                    <Text style={{ fontSize: fontSize.sm, color: colors.surface[900] }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                      {item.quantity ? `${item.quantity} ` : ''}
                      {item.unit ?? 'kg'}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {showNoMatchHint ? (
            <Text
              style={{
                marginTop: spacing[1],
                marginLeft: spacing[1],
                fontSize: fontSize.xs,
                color: colors.surface[600],
              }}
            >
              {t('fertigationForm.noMatchesHint')}
            </Text>
          ) : null}
        </View>
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
            borderColor: isQuantityFocused ? colors.success : colors.surface[200],
          }}
          placeholder="Qty"
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          keyboardType="decimal-pad"
          value={isQuantityEditing ? quantityText : syncedQuantityText}
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

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2], gap: 8 }}>
        <Pressable
          onPress={() => onUpdate({ quantityBasis: 'total' })}
          style={{
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
            backgroundColor:
              (fertilizer.quantityBasis ?? 'total') === 'total'
                ? colorWithOpacity(colors.success, 0.2)
                : colors.surface[100],
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
          }}
        >
          <Text style={{ fontSize: fontSize.xs, color: colors.surface[800], fontWeight: '600' }}>
            Total Qty
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onUpdate({ quantityBasis: 'per_acre' })}
          style={{
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
            backgroundColor:
              fertilizer.quantityBasis === 'per_acre'
                ? colorWithOpacity(colors.success, 0.2)
                : colors.surface[100],
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
          }}
        >
          <Text style={{ fontSize: fontSize.xs, color: colors.surface[800], fontWeight: '600' }}>
            {perAreaLabel}
          </Text>
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
    fertilizers: [
      {
        name: '',
        quantity: 0,
        unit: 'kg',
        quantityBasis: 'per_acre',
        warehouseItemId: null,
        catalogProductId: null,
        compositionSnapshot: null,
        densityKgPerL: null,
      },
    ],
  };
}
