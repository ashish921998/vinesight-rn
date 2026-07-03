import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, type TextInputProps } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { SearchSelect } from '@/components/ui/search-select';
import {
  chemicalCatalogToOptions,
  planItemsToOptions,
  recentItemsToOptions,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import { CHEMICAL_UNITS, type ChemicalUnit } from '../../constants/calculator-models';
import {
  SPRAY_UNIT_CHIPS,
  SPRAY_UNIT_OVERFLOW_CHIPS,
  buildTankEcho,
  chipForEntry,
  evaluateDoseGuard,
  sprayUnitChipByKey,
  type DoseReference,
  type SprayUnitChip,
} from './spray-unit-chips';
import { sprayProductKey, useSprayUnitStore } from '@/stores/spray-unit-store';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import type { NutrientCompositionItem, QuantityBasis } from '@/types';
import type { ChemicalMix } from '@/types/phi';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
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
  /** Set when this row was picked from an active plan item (uuid). */
  planItemId?: string | null;
  compositionSnapshot?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

const DEFAULT_CHEMICAL_UNIT: ChemicalUnit = 'gm/L';
const MAX_CHEMICAL_ROWS = 10;

function isChemicalUnit(value: string): value is ChemicalUnit {
  return CHEMICAL_UNITS.includes(value as ChemicalUnit);
}

/**
 * Fold freeform unit spellings into the canonical `<base>/<denominator>` shape
 * before matching: `'Kg per Acre'` / `'kg / acre'` → `'kg/acre'`. `per` needs
 * whitespace on both sides so product names ("copper") can never match.
 */
function foldUnitText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+per\s+/g, '/')
    .replace(/\s*\/\s*/g, '/');
}

function resolveChemicalUnit(
  unit: string | null | undefined,
  fallback: ChemicalUnit = DEFAULT_CHEMICAL_UNIT,
): ChemicalUnit {
  const normalized = unit?.trim();
  const lowered = normalized ? foldUnitText(normalized) : undefined;
  if (lowered === 'gm/liter' || lowered === 'gm/litre' || lowered === 'gm/l' || lowered === 'g/l') {
    return 'gm/L';
  }
  if (lowered === 'ml/liter' || lowered === 'ml/litre' || lowered === 'ml/l') {
    return 'ml/L';
  }
  if (lowered === 'gm/acre' || lowered === 'g/acre' || lowered === 'gram/acre') return 'gram';
  if (lowered === 'ml/acre') return 'ml';
  // Plan-item spellings: the per-acre basis survives via resolveQuantityBasis
  // on the original string, so only the scale maps here (like gm/ml above).
  if (lowered === 'kg/acre') return 'kg';
  if (lowered === 'liter/acre' || lowered === 'litre/acre' || lowered === 'l/acre') return 'liter';
  if (normalized && isChemicalUnit(normalized)) return normalized;
  return fallback;
}

