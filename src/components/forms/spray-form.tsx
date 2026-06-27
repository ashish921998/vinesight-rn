import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Modal,
  type TextInputProps,
} from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { CHEMICAL_UNITS, type ChemicalUnit } from '../../constants/calculator-models';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { NutrientCompositionItem, QuantityBasis } from '@/types';
import type { ChemicalMix } from '@/types/phi';
import { normalizeMixComponentToPerLiterDose } from '@/services/phi-service';
import { GuidedTourTarget } from '@/features/guided-tour/targets';
import { GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour/constants';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { guidedTourOn } from '@/features/guided-tour/events';

export interface ChemicalEntry {
  id: string;
  name: string;
  quantity: number | undefined;
  unit: ChemicalUnit;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  compositionSnapshot?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

const DEFAULT_CHEMICAL_UNIT: ChemicalUnit = 'gm/L';
const MAX_CHEMICAL_ROWS = 10;
const QUICK_CHEMICAL_UNITS: readonly ChemicalUnit[] = ['gm/L', 'ml/L', 'kg', 'liter'];

function isChemicalUnit(value: string): value is ChemicalUnit {
  return CHEMICAL_UNITS.includes(value as ChemicalUnit);
}

function resolveChemicalUnit(
  unit: string | null | undefined,
  fallback: ChemicalUnit = DEFAULT_CHEMICAL_UNIT,
): ChemicalUnit {
  const normalized = unit?.trim();
  const lowered = normalized?.toLowerCase();
  if (lowered === 'gm/liter' || lowered === 'gm/litre' || lowered === 'gm/l' || lowered === 'g/l') {
    return 'gm/L';
  }
  if (lowered === 'ml/liter' || lowered === 'ml/litre' || lowered === 'ml/l') {
    return 'ml/L';
  }
  if (lowered === 'gm/acre') return 'gram';
  if (lowered === 'ml/acre') return 'ml';
  if (normalized && isChemicalUnit(normalized)) return normalized;
  return fallback;
}

function resolveQuantityBasis(
  unit: string | null | undefined,
  basis?: QuantityBasis,
): QuantityBasis {
  if (basis) return basis;
  return unit?.trim().toLowerCase().includes('/acre') ? 'per_acre' : 'total';
}

function normalizeDedupeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeDedupeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(6));
}

