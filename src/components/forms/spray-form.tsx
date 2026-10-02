import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol } from '@/components/ui/symbol';
import { SearchSelect } from '@/components/ui/search-select';
import {
  chemicalCatalogToOptions,
  planItemsToOptions,
  recentItemsToOptions,
  type SearchSelectOption,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { NumericInput, type NumericInputHandle } from './form-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import type { ChemicalUnit } from '../../constants/calculator-models';
import {
  DEFAULT_CHEMICAL_UNIT,
  resolveChemicalQuantityBasis,
  resolveChemicalUnit,
} from '@/constants/chemical-units';
import { toKernelSpelling } from '@/constants/unit-text';
import {
  MAX_PRODUCT_ROWS,
  allProductRowsComplete,
  isProductRowComplete,
  sanitizeQuantityInput,
} from './product-rows';
import { ProductTypeahead } from './product-typeahead';
import { QtyUnitField } from './qty-unit-field';
import {
  SPRAY_UNIT_CHIPS,
  SPRAY_UNIT_OVERFLOW_CHIPS,
  buildTankEcho,
  chipForEntry,
  sprayUnitChipByKey,
  type SprayUnitChip,
} from './spray-unit-chips';
import { evaluateDoseGuard, unitChipLabel, type DoseReference } from './product-dose';
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

const EMPTY_CATALOG_MIXES: ChemicalMix[] = [];
const EMPTY_HISTORY_ITEMS: RecentInputItem[] = [];
const EMPTY_PLAN_ITEMS: FertilizerPlanItem[] = [];
const EMPTY_SEARCH_OPTIONS: SearchSelectOption[] = [];

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
  return chemicals.slice(0, MAX_PRODUCT_ROWS);
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
  catalogOnly?: boolean;
  catalogMixes?: ChemicalMix[];
  /** This farm's recent spray items (identity-rich) for the typeahead's history section. */
  historyItems?: RecentInputItem[];
  /** This farm's active plan items for the typeahead's plan section. */
  planItems?: FertilizerPlanItem[];
  /** Farm area in acres — resolves per-acre doses into the tank echo. */
  areaAcres?: number | null;
  /** Hide the decorative header (inline log composer). */
  compact?: boolean;
  /** Hide the "Chemicals *" mini-header when the host supplies its own label. */
  showSectionHeader?: boolean;
  /** Hide the water-volume input when the host renders its own control. */
  showWaterInput?: boolean;
}