function resolveQuantityBasis(
  unit: string | null | undefined,
  basis?: QuantityBasis,
): QuantityBasis {
  if (basis) return basis;
  if (!unit?.trim()) return 'total';
  // Word-boundary matched (like #192's unitTextSaysPerAcre) so '/acreage'
  // can never false-positive; plural '/acres' still counts.
  return /\/acres?\b/.test(foldUnitText(unit)) ? 'per_acre' : 'total';
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
  planItemId?: string | null;
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
  /** This farm's recent spray items (identity-rich) for the picker's history section. */
  historyItems?: RecentInputItem[];
  /** This farm's active plan items for the picker's plan section. */
  planItems?: FertilizerPlanItem[];
  /** Farm area in acres — resolves per-acre doses into the tank echo. */
  areaAcres?: number | null;
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
  historyItems = [],
  planItems = [],
  areaAcres = null,
  compact = false,
}: SprayFormProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const lastUsedChips = useSprayUnitStore((s) => s.lastUsedChips);
  const lastUsedChipFor = useCallback(
    (name: string, catalogProductId?: number | null): SprayUnitChip | null => {
      const productKey = sprayProductKey(name, catalogProductId);
      return sprayUnitChipByKey(productKey ? lastUsedChips[productKey] : null);
    },
    [lastUsedChips],
  );
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
  const [showProductPicker, setShowProductPicker] = useState(false);
  const selectedCatalogMix = useMemo(
    () => catalogMixes.find((mix) => mix.id === data.catalogMixId) ?? null,
    [catalogMixes, data.catalogMixId],
  );
  // Picker sections. Catalog-only mode (delegated logging) restricts the picker
  // to catalog mixes — no history/plan prefills, no custom escape hatch.
  const historyOptions = useMemo(
    () =>
      catalogOnly ? [] : recentItemsToOptions(historyItems, { mixLabel: t('searchSelect.mixTag') }),
    [catalogOnly, historyItems, t],
  );
  const planOptions = useMemo(
    () => (catalogOnly ? [] : planItemsToOptions(planItems)),
    [catalogOnly, planItems],
  );
  const catalogOptions = useMemo(
    () => chemicalCatalogToOptions(catalogMixes, { includeProducts: !catalogOnly }),
    [catalogMixes, catalogOnly],
  );
  const hasPickerOptions =
    historyOptions.length > 0 || planOptions.length > 0 || catalogOptions.length > 0;

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
            planItemId: null,
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

  const addQuickChemical = useCallback(
    (item: SprayQuickAddItem) => {
      // Items with no unit of their own default to the product's last-used
      // chip (per-product persistence, issue #194) before the g/L fallback.
      const lastUsed = item.unit?.trim() ? null : lastUsedChipFor(item.name, item.catalogProductId);
      const validatedUnit = lastUsed?.unit ?? resolveChemicalUnit(item.unit);
      const normalizedName = item.name.trim().toLowerCase();
      // Duplicate identity is the fused chip (unit + basis), not the unit
      // string alone — 'kg total' and 'kg/acre' share unit 'kg' but are
      // distinct entries. Rows outside the chip vocabulary fall back to the
      // unit string.
      const incomingBasis =
        item.quantityBasis ??
        lastUsed?.basis ??
        resolveQuantityBasis(item.unit?.trim() ?? validatedUnit);
      const incomingChipKey = chipForEntry(validatedUnit, incomingBasis)?.key ?? validatedUnit;
      const alreadyExists = data.chemicals.some(
        (chemical) =>
          chemical.name.trim().toLowerCase() === normalizedName &&
          (chipForEntry(chemical.unit, chemical.quantityBasis)?.key ?? chemical.unit) ===
            incomingChipKey,
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
          // An explicit item basis (fully-prefilled picker selections) wins over
          // the pristine row's default 'total'; legacy quick-add producers never
          // set one, so their behavior is unchanged. The last-used chip's basis
          // only applies when the item brought no unit at all.
          quantityBasis:
            item.quantityBasis ??
            lastUsed?.basis ??
            current.quantityBasis ??
            resolveQuantityBasis(item.unit?.trim() ?? validatedUnit),
          warehouseItemId: item.warehouseItemId ?? null,
          catalogProductId: item.catalogProductId ?? null,
          planItemId: item.planItemId ?? null,
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
              item.quantityBasis ?? lastUsed?.basis,
            ),
            warehouseItemId: item.warehouseItemId ?? null,
            catalogProductId: item.catalogProductId ?? null,
            planItemId: item.planItemId ?? null,
            compositionSnapshot: item.composition ?? null,
            densityKgPerL: item.densityKgPerL ?? null,
          },
        ]),
      });
    },
    [data, onChange, lastUsedChipFor],
  );

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
          planItemId: null,
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
    },
    [onChange],
  );

  const handleSearchSelection = useCallback(
    (selection: SearchSelectSelection) => {
      setShowProductPicker(false);
      // Whole-mix prefill: catalog mix rows, and history rows whose record was
      // logged as a catalog mix (record-level mix identity). Falls back to the
      // single-item prefill when the mix is not in the cached catalog.
      const mix =
        selection.catalogMixId != null
          ? (catalogMixes.find((candidate) => candidate.id === selection.catalogMixId) ?? null)
          : null;
      if (mix) {
        applyCatalogMix(mix);
        return;
      }
      if (selection.kind === 'mix') return;
      addQuickChemical({
        name: selection.name,
        unit: selection.prefill?.unit,
        quantity: selection.prefill?.quantity,
        // Resolve the basis from the original unit string ('kg/acre' → per_acre)
        // before resolveChemicalUnit collapses it to a bare scale.
        quantityBasis:
          selection.prefill?.quantityBasis ?? resolveQuantityBasis(selection.prefill?.unit),
        warehouseItemId: selection.warehouseItemId ?? null,
        catalogProductId: selection.catalogProductId ?? null,
        planItemId: selection.planItemId ?? null,
      });
    },
    [catalogMixes, applyCatalogMix, addQuickChemical],
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
                  onPress={() => setShowProductPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedCatalogMix?.name ??
                    t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })
                  }
                  accessibilityState={{ expanded: showProductPicker }}
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
                waterLiters={data.waterVolume ?? null}
                areaAcres={areaAcres}
                historyItems={historyItems}
                planItems={planItems}
              />
            ))}

            {/* Add Chemical Button — opens the sectioned product picker when
                there is anything to pick from; falls back to a blank row. */}
            {data.chemicals.length < 10 && !catalogOnly && (
              <Pressable
                onPress={() => (hasPickerOptions ? setShowProductPicker(true) : addChemical())}
                accessibilityRole="button"
                accessibilityLabel={t('sprayForm.chemicals.addChemical')}
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

      <SearchSelect
        visible={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={handleSearchSelection}
        historyOptions={historyOptions}
        planOptions={planOptions}
        catalogOptions={catalogOptions}
        allowCustom={!catalogOnly}
        title={
          catalogOnly
            ? t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })
            : t('sprayForm.chemicals.addChemical')
        }
      />
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
  waterLiters?: number | null;
  areaAcres?: number | null;
  historyItems?: RecentInputItem[];
  planItems?: FertilizerPlanItem[];
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
  waterLiters = null,
  areaAcres = null,
  historyItems = [],
  planItems = [],
}: ChemicalRowProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [quantityText, setQuantityText] = useState(
    chemical.quantity !== undefined && chemical.quantity > 0 ? chemical.quantity.toString() : '',
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isQuantityFocused, setIsQuantityFocused] = useState(false);
  const lastUsedChips = useSprayUnitStore((s) => s.lastUsedChips);
  const setLastUsedChip = useSprayUnitStore((s) => s.setLastUsedChip);

  const activeChip = chipForEntry(chemical.unit, chemical.quantityBasis);
  const activeOverflowChip = SPRAY_UNIT_OVERFLOW_CHIPS.find((chip) => chip.key === activeChip?.key);
  const unitLabel = activeChip?.key ?? chemical.unit;

  const tankEcho = useMemo(
    () => buildTankEcho(chemical, { waterLiters, areaAcres }),
    [chemical, waterLiters, areaAcres],
  );

  // Guardrail references are strictly independent of the entry: the linked
  // plan item's dose, else the most recent prior log of the same product.
  // The tank echo derives from the same entry and is never a trigger.
  const planReference = useMemo<DoseReference | null>(() => {
    if (!chemical.planItemId) return null;
    const planItem = planItems.find((item) => item.id === chemical.planItemId);
    if (!planItem?.unit || planItem.quantity == null || planItem.quantity <= 0) return null;
    // Plan doses are per-acre rates by contract; slashed unit spellings carry
    // their own basis and win inside the kernel regardless.
    return {
      quantity: planItem.quantity,
      unit: foldUnitText(planItem.unit),
      quantityBasis: 'per_acre',
    };
  }, [chemical.planItemId, planItems]);

  const historyReference = useMemo<DoseReference | null>(() => {
    const nameKey = chemical.name.trim().toLowerCase();
    if (!nameKey && chemical.catalogProductId == null) return null;
    const match = historyItems.find((item) =>
      chemical.catalogProductId != null && item.catalogProductId != null
        ? item.catalogProductId === chemical.catalogProductId
        : item.name.trim().toLowerCase() === nameKey,
    );
    if (!match || match.quantity == null || match.quantity <= 0) return null;
    return {
      quantity: match.quantity,
      unit: foldUnitText(match.unit),
      quantityBasis: match.quantityBasis ?? null,
    };
  }, [chemical.name, chemical.catalogProductId, historyItems]);

  const doseWarning = useMemo(
    () =>
      evaluateDoseGuard(
        chemical,
        { plan: planReference, history: historyReference },
        { waterLiters, areaAcres },
      ),
    [chemical, planReference, historyReference, waterLiters, areaAcres],
  );

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

  const lastUsedChipForRow = (name: string, catalogProductId?: number | null) => {
    const productKey = sprayProductKey(name, catalogProductId);
    return sprayUnitChipByKey(productKey ? lastUsedChips[productKey] : null);
  };

  const applySuggestion = (item: SprayQuickAddItem) => {
    // Suggestions without a unit of their own fall back to the product's
    // last-used chip before inheriting the row's current unit.
    const lastUsed = item.unit?.trim()
      ? null
      : lastUsedChipForRow(item.name, item.catalogProductId);
    const unit = lastUsed?.unit ?? resolveChemicalUnit(item.unit, chemical.unit);
    onUpdate({
      name: item.name,
      unit,
      quantity: chemical.quantity ?? item.quantity ?? undefined,
      quantityBasis:
        item.quantityBasis ??
        lastUsed?.basis ??
        chemical.quantityBasis ??
        resolveQuantityBasis(item.unit?.trim() ?? unit),
      warehouseItemId: item.warehouseItemId ?? null,
      catalogProductId: item.catalogProductId ?? null,
      planItemId: item.planItemId ?? null,
      compositionSnapshot: item.composition ?? null,
      densityKgPerL: item.densityKgPerL ?? null,
    });
    if (chemical.quantity === undefined && item.quantity !== null && item.quantity !== undefined) {
      setQuantityText(item.quantity.toString());
    }
    quantityRef.current?.focus();
  };

  const handleNameChange = (name: string) => {
    const updates: Partial<ChemicalEntry> = { name };
    // Typed products preselect their last-used chip while the row is still
    // pristine (no dose entered yet) — never fights an entered quantity.
    if (chemical.quantity === undefined) {
      const lastUsed = lastUsedChipForRow(name, null);
      if (lastUsed) {
        updates.unit = lastUsed.unit;
        updates.quantityBasis = lastUsed.basis;
      }
    }
    onUpdate(updates);
  };

  const handleChipSelect = (chip: SprayUnitChip) => {
    // The chip is the single source of unit + basis — no separate toggle.
    onUpdate({ unit: chip.unit, quantityBasis: chip.basis });
    const productKey = sprayProductKey(chemical.name, chemical.catalogProductId);
    if (productKey) setLastUsedChip(productKey, chip.key);
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
            onChangeText={handleNameChange}
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

        {/* Current unit label — the chips below are the only way to change it. */}
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderRadius: borderRadius.lg,
            paddingHorizontal: spacing[3],
            paddingVertical: 10,
            marginLeft: spacing[2],
            borderWidth: 1,
            borderColor: m3.surface.s200,
          }}
        >
          <Text style={{ fontSize: fontSize.base, color: m3.surface.s900 }}>{unitLabel}</Text>
        </View>
      </View>

      {/* Live tank echo — the entered rate resolved into tank reality. */}
      {tankEcho ? (
        <Text
          style={{
            marginTop: spacing[1],
            marginLeft: spacing[1],
            fontSize: fontSize.xs,
            color: m3.surface.s600,
          }}
        >
          {tankEcho.kind === 'water'
            ? t('sprayForm.chemicals.tankEcho.water', {
                defaultValue: '{{quantity}} {{unit}} × {{water}} L = {{total}} in tank',
                quantity: chemical.quantity,
                unit: unitLabel,
                water: tankEcho.contextValue,
                total: tankEcho.totalText,
              })
            : t('sprayForm.chemicals.tankEcho.area', {
                defaultValue: '{{quantity}} {{unit}} × {{area}} acre = {{total}} in tank',
                quantity: chemical.quantity,
                unit: unitLabel,
                area: tankEcho.contextValue,
                total: tankEcho.totalText,
              })}
        </Text>
      ) : null}

      {/* Non-blocking dose guardrail — plan/prior-log deviation only. */}
      {doseWarning ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginTop: spacing[2],
            gap: 6,
          }}
        >
          <Symbol name="exclamationmark.triangle.fill" size={14} color={m3.colorScheme.warning} />
          <Text style={{ flex: 1, fontSize: fontSize.xs, color: m3.colorScheme.warning }}>
            {t(
              `sprayForm.chemicals.doseGuard.${doseWarning.direction}${
                doseWarning.source === 'plan' ? 'Plan' : 'LastLog'
              }`,
              {
                ratio: doseWarning.ratio,
                reference: `${doseWarning.reference.quantity} ${doseWarning.reference.unit}`,
              },
            )}
          </Text>
        </View>
      ) : null}

      {/* Basis-fused unit chips: g/L · mL/L · g/acre · mL/acre · ppm + overflow. */}
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
          {SPRAY_UNIT_CHIPS.map((chip) => {
            const selected = activeChip?.key === chip.key;
            return (
              <Pressable
                key={chip.key}
                onPress={() => handleChipSelect(chip)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={t('sprayForm.chemicals.quickUnitLabel', {
                  defaultValue: 'Use {{unit}} as chemical quantity unit',
                  unit: chip.key,
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
                  {chip.key}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowUnitPicker(true)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeOverflowChip !== undefined }}
            accessibilityLabel={t('sprayForm.chemicals.moreUnits', { defaultValue: 'More units' })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: borderRadius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              backgroundColor: activeOverflowChip
                ? colorWithOpacity(m3.colorScheme.tertiary, 0.2)
                : m3.surface.s100,
              borderWidth: 1,
              borderColor: activeOverflowChip
                ? colorWithOpacity(m3.colorScheme.tertiary, 0.5)
                : colorWithOpacity(m3.colorScheme.outline, 0.2),
            }}
          >
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s800, fontWeight: '600' }}>
              {activeOverflowChip?.key ??
                t('sprayForm.chemicals.moreUnits', { defaultValue: 'More units' })}
            </Text>
            <Symbol name="chevron.down" size={12} color={m3.surface.s600} />
          </Pressable>
        </View>
      ) : null}

      {/* Overflow menu: rare total/per-acre shapes. */}
      <UnitPickerModal
        visible={!readOnly && showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(key) => {
          const chip = SPRAY_UNIT_OVERFLOW_CHIPS.find((candidate) => candidate.key === key);
          if (chip) handleChipSelect(chip);
        }}
        selectedValue={activeOverflowChip?.key ?? ''}
        options={SPRAY_UNIT_OVERFLOW_CHIPS.map((chip) => chip.key)}
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
        planItemId: null,
        compositionSnapshot: null,
        densityKgPerL: null,
      },
    ],
  };
}