function generateId(): string {
  return `chem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function clampChemicalRows(chemicals: ChemicalEntry[]): ChemicalEntry[] {
  return chemicals.slice(0, MAX_CHEMICAL_ROWS);
}

export interface SprayFormData {
  waterVolume: number | undefined;
  chemicals: ChemicalEntry[];
  catalogMixId?: number | null;
  catalogMixName?: string | null;
  governingPhiDays?: number | null;
  safeHarvestDate?: string | null;
  phiBlockingComponent?: string | null;
  phiStatus?: 'verified' | 'legacy_unverified' | 'unknown' | null;
  phiOverride?: boolean;
  notes?: string;
}

export interface SprayQuickAddItem {
  name: string;
  unit?: string | null;
  quantity?: number | null;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  composition?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

interface SprayFormProps {
  data: SprayFormData;
  onChange: (data: SprayFormData) => void;
  onInputFocus?: TextInputProps['onFocus'];
  quickAddItems?: SprayQuickAddItem[];
  catalogOnly?: boolean;
  catalogMixes?: ChemicalMix[];
  /** Hide the decorative header (inline log composer). */
  compact?: boolean;
}

export function SprayForm({
  data,
  onChange,
  onInputFocus,
  quickAddItems = [],
  catalogOnly = false,
  catalogMixes = [],
  compact = false,
}: SprayFormProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const onChangeRef = useRef(onChange);
  const dataRef = useRef(data);
  const isValid =
    data.waterVolume !== undefined &&
    data.waterVolume > 0 &&
    data.chemicals.length > 0 &&
    data.chemicals.every((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showDetailsGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;

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
  const [showCatalogMixPicker, setShowCatalogMixPicker] = useState(false);
  const [catalogMixQuery, setCatalogMixQuery] = useState('');
  const selectedCatalogMix = useMemo(
    () => catalogMixes.find((mix) => mix.id === data.catalogMixId) ?? null,
    [catalogMixes, data.catalogMixId],
  );
  const filteredCatalogMixes = useMemo(() => {
    const normalized = catalogMixQuery.trim().toLowerCase();
    if (!normalized) return catalogMixes;
    return catalogMixes.filter((mix) => {
      if (mix.name.toLowerCase().includes(normalized)) return true;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;
      return mix.components.some(
        (component) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [catalogMixes, catalogMixQuery]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const unsubscribe = guidedTourOn('guidedTour.focusLogActivityInput', ({ recordType }) => {
      if (recordType !== 'spray') return;
      waterVolumeRef.current?.focus();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (data.chemicals.length <= MAX_CHEMICAL_ROWS) return;
    const clamped = clampChemicalRows(data.chemicals);
    if (clamped.length === data.chemicals.length) return;
    onChangeRef.current({
      ...data,
      chemicals: clamped,
    });
  }, [data]);

  const addChemical = () => {
    if (data.chemicals.length < MAX_CHEMICAL_ROWS) {
      onChange({
        ...data,
        chemicals: clampChemicalRows([
          ...data.chemicals,
          {
            id: generateId(),
            name: '',
            quantity: undefined,
            unit: 'gm/L',
            quantityBasis: 'total',
            warehouseItemId: null,
            catalogProductId: null,
            compositionSnapshot: null,
            densityKgPerL: null,
          },
        ]),
      });
    }
  };

  const updateChemical = (id: string, updates: Partial<ChemicalEntry>) => {
    const newChemicals = data.chemicals.map((c) => (c.id === id ? { ...c, ...updates } : c));
    onChange({ ...data, chemicals: clampChemicalRows(newChemicals) });
  };

  const removeChemical = (id: string) => {
    const newChemicals = data.chemicals.filter((c) => c.id !== id);
    onChange({ ...data, chemicals: clampChemicalRows(newChemicals) });
  };

  const addQuickChemical = (item: SprayQuickAddItem) => {
    const validatedUnit = resolveChemicalUnit(item.unit);
    const normalizedName = item.name.trim().toLowerCase();
    const alreadyExists = data.chemicals.some(
      (chemical) =>
        chemical.name.trim().toLowerCase() === normalizedName && chemical.unit === validatedUnit,
    );
    if (alreadyExists) return;

    const firstIncompleteIndex = data.chemicals.findIndex(
      (chemical) =>
        !chemical.name.trim() || chemical.quantity === undefined || chemical.quantity <= 0,
    );

    if (firstIncompleteIndex >= 0) {
      const nextChemicals = [...data.chemicals];
      const current = nextChemicals[firstIncompleteIndex];
      if (!current) return;
      nextChemicals[firstIncompleteIndex] = {
        ...current,
        name: item.name.trim(),
        unit: validatedUnit,
        quantity:
          current.quantity !== undefined && current.quantity > 0
            ? current.quantity
            : (item.quantity ?? undefined),
        quantityBasis:
          current.quantityBasis ??
          resolveQuantityBasis(item.unit?.trim() ?? validatedUnit, item.quantityBasis),
        warehouseItemId: item.warehouseItemId ?? null,
        catalogProductId: item.catalogProductId ?? null,
        compositionSnapshot: item.composition ?? null,
        densityKgPerL: item.densityKgPerL ?? null,
      };
      onChange({
        ...data,
        chemicals: clampChemicalRows(nextChemicals),
      });
      return;
    }

    if (data.chemicals.length >= MAX_CHEMICAL_ROWS) return;

    onChange({
      ...data,
      chemicals: clampChemicalRows([
        ...data.chemicals,
        {
          id: generateId(),
          name: item.name.trim(),
          quantity: item.quantity ?? undefined,
          unit: validatedUnit,
          quantityBasis: resolveQuantityBasis(
            item.unit?.trim() ?? validatedUnit,
            item.quantityBasis,
          ),
          warehouseItemId: item.warehouseItemId ?? null,
          catalogProductId: item.catalogProductId ?? null,
          compositionSnapshot: item.composition ?? null,
          densityKgPerL: item.densityKgPerL ?? null,
        },
      ]),
    });
  };

  const applyCatalogMix = useCallback(
    (mix: ChemicalMix) => {
      const dedupeKeySet = new Set<string>();
      const chemicals = mix.components.flatMap((component) => {
        const perLiter = normalizeMixComponentToPerLiterDose(component);
        if (!perLiter) return [];
        const normalizedProductName = normalizeDedupeText(component.product_name);
        const canonicalDoseValue = normalizeDedupeNumber(perLiter.quantity);
        const canonicalDoseUnit = normalizeDedupeText(perLiter.unit);
        const key = [
          component.product_id,
          normalizedProductName,
          canonicalDoseValue ?? 'na',
          canonicalDoseUnit,
          'per_liter',
        ].join('::');
        if (dedupeKeySet.has(key)) return [];
        dedupeKeySet.add(key);
        return {
          id: generateId(),
          name: component.product_name,
          quantity: Number(perLiter.quantity.toFixed(4)),
          unit: perLiter.unit,
          quantityBasis: 'total' as const,
          warehouseItemId: null,
          catalogProductId: component.product_id,
          compositionSnapshot: null,
          densityKgPerL: null,
        };
      });

      if (chemicals.length === 0) {
        return;
      }
      if (chemicals.length > MAX_CHEMICAL_ROWS) {
        return;
      }

      onChange({
        ...dataRef.current,
        catalogMixId: mix.id,
        catalogMixName: mix.name,
        governingPhiDays: null,
        safeHarvestDate: null,
        phiBlockingComponent: null,
        phiStatus: null,
        phiOverride: false,
        chemicals,
      });
      setShowCatalogMixPicker(false);
      setCatalogMixQuery('');
    },
    [onChange],
  );

  const focusFirstChemicalName = () => {
    if (catalogOnly) return;
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
      {!compact && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing[3],
            }}
          >
            <Symbol
              name={resolveSymbolIconName(ICON_REGISTRY.spray)}
              size={20}
              color={m3.colorScheme.tertiary}
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
              {t('sprayForm.title')}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: m3.surface.s500 }}>
              {t('sprayForm.subtitle')}
            </Text>
          </View>
        </View>
      )}

      <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.ADD_LOG_SPRAY_DETAILS}>
        <View
          style={{
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
          {/* Water Volume Input */}
          <NumericInput
            label={t('sprayForm.waterVolume.label')}
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
            {catalogMixes.length > 0 ? (
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
                  {catalogOnly
                    ? t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })
                    : t('sprayForm.catalogOptional.title', {
                        defaultValue: 'Catalog mix (optional)',
                      })}
                </Text>
                <Pressable
                  onPress={() => setShowCatalogMixPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedCatalogMix?.name ??
                    t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })
                  }
                  accessibilityState={{ expanded: showCatalogMixPicker }}
                  style={{
                    borderRadius: borderRadius.lg,
                    backgroundColor: m3.surface.s100,
                    borderWidth: 1,
                    borderColor: selectedCatalogMix ? m3.colorScheme.tertiary : m3.surface.s200,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: spacing[2] }}>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        color: selectedCatalogMix ? m3.surface.s900 : m3.surface.s500,
                      }}
                    >
                      {selectedCatalogMix?.name ??
                        t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                      {selectedCatalogMix?.target_problem ??
                        t('sprayForm.catalogOnly.fallbackLabel', {
                          defaultValue: 'Catalog mix',
                        })}
                    </Text>
                  </View>
                  <Symbol name="chevron.right" size={18} color={m3.surface.s600} />
                </Pressable>
                {selectedCatalogMix ? (
                  <Text
                    style={{
                      marginTop: spacing[2],
                      fontSize: fontSize.xs,
                      color: m3.surface.s600,
                    }}
                  >
                    {t('sprayForm.catalogOnly.selectedMix', {
                      defaultValue: 'Selected: {{name}}',
                      name: selectedCatalogMix.name,
                    })}
                  </Text>
                ) : (
                  <Text
                    style={{
                      marginTop: spacing[2],
                      fontSize: fontSize.xs,
                      color: m3.surface.s600,
                    }}
                  >
                    {catalogOnly
                      ? t('sprayForm.catalogOnly.requiredHint', {
                          defaultValue: 'Choose a catalog mix to continue',
                        })
                      : t('sprayForm.catalogOptional.hint', {
                          defaultValue: 'Optional: choose a catalog mix to enable PHI checks',
                        })}
                  </Text>
                )}
              </View>
            ) : null}

            {quickAddItems.length > 0 && !catalogOnly ? (
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
                  {t('sprayForm.quickAdd')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {quickAddItems.map((item, index) => (
                    <Pressable
                      key={`${item.name}-${item.unit ?? 'unit'}-${index}`}
                      onPress={() => addQuickChemical(item)}
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
                        {item.unit ?? 'gm/L'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
              <View style={{ marginRight: 6 }}>
                <Symbol name="flask" size={16} color={m3.primary.p600} />
              </View>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s800,
                }}
              >
                {t('sprayForm.chemicals.label')}{' '}
                <Text style={{ color: m3.colorScheme.error }}>*</Text>
              </Text>
            </View>

            {/* Chemicals List */}
            {data.chemicals.map((chemical, index) => (
              <ChemicalRow
                key={chemical.id}
                chemical={chemical}
                index={index}
                chemicalCount={data.chemicals.length}
                quickAddItems={quickAddItems}
                onUpdate={(updates) => updateChemical(chemical.id, updates)}
                onRemove={() => removeChemical(chemical.id)}
                showRemove={data.chemicals.length > 1}
                nameRef={chemicalRefs[index].name}
                quantityRef={chemicalRefs[index].quantity}
                onNextChemical={focusNextChemicalName}
                onInputFocus={onInputFocus}
                readOnly={catalogOnly}
              />
            ))}

            {/* Add Chemical Button */}
            {data.chemicals.length < 10 && !catalogOnly && (
              <Pressable
                onPress={addChemical}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing[3],
                  marginTop: spacing[2],
                }}
              >
                <Symbol name="plus.circle.fill" size={20} color={m3.colorScheme.tertiary} />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: m3.colorScheme.tertiary,
                    marginLeft: spacing[2],
                  }}
                >
                  {t('sprayForm.chemicals.addChemical')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </GuidedTourTarget>

      {/* Guided tour hint when not yet valid */}
      {showDetailsGuidance ? (
        <Text
          style={{
            marginTop: spacing[3],
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.primary,
          }}
        >
          {t('guidedTour.step2.fillSprayDetailsCoach', {
            defaultValue: 'Enter water volume and at least one chemical to continue.',
          })}
        </Text>
      ) : null}

      {/* Validation indicator */}
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
        <Symbol
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
          {isValid ? t('sprayForm.validation.ready') : t('sprayForm.validation.incomplete')}
        </Text>
      </View>

      <Modal
        visible={showCatalogMixPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCatalogMixPicker(false);
          setCatalogMixQuery('');
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.25),
            justifyContent: 'center',
            padding: spacing[4],
          }}
        >
          <View
            style={{
              borderRadius: borderRadius.xl,
              backgroundColor: m3.colorScheme.surface,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
              maxHeight: '80%',
            }}
          >
            <View
              style={{
                padding: spacing[4],
                borderBottomWidth: 1,
                borderBottomColor: m3.surface.s100,
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: m3.surface.s900,
                }}
              >
                {t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })}
              </Text>
              <TextInput
                value={catalogMixQuery}
                onChangeText={setCatalogMixQuery}
                accessibilityLabel={t('sprayForm.searchCatalogMix', {
                  defaultValue: 'Search catalog mix',
                })}
                placeholder={t('sprayForm.searchCatalogMix', {
                  defaultValue: 'Search catalog mix',
                })}
                placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
                style={{
                  marginTop: spacing[3],
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  borderColor: m3.surface.s200,
                  backgroundColor: m3.surface.s100,
                  color: m3.surface.s900,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[3],
                }}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredCatalogMixes.map((mix) => {
                const isSelected = selectedCatalogMix?.id === mix.id;
                return (
                  <Pressable
                    key={mix.id}
                    onPress={() => applyCatalogMix(mix)}
                    style={{
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      borderTopWidth: 1,
                      borderTopColor: m3.surface.s100,
                      backgroundColor: isSelected
                        ? colorWithOpacity(m3.colorScheme.tertiary, 0.08)
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        color: m3.surface.s900,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {mix.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                      {mix.target_problem ??
                        t('sprayForm.catalogOnly.fallbackLabel', {
                          defaultValue: 'Catalog mix',
                        })}
                    </Text>
                  </Pressable>
                );
              })}
              {filteredCatalogMixes.length === 0 ? (
                <Text
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[4],
                    fontSize: fontSize.sm,
                    color: m3.surface.s500,
                  }}
                >
                  {t('common.noResultsFound', { defaultValue: 'No results found' })}
                </Text>
              ) : null}
            </ScrollView>

            <View
              style={{
                padding: spacing[3],
                borderTopWidth: 1,
                borderTopColor: m3.surface.s100,
                alignItems: 'flex-end',
              }}
            >
              <Pressable
                onPress={() => {
                  setShowCatalogMixPicker(false);
                  setCatalogMixQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
                accessibilityHint={t('sprayForm.catalogOnly.closePickerHint', {
                  defaultValue: 'Closes the catalog mix picker',
                })}
                style={{
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                }}
              >
                <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
                  {t('common.close', { defaultValue: 'Close' })}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Chemical Row Component
interface ChemicalRowProps {
  chemical: ChemicalEntry;
  index: number;
  chemicalCount: number;
  quickAddItems: SprayQuickAddItem[];
  onUpdate: (updates: Partial<ChemicalEntry>) => void;
  onRemove: () => void;
  showRemove: boolean;
  nameRef: React.RefObject<TextInput | null>;
  quantityRef: React.RefObject<TextInput | null>;
  onNextChemical: (index: number) => void;
  onInputFocus?: TextInputProps['onFocus'];
  readOnly?: boolean;
}

function ChemicalRow({
  chemical,
  index,
  chemicalCount,
  quickAddItems,
  onUpdate,
  onRemove,
  showRemove,
  nameRef,
  quantityRef,
  onNextChemical,
  onInputFocus,
  readOnly = false,
}: ChemicalRowProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [quantityText, setQuantityText] = useState(
    chemical.quantity !== undefined && chemical.quantity > 0 ? chemical.quantity.toString() : '',
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);

  const nameSuggestions = useMemo(() => {
    const query = chemical.name.trim().toLowerCase();
    if (!query) return [];

    return quickAddItems
      .filter((item) => item.name.trim().toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }, [chemical.name, quickAddItems]);
  const showNoMatchHint =
    !readOnly && isNameFocused && chemical.name.trim().length >= 2 && nameSuggestions.length === 0;
  const shouldShowSuggestions =
    !readOnly && isNameFocused && chemical.name.trim().length >= 2 && nameSuggestions.length > 0;

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

  const applySuggestion = (item: SprayQuickAddItem) => {
    const unit = resolveChemicalUnit(item.unit, chemical.unit);
    onUpdate({
      name: item.name,
      unit,
      quantity: chemical.quantity ?? item.quantity ?? undefined,
      quantityBasis:
        chemical.quantityBasis ??
        resolveQuantityBasis(item.unit?.trim() ?? unit, item.quantityBasis),
      warehouseItemId: item.warehouseItemId ?? null,
      catalogProductId: item.catalogProductId ?? null,
      compositionSnapshot: item.composition ?? null,
      densityKgPerL: item.densityKgPerL ?? null,
    });
    if (chemical.quantity === undefined && item.quantity !== null && item.quantity !== undefined) {
      setQuantityText(item.quantity.toString());
    }
    quantityRef.current?.focus();
  };

  const handleUnitSelect = (unit: ChemicalUnit) => {
    // Preserve an explicitly chosen basis (e.g. a per-acre dose) rather than
    // silently forcing 'total' — that would undercount saved totals by the
    // acreage factor. When no basis is set yet, infer it from the unit string
    // ('…/acre' → per_acre, otherwise total), matching how prefills resolve it.
    onUpdate({ unit, quantityBasis: chemical.quantityBasis ?? resolveQuantityBasis(unit) });
  };

  return (
    <View
      style={{
        borderRadius: borderRadius.xl,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        backgroundColor: isRowComplete
          ? colorWithOpacity(m3.colorScheme.tertiary, 0.12)
          : m3.surface.s50,
        borderColor: isRowComplete ? colorWithOpacity(m3.colorScheme.tertiary, 0.3) : 'transparent',
      }}
    >
      {/* Chemical Name Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            ref={nameRef}
            style={{
              borderRadius: borderRadius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: 10,
              fontSize: fontSize.base,
              color: m3.surface.s900,
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: isNameFocused ? m3.colorScheme.tertiary : m3.surface.s200,
            }}
            placeholder={t('sprayForm.chemicals.namePlaceholder')}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            value={chemical.name}
            onChangeText={(name) => onUpdate({ name })}
            editable={!readOnly}
            onFocus={(event) => {
              if (readOnly) return;
              setIsNameFocused(true);
              onInputFocus?.(event);
            }}
            onBlur={() => setIsNameFocused(false)}
            onSubmitEditing={handleNameSubmit}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          {shouldShowSuggestions ? (
            <View
              style={{
                position: 'absolute',
                top: 52,
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                maxHeight: 208,
                overflow: 'hidden',
                zIndex: 20,
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
                      borderTopColor: m3.surface.s100,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.sm, color: m3.surface.s900 }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                      {item.quantity ? `${item.quantity} ` : ''}
                      {item.unit ?? 'gm/L'}
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
                color: m3.surface.s600,
              }}
            >
              {t('sprayForm.noMatchesHint')}
            </Text>
          ) : null}
        </View>
        {showRemove && !readOnly && (
          <Pressable
            onPress={onRemove}
            style={{ marginLeft: spacing[2], padding: spacing[2] }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Symbol
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
            borderColor: isQuantityFocused ? m3.colorScheme.tertiary : m3.surface.s200,
          }}
          placeholder={t('sprayForm.chemicals.qtyPlaceholder')}
          placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          editable={!readOnly}
          onFocus={(event) => {
            if (readOnly) return;
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
          disabled={readOnly}
          accessibilityState={{ disabled: readOnly }}
          onPress={() => (!readOnly ? setShowUnitPicker(true) : null)}
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
          <Text style={{ fontSize: fontSize.base, color: m3.surface.s900 }}>{chemical.unit}</Text>
          <Symbol name="chevron.right" size={18} color={m3.surface.s600} />
        </Pressable>
      </View>

      {!readOnly ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: spacing[2],
            gap: 8,
          }}
        >
          {QUICK_CHEMICAL_UNITS.map((unit) => {
            const selected = chemical.unit === unit;
            return (
              <Pressable
                key={unit}
                onPress={() => handleUnitSelect(unit)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('sprayForm.chemicals.quickUnitLabel', {
                  defaultValue: 'Use {{unit}} as chemical quantity unit',
                  unit,
                })}
                style={{
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  backgroundColor: selected
                    ? colorWithOpacity(m3.colorScheme.tertiary, 0.2)
                    : m3.surface.s100,
                  borderWidth: 1,
                  borderColor: selected
                    ? colorWithOpacity(m3.colorScheme.tertiary, 0.5)
                    : colorWithOpacity(m3.colorScheme.outline, 0.2),
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
                  {unit}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!readOnly ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[2], gap: 8 }}>
          <Pressable
            onPress={() => onUpdate({ quantityBasis: 'total' })}
            style={{
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              backgroundColor:
                (chemical.quantityBasis ?? 'total') === 'total'
                  ? colorWithOpacity(m3.colorScheme.tertiary, 0.2)
                  : m3.surface.s100,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
            }}
          >
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
              {t('sprayForm.chemicals.totalQty', { defaultValue: 'Total Qty' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onUpdate({ quantityBasis: 'per_acre' })}
            style={{
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              backgroundColor:
                chemical.quantityBasis === 'per_acre'
                  ? colorWithOpacity(m3.colorScheme.tertiary, 0.2)
                  : m3.surface.s100,
              borderWidth: 1,
              borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
            }}
          >
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
              {t('sprayForm.chemicals.perAcre', { defaultValue: 'Per acre' })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Unit Picker Modal */}
      <UnitPickerModal
        visible={!readOnly && showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={handleUnitSelect}
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
    catalogMixId: null,
    catalogMixName: null,
    governingPhiDays: null,
    safeHarvestDate: null,
    phiBlockingComponent: null,
    phiStatus: null,
    phiOverride: false,
    chemicals: [
      {
        id: generateId(),
        name: '',
        quantity: undefined,
        unit: 'gm/L',
        quantityBasis: 'total',
        warehouseItemId: null,
        catalogProductId: null,
        compositionSnapshot: null,
        densityKgPerL: null,
      },
    ],
  };
}