export function SprayForm({
  data,
  onChange,
  onInputFocus,
  catalogOnly = false,
  catalogMixes = EMPTY_CATALOG_MIXES,
  historyItems = EMPTY_HISTORY_ITEMS,
  planItems = EMPTY_PLAN_ITEMS,
  areaAcres = null,
  compact = false,
  showSectionHeader = true,
  showWaterInput = true,
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
    allProductRowsComplete(data.chemicals);
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
  // catalogOnly (delegated logging) keeps the modal mix picker; everyone else
  // picks through the row typeahead.
  const [showProductPicker, setShowProductPicker] = useState(false);
  // Which complete row is open for editing. Incomplete rows are always open;
  // complete rows collapse to receipt lines and re-open on tap — one at a time.
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
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
    if (data.chemicals.length <= MAX_PRODUCT_ROWS) return;
    const clamped = clampChemicalRows(data.chemicals);
    if (clamped.length === data.chemicals.length) return;
    onChangeRef.current({
      ...data,
      chemicals: clamped,
    });
  }, [data]);

  const addChemical = () => {
    if (data.chemicals.length >= MAX_PRODUCT_ROWS) return;
    const id = generateId();
    onChange({
      ...data,
      chemicals: clampChemicalRows([
        ...data.chemicals,
        {
          id,
          name: '',
          quantity: undefined,
          unit: DEFAULT_CHEMICAL_UNIT,
          quantityBasis: 'total',
          warehouseItemId: null,
          catalogProductId: null,
          planItemId: null,
          compositionSnapshot: null,
          densityKgPerL: null,
        },
      ]),
    });
    setEditingRowKey(id);
  };

  const updateChemical = (id: string, updates: Partial<ChemicalEntry>) => {
    const newChemicals = data.chemicals.map((c) => (c.id === id ? { ...c, ...updates } : c));
    onChange({ ...data, chemicals: clampChemicalRows(newChemicals) });
  };

  const removeChemical = (id: string) => {
    const newChemicals = data.chemicals.filter((c) => c.id !== id);
    onChange({ ...data, chemicals: clampChemicalRows(newChemicals) });
  };

  const applyCatalogMix = useCallback(
    (mix: ChemicalMix, replaceRowId?: string) => {
      // Rows the user actually entered survive a mix pick — only the triggering
      // row (whose name still holds the typeahead query) and pristine blank rows
      // are dropped. This is the "keep mine, add the mix" behaviour: picking a
      // mix into a fresh tank fills it, but picking one alongside custom rows
      // appends the mix's components instead of wiping the tank.
      const keptRows = dataRef.current.chemicals.filter(
        (c) => c.id !== replaceRowId && c.name.trim().length > 0,
      );
      const keptProductIds = new Set(
        keptRows.map((c) => c.catalogProductId).filter((id): id is number => id != null),
      );
      const keptNames = new Set(keptRows.map((c) => normalizeDedupeText(c.name)));

      const dedupeKeySet = new Set<string>();
      const mixChemicals = mix.components.flatMap((component) => {
        const perLiter = normalizeMixComponentToPerLiterDose(component);
        if (!perLiter) return [];
        // Skip a component already present as a kept custom row (same catalog
        // product, or same name) so a mix pick never duplicates the user's rows.
        if (
          (component.product_id != null && keptProductIds.has(component.product_id)) ||
          keptNames.has(normalizeDedupeText(component.product_name))
        ) {
          return [];
        }
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

      // Nothing new to add (empty mix, or every component already present): the
      // tank is just the retained rows, NOT this mix, so drop any prior mix
      // identity/PHI (stale otherwise — retained rows could inherit another
      // mix's safe-harvest date) and commit the cleaned rows so the triggering
      // row's stale typeahead query goes too.
      if (mixChemicals.length === 0) {
        const chemicals =
          keptRows.length > 0 ? clampChemicalRows(keptRows) : createEmptySprayFormData().chemicals;
        onChange({
          ...dataRef.current,
          catalogMixId: null,
          catalogMixName: null,
          governingPhiDays: null,
          safeHarvestDate: null,
          phiBlockingComponent: null,
          phiStatus: null,
          phiOverride: false,
          chemicals,
        });
        return;
      }

      const chemicals = clampChemicalRows([...keptRows, ...mixChemicals]);
      // Mix identity + PHI only hold when the tank IS exactly this mix. Combined
      // with custom rows, the mix's harvest-safety verdict can't vouch for the
      // extras, so drop the identity — the tank then reads as unverified (safe).
      const isPureMix = keptRows.length === 0;

      onChange({
        ...dataRef.current,
        catalogMixId: isPureMix ? mix.id : null,
        catalogMixName: isPureMix ? mix.name : null,
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

  // Whole-mix prefill: catalog mix rows, and history rows whose record was
  // logged as a catalog mix (record-level mix identity). Returns false when
  // the mix is not in the cached catalog so callers fall back to the
  // single-item prefill.
  const applyCatalogMixById = useCallback(
    (mixId: number, replaceRowId?: string): boolean => {
      const mix = catalogMixes.find((candidate) => candidate.id === mixId);
      if (!mix) return false;
      applyCatalogMix(mix, replaceRowId);
      return true;
    },
    [catalogMixes, applyCatalogMix],
  );

  // Removing the mix tag clears mix identity + PHI fields but keeps the
  // chemical rows — they are real entries the user may have edited.
  const clearCatalogMix = useCallback(() => {
    onChange({
      ...dataRef.current,
      catalogMixId: null,
      catalogMixName: null,
      governingPhiDays: null,
      safeHarvestDate: null,
      phiBlockingComponent: null,
      phiStatus: null,
      phiOverride: false,
    });
  }, [onChange]);

  // catalogOnly's modal picker offers mixes only (includeProducts: false,
  // allowCustom: false), so this handler never sees single items.
  const handleSearchSelection = useCallback(
    (selection: SearchSelectSelection) => {
      setShowProductPicker(false);
      if (selection.catalogMixId != null) applyCatalogMixById(selection.catalogMixId);
    },
    [applyCatalogMixById],
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
          {/* Water Volume Input — hidden when the host renders its own hero. */}
          {showWaterInput ? (
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
          ) : null}

          {/* Chemicals Section */}
          <View style={{ marginTop: spacing[2] }}>
            {catalogOnly && catalogMixes.length > 0 ? (
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
                  {t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })}
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
                    {t('sprayForm.catalogOnly.requiredHint', {
                      defaultValue: 'Choose a catalog mix to continue',
                    })}
                  </Text>
                )}
              </View>
            ) : null}

            {showSectionHeader ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}
              >
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
            ) : null}

            {/* Selected mix tag — mixes are picked through the row typeahead;
                the tag is the removable record of that pick (clears mix
                identity + PHI, keeps the chemical rows). */}
            {!catalogOnly && data.catalogMixId != null ? (
              <Pressable
                onPress={clearCatalogMix}
                accessibilityRole="button"
                accessibilityLabel={t('sprayForm.clearMix', {
                  defaultValue: 'Remove mix {{name}}',
                  name: selectedCatalogMix?.name ?? data.catalogMixName ?? '',
                })}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: borderRadius.full,
                  backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.14),
                  borderWidth: 1,
                  borderColor: colorWithOpacity(m3.colorScheme.tertiary, 0.4),
                  marginBottom: spacing[3],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.tertiary,
                  }}
                >
                  {selectedCatalogMix?.name ?? data.catalogMixName ?? ''}
                </Text>
                <Symbol name="xmark.circle.fill" size={16} color={m3.colorScheme.tertiary} />
              </Pressable>
            ) : null}

            {/* Chemicals List — complete rows collapse to receipt lines; the
                tapped (or newly added) row expands for editing, one at a time. */}
            {data.chemicals.map((chemical, index) => (
              <ChemicalRow
                key={chemical.id}
                chemical={chemical}
                index={index}
                chemicalCount={data.chemicals.length}
                onUpdate={(updates) => updateChemical(chemical.id, updates)}
                onRemove={() => removeChemical(chemical.id)}
                expanded={!isProductRowComplete(chemical) || editingRowKey === chemical.id}
                onExpand={() => setEditingRowKey(chemical.id)}
                nameRef={chemicalRefs[index].name}
                quantityRef={chemicalRefs[index].quantity}
                onNextChemical={focusNextChemicalName}
                onInputFocus={onInputFocus}
                readOnly={catalogOnly}
                waterLiters={data.waterVolume ?? null}
                areaAcres={areaAcres}
                historyItems={historyItems}
                planItems={planItems}
                historyOptions={historyOptions}
                planOptions={planOptions}
                catalogOptions={catalogOptions}
                onMixPick={applyCatalogMixById}
                lastUsedChipFor={lastUsedChipFor}
              />
            ))}

            {/* Add Chemical — appends a blank editing row; its name field's
                typeahead is the picker now (history / plan / catalog / custom). */}
            {data.chemicals.length < MAX_PRODUCT_ROWS && !catalogOnly && (
              <Pressable
                onPress={addChemical}
                accessibilityRole="button"
                accessibilityLabel={t('sprayForm.chemicals.addChemical')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: spacing[3],
                  marginTop: spacing[2],
                  borderRadius: borderRadius.xl,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: m3.surface.s300,
                }}
              >
                <Symbol name="plus.circle.fill" size={20} color={m3.colorScheme.tertiary} />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
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

      {/* Validation indicator (full composer only — the sheet's Save button
          disabled state carries this in compact mode). */}
      {!compact ? (
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
      ) : null}

      {/* Modal mix picker — catalogOnly (delegated logging) only. */}
      {catalogOnly ? (
        <SearchSelect
          visible={showProductPicker}
          onClose={() => setShowProductPicker(false)}
          onSelect={handleSearchSelection}
          historyOptions={historyOptions}
          planOptions={planOptions}
          catalogOptions={catalogOptions}
          allowCustom={false}
          title={t('sprayForm.catalogOnly.title', { defaultValue: 'Select catalog mix' })}
        />
      ) : null}
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
  /** Complete rows render as receipt lines when false; tap re-opens editing. */
  expanded: boolean;
  onExpand: () => void;
  nameRef: React.RefObject<TextInput | null>;
  quantityRef: React.RefObject<TextInput | null>;
  onNextChemical: (index: number) => void;
  onInputFocus?: TextInputProps['onFocus'];
  readOnly?: boolean;
  waterLiters?: number | null;
  areaAcres?: number | null;
  historyItems?: RecentInputItem[];
  planItems?: FertilizerPlanItem[];
  /** Typeahead sections (built once at form level). */
  historyOptions?: SearchSelectOption[];
  planOptions?: SearchSelectOption[];
  catalogOptions?: SearchSelectOption[];
  /**
   * Whole-mix restore; returns false when the mix is not in the cached catalog.
   * `replaceRowId` is the row that triggered the pick — dropped so its in-progress
   * query text isn't kept as a stray custom row alongside the mix's components.
   */
  onMixPick: (mixId: number, replaceRowId?: string) => boolean;
  /** Resolves a product's last-used chip — owned by SprayForm (one subscription). */
  lastUsedChipFor: (name: string, catalogProductId?: number | null) => SprayUnitChip | null;
}

