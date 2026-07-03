import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, type TextInputProps } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { SearchSelect } from '@/components/ui/search-select';
import {
  fertigationPlanItemsToOptions,
  fertilizerCatalogToOptions,
  recentItemsToOptions,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import {
  MAX_PRODUCT_ROWS,
  allProductRowsComplete,
  applyQuickAdd,
  filterNameSuggestions,
  isProductRowComplete,
  sanitizeQuantityInput,
} from './product-rows';
import { NameSuggestionOverlay } from './name-suggestion-overlay';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { FERTILIZER_UNITS, type FertilizerUnit } from '../../constants/calculator-models';
import { resolveFertigationUnit } from '@/constants/fertilizer-units';
import { resolveVerbatimQuantityBasis } from '@/constants/unit-text';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { NutrientCompositionItem, QuantityBasis } from '@/types';
import type { MasterCatalogProduct } from '@/types/catalog';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { guidedTourOn } from '@/features/guided-tour/events';

export interface FertilizerEntry {
  id?: string;
  name: string;
  quantity?: number;
  /**
   * Normally one of the picker's `FERTILIZER_UNITS`. A raw string means the
   * source unit could not be represented by the picker vocabulary (ppm,
   * web-written or unknown spellings) and is carried verbatim — never coerced
   * to kg (issue #192). Rendered as-is; submission flags kernel-unknown
   * strings via `unit_unrecognized`.
   */
  unit: FertilizerUnit | string;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  /** Set when this row was picked from an active plan item (uuid). */
  planItemId?: string | null;
  compositionSnapshot?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

function resolveQuantityBasis(
  unit: string | null | undefined,
  basis?: QuantityBasis,
): QuantityBasis {
  if (basis) return basis;
  // Kernel-recognized verbatim units (kg/ha, ppm, g/L) use the kernel's parsed
  // basis; unknowns fall back to the '/acre' + legacy 'per acre' text sniff.
  return resolveVerbatimQuantityBasis(unit);
}

function resolveQuickAddQuantityBasis(
  item: FertigationQuickAddItem,
  basisFromUnit?: QuantityBasis,
): QuantityBasis {
  if (item.quantityBasis) return item.quantityBasis;
  const unit = item.unit?.trim();
  if (!unit) return 'per_acre';
  return basisFromUnit ?? resolveQuantityBasis(unit);
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
  planItemId?: string | null;
  composition?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

interface FertigationFormProps {
  data: FertigationFormData;
  onChange: (data: FertigationFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  quickAddItems?: FertigationQuickAddItem[];
  /** This farm's recent fertigation items (identity-rich) for the picker's history section. */
  historyItems?: RecentInputItem[];
  /** This farm's active plan items for the picker's plan section. */
  planItems?: FertilizerPlanItem[];
  /** Master fertilizer catalog products for the picker's catalog section. */
  catalogProducts?: MasterCatalogProduct[];
  perAreaLabel?: string;
  /** Hide the decorative header + summary/validation chrome (inline log composer). */
  compact?: boolean;
}

export function FertigationForm({
  data,
  onChange,
  onInputFocus,
  quickAddItems = [],
  historyItems = [],
  planItems = [],
  catalogProducts = [],
  perAreaLabel = 'Per acre',
  compact = false,
}: FertigationFormProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const isValid = allProductRowsComplete(data.fertilizers);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showDetailsGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;

  const waterVolumeRef = useRef<NumericInputHandle>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Picker sections: this farm's history → active plan items → fertilizer
  // catalog → custom escape hatch. No warehouse section — warehouse identity
  // only passes through history rows that already carry it (issue #196).
  const historyOptions = useMemo(() => recentItemsToOptions(historyItems), [historyItems]);
  const planOptions = useMemo(() => fertigationPlanItemsToOptions(planItems), [planItems]);
  const catalogOptions = useMemo(
    () => fertilizerCatalogToOptions(catalogProducts),
    [catalogProducts],
  );
  const hasPickerOptions =
    historyOptions.length > 0 || planOptions.length > 0 || catalogOptions.length > 0;

  useEffect(() => {
    const unsubscribe = guidedTourOn('guidedTour.focusLogActivityInput', ({ recordType }) => {
      if (recordType !== 'fertigation') return;
      waterVolumeRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  const addFertilizer = () => {
    if (data.fertilizers.length < MAX_PRODUCT_ROWS) {
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
            planItemId: null,
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

  const addQuickFertilizer = useCallback(
    (item: FertigationQuickAddItem) => {
      const resolved = resolveFertigationUnit(item.unit);
      const validatedUnit = resolved.unit;
      const normalizedName = item.name.trim().toLowerCase();
      // Comparison only — stored unit values stay verbatim (case preserved).
      const normalizedUnit = validatedUnit.trim().toLowerCase();
      const nextFertilizers = applyQuickAdd(data.fertilizers, {
        isDuplicate: (fertilizer) =>
          fertilizer.name.trim().toLowerCase() === normalizedName &&
          fertilizer.unit.trim().toLowerCase() === normalizedUnit,
        fillRow: (current) => ({
          ...current,
          name: item.name.trim(),
          unit: validatedUnit,
          quantity:
            current.quantity !== undefined && current.quantity > 0
              ? current.quantity
              : (item.quantity ?? 0),
          // An explicit item basis (fully-prefilled picker selections) wins over
          // the pristine row's default 'per_acre'; legacy quick-add producers
          // without one keep the current-row-first resolution.
          quantityBasis:
            item.quantityBasis ??
            current.quantityBasis ??
            resolveQuickAddQuantityBasis(item, resolved.basisFromUnit),
          warehouseItemId: item.warehouseItemId ?? null,
          catalogProductId: item.catalogProductId ?? null,
          planItemId: item.planItemId ?? null,
          compositionSnapshot: item.composition ?? null,
          densityKgPerL: item.densityKgPerL ?? null,
        }),
        appendRow: () => ({
          id: `${normalizedName}-${normalizedUnit}`,
          name: item.name.trim(),
          quantity: item.quantity ?? 0,
          unit: validatedUnit,
          quantityBasis: resolveQuickAddQuantityBasis(item, resolved.basisFromUnit),
          warehouseItemId: item.warehouseItemId ?? null,
          catalogProductId: item.catalogProductId ?? null,
          planItemId: item.planItemId ?? null,
          compositionSnapshot: item.composition ?? null,
          densityKgPerL: item.densityKgPerL ?? null,
        }),
      });
      if (nextFertilizers) onChange({ ...data, fertilizers: nextFertilizers });
    },
    [data, onChange],
  );

  const handleSearchSelection = useCallback(
    (selection: SearchSelectSelection) => {
      setShowProductPicker(false);
      // The fertigation picker never offers catalog mixes.
      if (selection.kind === 'mix') return;
      addQuickFertilizer({
        name: selection.name,
        unit: selection.prefill?.unit,
        quantity: selection.prefill?.quantity,
        quantityBasis: selection.prefill?.quantityBasis,
        warehouseItemId: selection.warehouseItemId ?? null,
        catalogProductId: selection.catalogProductId ?? null,
        planItemId: selection.planItemId ?? null,
        // Catalog picks carry declared nutrient composition; stamped exactly
        // like warehouse picks so the nutrient ledger sees them (issue #200).
        composition: selection.composition ?? null,
      });
    },
    [addQuickFertilizer],
  );

  // Calculate total inputs count
  const totalInputs = data.fertilizers.filter(isProductRowComplete).length;

  return (
    <View>
      {/* Header with icon */}
      {!compact && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.success, 0.16),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing[3],
            }}
          >
            <IconSymbol
              name={resolveSymbolIconName(ICON_REGISTRY.fertigation)}
              size={20}
              color={m3.colorScheme.success}
            />
          </View>
          <View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: m3.surface.s900,
              }}
            >
              {t('fertigationForm.title')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
              {t('fertigationForm.subtitle')}
            </Text>
          </View>
        </View>
      )}

      {/* Water Volume Input */}
      <NumericInput
        label={t('fertigationForm.waterVolume.label')}
        placeholder={t('fertigationForm.waterVolume.placeholder')}
        value={data.waterVolume}
        onValueChange={(waterVolume) => onChange({ ...data, waterVolume })}
        unit={t('fertigationForm.waterVolume.unitLiters')}
        decimals={2}
        hint={t('fertigationForm.waterVolume.hint')}
        ref={waterVolumeRef}
        onFocus={onInputFocus}
      />

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_FERTIGATION_DETAILS}>
        <View
          style={{
            marginTop: spacing[2],
            borderRadius: borderRadius.xl,
            borderWidth: showDetailsGuidance ? 2 : 0,
            borderColor: showDetailsGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.7)
              : 'transparent',
            backgroundColor: showDetailsGuidance
              ? colorWithOpacity(m3.colorScheme.primary, 0.03)
              : 'transparent',
            paddingHorizontal: showDetailsGuidance ? spacing[2] : 0,
            paddingTop: showDetailsGuidance ? spacing[2] : 0,
          }}
        >
          {quickAddItems.length > 0 ? (
            <View style={{ marginBottom: spacing[3] }}>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s500,
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
                      backgroundColor: m3.surface.s100,
                      borderWidth: 1,
                      borderColor: m3.surface.s200,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.sm, color: m3.surface.s900 }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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
                <IconSymbol name="flask" size={16} color={m3.primary.p600} />
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s800,
                }}
              >
                Fertilizers <Text style={{ color: m3.colorScheme.error }}>*</Text>
              </Text>
            </View>
            {totalInputs > 0 && (
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.success, 0.16),
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: borderRadius.full,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: m3.colorScheme.success,
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

          {/* Add Fertilizer Button — opens the sectioned product picker when
              there is anything to pick from; falls back to a blank row. */}
          {data.fertilizers.length < MAX_PRODUCT_ROWS && (
            <Pressable
              onPress={() => (hasPickerOptions ? setShowProductPicker(true) : addFertilizer())}
              accessibilityRole="button"
              accessibilityLabel={t('fertigationForm.fertilizers.addFertilizer')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing[3],
                marginTop: spacing[2],
              }}
            >
              <IconSymbol name="plus.circle.fill" size={20} color={m3.colorScheme.success} />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.success,
                  marginLeft: spacing[2],
                }}
              >
                {t('fertigationForm.fertilizers.addFertilizer')}
              </Text>
            </Pressable>
          )}
        </View>
      </GuidedTourTarget>

      <SearchSelect
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={handleSearchSelection}
        historyOptions={historyOptions}
        planOptions={planOptions}
        catalogOptions={catalogOptions}
        title={t('fertigationForm.fertilizers.addFertilizer')}
      />

      {/* Summary */}
      {!compact && totalInputs > 0 && (
        <View
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.success, 0.12),
            borderRadius: borderRadius.xl,
            padding: spacing[4],
            marginTop: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.success,
              marginBottom: spacing[2],
            }}
          >
            Fertilizers Summary
          </Text>
          {data.fertilizers.filter(isProductRowComplete).map((f, idx) => (
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
                  color: m3.colorScheme.success,
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
      {!compact && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing[4],
            paddingTop: spacing[4],
            borderTopWidth: 1,
            borderTopColor: m3.surface.s100,
          }}
        >
          <IconSymbol
            name={isValid ? 'checkmark.circle.fill' : 'exclamationmark.circle'}
            size={16}
            color={
              isValid
                ? m3.colorScheme.success
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
            }
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              marginLeft: spacing[2],
              color: isValid ? m3.colorScheme.success : m3.surface.s500,
            }}
          >
            {isValid ? 'Ready to add' : 'Add at least one fertilizer with quantity'}
          </Text>
        </View>
      )}
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
  const nameSuggestions = useMemo(
    () => filterNameSuggestions(quickAddItems, fertilizer.name),
    [fertilizer.name, quickAddItems],
  );
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
    const { text: sanitizedText, quantity } = sanitizeQuantityInput(text);
    setQuantityText(sanitizedText);
    onUpdate({ quantity });
  };

  const isRowComplete = isProductRowComplete(fertilizer);
  const applySuggestion = (item: FertigationQuickAddItem) => {
    const resolved = resolveFertigationUnit(item.unit, fertilizer.unit);
    const currentQuantity = fertilizer.quantity ?? 0;
    onUpdate({
      name: item.name,
      unit: resolved.unit,
      quantity: currentQuantity > 0 ? currentQuantity : (item.quantity ?? 0),
      quantityBasis:
        fertilizer.quantityBasis ??
        item.quantityBasis ??
        resolved.basisFromUnit ??
        resolveQuantityBasis(item.unit?.trim() ?? resolved.unit),
      warehouseItemId: item.warehouseItemId ?? null,
      catalogProductId: item.catalogProductId ?? null,
      planItemId: item.planItemId ?? null,
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
          ? colorWithOpacity(m3.colorScheme.success, 0.12)
          : m3.surface.s50,
        borderColor: isRowComplete ? colorWithOpacity(m3.colorScheme.success, 0.3) : 'transparent',
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
              color: m3.surface.s900,
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: isNameFocused ? m3.colorScheme.success : m3.surface.s200,
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
            <NameSuggestionOverlay
              items={nameSuggestions}
              onSelect={applySuggestion}
              fallbackUnitLabel="kg"
            />
          ) : null}

          {showNoMatchHint ? (
            <Text
              style={{
                marginTop: spacing[1],
                marginLeft: spacing[1],
                fontSize: fontSize.xs,
                color: m3.surface.s600,
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
            color: m3.surface.s900,
            textAlign: 'center',
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: isQuantityFocused ? m3.colorScheme.success : m3.surface.s200,
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
            backgroundColor: m3.surface.s100,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            marginLeft: spacing[2],
            borderWidth: 1,
            borderColor: m3.surface.s200,
          }}
        >
          <Text style={{ fontSize: fontSize.base, color: m3.surface.s900 }}>{fertilizer.unit}</Text>
          <IconSymbol name="chevron.right" size={18} color={m3.surface.s600} />
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
                ? colorWithOpacity(m3.colorScheme.success, 0.2)
                : m3.surface.s100,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
          }}
        >
          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
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
                ? colorWithOpacity(m3.colorScheme.success, 0.2)
                : m3.surface.s100,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
          }}
        >
          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
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
  return allProductRowsComplete(data.fertilizers);
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
        planItemId: null,
        compositionSnapshot: null,
        densityKgPerL: null,
      },
    ],
  };
}