function ChemicalRow({
  chemical,
  index,
  chemicalCount,
  onUpdate,
  onRemove,
  expanded,
  onExpand,
  nameRef,
  quantityRef,
  onNextChemical,
  onInputFocus,
  readOnly = false,
  waterLiters = null,
  areaAcres = null,
  historyItems = EMPTY_HISTORY_ITEMS,
  planItems = EMPTY_PLAN_ITEMS,
  historyOptions = EMPTY_SEARCH_OPTIONS,
  planOptions = EMPTY_SEARCH_OPTIONS,
  catalogOptions = EMPTY_SEARCH_OPTIONS,
  onMixPick,
  lastUsedChipFor,
}: ChemicalRowProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [quantityText, setQuantityText] = useState(
    chemical.quantity !== undefined && chemical.quantity > 0 ? chemical.quantity.toString() : '',
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  // Reads route through the parent's lastUsedChipFor; only the write (recording
  // a chip selection) is local — that keeps one store subscription, in SprayForm.
  const setLastUsedChip = useSprayUnitStore((s) => s.setLastUsedChip);

  const activeChip = chipForEntry(chemical.unit, chemical.quantityBasis);
  // Display text follows the shared resolution rule (localized labelKey over
  // label over key — "kg (total)" renders in the unit segment and the
  // collapsed receipt line); the stable key still drives
  // selection/persistence behind the scenes.
  const unitLabel = unitChipLabel(activeChip, t, chemical.unit);

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
      unit: toKernelSpelling(planItem.unit),
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
      unit: toKernelSpelling(match.unit),
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

  const showTypeahead = !readOnly && isNameFocused && chemical.name.trim().length >= 1;

  const handleQuantityChange = (text: string) => {
    const { text: sanitizedText, quantity } = sanitizeQuantityInput(text);
    setQuantityText(sanitizedText);
    onUpdate({ quantity });
  };

  const isRowComplete = isProductRowComplete(chemical);

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
    // Suggestions without a unit of their own fall back to the product's
    // last-used chip before inheriting the row's current unit.
    const lastUsed = item.unit?.trim() ? null : lastUsedChipFor(item.name, item.catalogProductId);
    const unit = lastUsed?.unit ?? resolveChemicalUnit(item.unit, chemical.unit);
    onUpdate({
      name: item.name,
      unit,
      quantity: chemical.quantity ?? item.quantity ?? undefined,
      quantityBasis:
        item.quantityBasis ??
        lastUsed?.basis ??
        chemical.quantityBasis ??
        resolveChemicalQuantityBasis(item.unit?.trim() ?? unit),
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

  // Typeahead pick → whole-mix restore when the selection carries mix
  // identity (catalog mixes AND history rows logged as a mix), else the
  // single-item fill path shared with suggestions.
  const handleTypeaheadSelect = (selection: SearchSelectSelection) => {
    if (selection.catalogMixId != null && onMixPick(selection.catalogMixId, chemical.id)) return;
    if (selection.kind === 'mix') return;
    applySuggestion({
      name: selection.name,
      unit: selection.prefill?.unit,
      quantity: selection.prefill?.quantity,
      // Resolve the basis from the original unit string ('kg/acre' → per_acre)
      // before resolveChemicalUnit collapses it to a bare scale.
      quantityBasis:
        selection.prefill?.quantityBasis ?? resolveChemicalQuantityBasis(selection.prefill?.unit),
      warehouseItemId: selection.warehouseItemId ?? null,
      catalogProductId: selection.catalogProductId ?? null,
      planItemId: selection.planItemId ?? null,
      // No spray option builder sets composition today; forwarded anyway so
      // spray and fertigation stamp identically when one ever does.
      composition: selection.composition ?? null,
    });
  };

  const handleNameChange = (name: string) => {
    const updates: Partial<ChemicalEntry> = { name };
    // Typed products preselect their last-used chip while the row is still
    // pristine (no dose entered yet) — never fights an entered quantity.
    if (chemical.quantity === undefined) {
      const lastUsed = lastUsedChipFor(name, null);
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

  // Collapsed receipt line — tap anywhere to re-open for editing (readOnly
  // rows stay receipts: delegated mixes are not editable).
  if (!expanded) {
    const echoSuffix = tankEcho ? ` · ≈ ${tankEcho.totalText}` : '';
    return (
      <Pressable
        onPress={readOnly ? undefined : onExpand}
        disabled={readOnly}
        accessibilityRole="button"
        accessibilityLabel={chemical.name}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          borderRadius: borderRadius.xl,
          padding: spacing[3],
          marginBottom: spacing[3],
          borderWidth: 1,
          backgroundColor: m3.surface.s50,
          borderColor: m3.surface.s200,
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: borderRadius.full,
            backgroundColor: m3.colorScheme.tertiary,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.bold,
              color: m3.surface.s900,
            }}
          >
            {chemical.name}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s600, marginTop: 1 }}>
            {`${chemical.quantity ?? 0} ${unitLabel}${echoSuffix}`}
          </Text>
        </View>
        {!readOnly ? (
          <Pressable onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Symbol
              name="minus.circle.fill"
              size={22}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
            />
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

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

          {showTypeahead ? (
            <ProductTypeahead
              query={chemical.name}
              history={historyOptions}
              plan={planOptions}
              catalog={catalogOptions}
              onSelect={handleTypeaheadSelect}
              accentColor={m3.colorScheme.tertiary}
            />
          ) : null}
        </View>
        {!readOnly && (
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

      {/* Fused quantity + unit input — the unit segment opens the unit menu. */}
      <View style={{ marginTop: spacing[2] }}>
        <QtyUnitField
          value={quantityText}
          onChangeText={handleQuantityChange}
          unitLabel={unitLabel}
          onUnitPress={() => setShowUnitPicker(true)}
          accentColor={m3.colorScheme.tertiary}
          placeholder={t('sprayForm.chemicals.qtyPlaceholder')}
          editable={!readOnly}
          inputRef={quantityRef}
          onFocus={(event) => {
            if (readOnly) return;
            onInputFocus?.(event);
          }}
          onSubmitEditing={handleQuantitySubmit}
          returnKeyType={index < chemicalCount - 1 ? 'next' : 'done'}
          blurOnSubmit={index >= chemicalCount - 1}
          unitAccessibilityLabel={t('sprayForm.chemicals.selectUnit')}
        />
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

      {/* Unit menu: common chips first (g/L · mL/L · g/acre · mL/acre · ppm),
          then the rare total/per-acre shapes. */}
      <UnitPickerModal
        visible={!readOnly && showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(key) => {
          const chip = sprayUnitChipByKey(key);
          if (chip) handleChipSelect(chip);
        }}
        selectedValue={activeChip?.key ?? ''}
        options={[...SPRAY_UNIT_CHIPS, ...SPRAY_UNIT_OVERFLOW_CHIPS].map((chip) => chip.key)}
        getLabel={(key) => unitChipLabel(sprayUnitChipByKey(key), t, key)}
        getHint={(key) => {
          const hintKey = sprayUnitChipByKey(key)?.hintKey;
          return hintKey ? t(hintKey) : undefined;
        }}
        title={t('sprayForm.chemicals.selectUnit')}
      />
    </View>
  );
}

export function validateSprayForm(data: SprayFormData): boolean {
  return (
    data.waterVolume !== undefined && data.waterVolume > 0 && allProductRowsComplete(data.chemicals)
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
        unit: DEFAULT_CHEMICAL_UNIT,
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

/**
 * Finalize a spray draft for submission. PHI fields are only trusted on a
 * grape farm with a verified catalog-mix computation; otherwise they are
 * cleared and the status downgraded, so a stale computation from a previous
 * date/mix never rides along on the saved record.
 */
export function finalizeSprayFormData(input: SprayFormData, isGrapeFarm: boolean): SprayFormData {
  return isGrapeFarm &&
    input.catalogMixId &&
    input.safeHarvestDate &&
    input.governingPhiDays != null
    ? { ...input }
    : {
        ...input,
        governingPhiDays: null,
        safeHarvestDate: null,
        phiBlockingComponent: null,
        phiStatus: input.phiStatus ?? (input.catalogMixId ? 'legacy_unverified' : 'unknown'),
      };
}
