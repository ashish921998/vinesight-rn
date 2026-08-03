import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, Pressable, TextInput, type TextInputProps } from 'react-native';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import {
  fertigationPlanItemsToOptions,
  fertilizerCatalogToOptions,
  recentItemsToOptions,
  type SearchSelectOption,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import {
  MAX_PRODUCT_ROWS,
  allProductRowsComplete,
  isProductRowComplete,
  sanitizeQuantityInput,
} from './product-rows';
import { ProductTypeahead } from './product-typeahead';
import { QtyUnitField } from './qty-unit-field';
import { UnitPickerModal } from '../ui/unit-picker-modal';
import type { FertilizerUnit } from '../../constants/calculator-models';
import { resolveFertigationUnit } from '@/constants/fertilizer-units';
import { resolveVerbatimQuantityBasis, toKernelSpelling } from '@/constants/unit-text';
import {
  FERTIGATION_UNIT_CHIPS,
  FERTIGATION_UNIT_OVERFLOW_CHIPS,
  buildFertigationAreaEcho,
  fertigationChipForEntry,
  fertigationUnitChipByKey,
  type FertigationUnitChip,
} from './fertigation-unit-chips';
import {
  evaluateDoseGuard,
  evaluateDoseGuidanceGuard,
  type DoseReference,
  type DoseGuidanceReference,
} from './product-dose';
import { isWaterConcentrationUnit } from '@/lib/quantity';
import { telemetry } from '@/services/telemetry';
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

const EMPTY_HISTORY_ITEMS: RecentInputItem[] = [];
const EMPTY_PLAN_ITEMS: FertilizerPlanItem[] = [];
const EMPTY_CATALOG_PRODUCTS: MasterCatalogProduct[] = [];
const EMPTY_SEARCH_OPTIONS: SearchSelectOption[] = [];

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

function generateRowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * resolveFertigationUnit collapses 'kg/acre' → bare 'kg' + basisFromUnit;
 * the string's per-acre testimony must survive that collapse and beat the
 * row's current basis. basisFromUnit === 'total' is NOT testimony — bare
 * units are basis-neutral in the kernel — so only per_acre short-circuits.
 */
function perAcreUnitTestimony(basisFromUnit?: QuantityBasis): QuantityBasis | undefined {
  return basisFromUnit === 'per_acre' ? 'per_acre' : undefined;
}

export interface FertigationFormData {
  fertilizers: FertilizerEntry[];
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
  /** This farm's recent fertigation items (identity-rich) for the typeahead's history section. */
  historyItems?: RecentInputItem[];
  /** This farm's active plan items for the typeahead's plan section. */
  planItems?: FertilizerPlanItem[];
  /** Master fertilizer catalog products for the typeahead's catalog section. */
  catalogProducts?: MasterCatalogProduct[];
  /** Farm area in acres — powers the bidirectional per-acre ↔ total echo. */
  areaAcres?: number | null;
  /** Hide the decorative header + summary/validation chrome (inline log composer). */
  compact?: boolean;
  /** Hide the "Fertilizers *" mini-header when the host supplies its own label. */
  showSectionHeader?: boolean;
}

export function FertigationForm({
  data,
  onChange,
  onInputFocus,
  historyItems = EMPTY_HISTORY_ITEMS,
  planItems = EMPTY_PLAN_ITEMS,
  catalogProducts = EMPTY_CATALOG_PRODUCTS,
  areaAcres = null,
  compact = false,
  showSectionHeader = true,
}: FertigationFormProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const isValid = allProductRowsComplete(data.fertilizers);
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const showDetailsGuidance =
    guidedTourStatus === 'in_progress' && guidedTourStep === 'add_log' && !isValid;

  // Which complete row is open for editing. Incomplete rows are always open;
  // complete rows collapse to receipt lines and re-open on tap — one at a time.
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);

  // Typeahead sections: this farm's history → active plan items → fertilizer
  // catalog → custom escape hatch. No warehouse section — warehouse identity
  // only passes through history rows that already carry it (issue #196).
  const historyOptions = useMemo(() => recentItemsToOptions(historyItems), [historyItems]);
  // ppm/water-concentration plan items are excluded from the typeahead: the
  // fertigation form has no chip for them, so selecting one would drop a
  // verbatim ppm unit into a form that can't represent it. The plan card
  // surfaces them as an explanatory notice instead (issue #197).
  const planOptions = useMemo(
    () =>
      fertigationPlanItemsToOptions(
        planItems.filter((item) => !isWaterConcentrationUnit(item.unit)),
      ),
    [planItems],
  );
  const catalogOptions = useMemo(
    () => fertilizerCatalogToOptions(catalogProducts),
    [catalogProducts],
  );

  const addFertilizer = () => {
    if (data.fertilizers.length >= MAX_PRODUCT_ROWS) return;
    const id = generateRowId();
    onChange({
      ...data,
      fertilizers: [
        ...data.fertilizers,
        {
          id,
          name: '',
          quantity: 0,
          // Manual add lands on the bare 'kg' chip — total for the plot
          // (issue #195); plan picks arrive with their own per_acre basis.
          unit: 'kg',
          quantityBasis: 'total',
          warehouseItemId: null,
          catalogProductId: null,
          planItemId: null,
          compositionSnapshot: null,
          densityKgPerL: null,
        },
      ],
    });
    setEditingRowKey(id);
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
          {showSectionHeader ? (
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
          ) : null}

          {/* Fertilizers List — complete rows collapse to receipt lines; the
              tapped (or newly added) row expands for editing, one at a time. */}
          {data.fertilizers.map((fertilizer, index) => {
            const rowKey = fertilizer.id ?? `idx-${index}`;
            return (
              <FertilizerRow
                key={rowKey}
                fertilizer={fertilizer}
                onUpdate={(updates) => updateFertilizer(index, updates)}
                onRemove={() => removeFertilizer(index)}
                expanded={!isProductRowComplete(fertilizer) || editingRowKey === rowKey}
                onExpand={() => setEditingRowKey(rowKey)}
                onInputFocus={onInputFocus}
                areaAcres={areaAcres}
                historyItems={historyItems}
                planItems={planItems}
                catalogProducts={catalogProducts}
                historyOptions={historyOptions}
                planOptions={planOptions}
                catalogOptions={catalogOptions}
              />
            );
          })}

          {/* Add Fertilizer — appends a blank editing row; its name field's
              typeahead is the picker now (history / plan / catalog / custom). */}
          {data.fertilizers.length < MAX_PRODUCT_ROWS && (
            <Pressable
              onPress={addFertilizer}
              accessibilityRole="button"
              accessibilityLabel={t('fertigationForm.fertilizers.addFertilizer')}
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
              <IconSymbol name="plus.circle.fill" size={20} color={m3.colorScheme.success} />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
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
          {data.fertilizers.filter(isProductRowComplete).map((f, idx) => {
            const summaryKey = f.id ?? `summary-${idx}`;
            const chip = fertigationChipForEntry(f.unit, f.quantityBasis);
            return (
              <View
                key={summaryKey}
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
                  {/* Chip rows read as one fused token ("10 kg (total)"); the
                      clearer display label wins over the bare key, while verbatim
                      units keep the raw string + the legacy per-acre marker. */}
                  {f.quantity ?? 0} {chip?.label ?? chip?.key ?? f.unit}
                  {!chip && f.quantityBasis === 'per_acre'
                    ? ` (${t('fertigationForm.fertilizers.perAcre')})`
                    : ''}
                </Text>
              </View>
            );
          })}
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
  onUpdate: (updates: Partial<FertilizerEntry>) => void;
  onRemove: () => void;
  /** Complete rows render as receipt lines when false; tap re-opens editing. */
  expanded: boolean;
  onExpand: () => void;
  onInputFocus?: TextInputProps['onFocus'];
  areaAcres?: number | null;
  historyItems?: RecentInputItem[];
  planItems?: FertilizerPlanItem[];
  /** Catalog products — used to resolve a row's recommended-dose range guardrail (#236). */
  catalogProducts?: MasterCatalogProduct[];
  /** Typeahead sections (built once at form level). */
  historyOptions?: SearchSelectOption[];
  planOptions?: SearchSelectOption[];
  catalogOptions?: SearchSelectOption[];
}

function FertilizerRow({
  fertilizer,
  onUpdate,
  onRemove,
  expanded,
  onExpand,
  onInputFocus,
  areaAcres = null,
  historyItems = EMPTY_HISTORY_ITEMS,
  planItems = EMPTY_PLAN_ITEMS,
  catalogProducts = EMPTY_CATALOG_PRODUCTS,
  historyOptions = EMPTY_SEARCH_OPTIONS,
  planOptions = EMPTY_SEARCH_OPTIONS,
  catalogOptions = EMPTY_SEARCH_OPTIONS,
}: FertilizerRowProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [nameText, setNameText] = useState(fertilizer.name);
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
  const showTypeahead = isNameFocused && nameText.trim().length >= 1;

  useEffect(() => {
    if (isNameFocused) return;
    if (nameText === fertilizer.name) return;
    const frame = requestAnimationFrame(() => setNameText(fertilizer.name));
    return () => cancelAnimationFrame(frame);
  }, [fertilizer.name, isNameFocused, nameText]);

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

  const activeChip = fertigationChipForEntry(fertilizer.unit, fertilizer.quantityBasis);
  // Prefer the clearer display label ("kg (total)", "gm/acre") over the bare
  // persistence key; the key still drives selection/persistence behind the scenes.
  const unitLabel = activeChip?.label ?? activeChip?.key ?? fertilizer.unit;

  const areaEcho = useMemo(
    () => buildFertigationAreaEcho(fertilizer, areaAcres),
    [fertilizer, areaAcres],
  );

  // Guardrail references are strictly independent of the entry: the linked
  // plan item's dose, else the most recent prior log of the same product.
  // The area echo derives from the same entry and is never a trigger.
  const planReference = useMemo<DoseReference | null>(() => {
    if (!fertilizer.planItemId) return null;
    const planItem = planItems.find((item) => item.id === fertilizer.planItemId);
    if (!planItem?.unit || planItem.quantity == null || planItem.quantity <= 0) return null;
    // Plan doses are per-acre rates by contract; slashed unit spellings carry
    // their own basis and win inside the kernel regardless.
    return {
      quantity: planItem.quantity,
      unit: toKernelSpelling(planItem.unit),
      quantityBasis: 'per_acre',
    };
  }, [fertilizer.planItemId, planItems]);

  const historyReference = useMemo<DoseReference | null>(() => {
    const nameKey = fertilizer.name.trim().toLowerCase();
    if (!nameKey && fertilizer.catalogProductId == null) return null;
    const match = historyItems.find((item) =>
      fertilizer.catalogProductId != null && item.catalogProductId != null
        ? item.catalogProductId === fertilizer.catalogProductId
        : item.name.trim().toLowerCase() === nameKey,
    );
    if (!match || match.quantity == null || match.quantity <= 0) return null;
    return {
      quantity: match.quantity,
      unit: toKernelSpelling(match.unit),
      quantityBasis: match.quantityBasis ?? null,
    };
  }, [fertilizer.name, fertilizer.catalogProductId, historyItems]);

  const doseWarning = useMemo(
    () =>
      evaluateDoseGuard(
        fertilizer,
        { plan: planReference, history: historyReference },
        { areaAcres },
      ),
    [fertilizer, planReference, historyReference, areaAcres],
  );

  // Recommended-dose range guardrail (#236): a SEPARATE, advisory-only warning
  // against the catalog product's label range. Independent of the plan/history
  // guardrail above — both can show, neither blocks. The reference row follows
  // the ENTERED unit's basis: a tank-concentration entry (g/L, ml/L, ppm) is
  // judged against the foliar range; a per-acre/total entry against the drip
  // range (kg/ha). Never cross-judged — comparing a 10,000 L fertigation
  // against a 3–6 g/L spray-tank label fires spurious LOW warnings. No row for
  // the matching route → null (silent, like every optional layer).
  const guidanceReference = useMemo<DoseGuidanceReference | null>(() => {
    if (fertilizer.catalogProductId == null) return null;
    const product = catalogProducts.find((item) => item.id === fertilizer.catalogProductId);
    if (!product) return null;
    const route = isWaterConcentrationUnit(fertilizer.unit) ? 'foliar' : 'drip';
    const row = (product.doseGuidance ?? []).find(
      (guidance) => guidance.applicationRoute === route,
    );
    if (!row) return null;
    return { minValue: row.minValue, maxValue: row.maxValue, unit: row.unit };
  }, [fertilizer.catalogProductId, fertilizer.unit, catalogProducts]);

  const guidanceWarning = useMemo(
    () =>
      evaluateDoseGuidanceGuard(fertilizer, guidanceReference, {
        areaAcres,
      }),
    [fertilizer, guidanceReference, areaAcres],
  );

  // Telemetry: count when the recommendation range guard fires (advisory-only
  // signal — the plan/history guard has no telemetry today). Fire-and-forget,
  // property-only, no PII. The prefill counter lives at the picker selection.
  // Deduped per warning EPISODE: guidanceWarning gets a fresh object identity
  // on every keystroke (its memo dep `fertilizer` is rebuilt by each onUpdate),
  // so capturing on raw identity would fire once per keystroke while the
  // warning shows. The ref keys on product+direction and resets when the
  // warning clears, so the metric counts episodes, not renders.
  const guidanceWarningEpisode = useRef<string | null>(null);
  useEffect(() => {
    if (!guidanceWarning || fertilizer.catalogProductId == null) {
      guidanceWarningEpisode.current = null;
      return;
    }
    const episode = `${fertilizer.catalogProductId}:${guidanceWarning.direction}`;
    if (guidanceWarningEpisode.current === episode) return;
    guidanceWarningEpisode.current = episode;
    telemetry.capture('dose_guidance_guard_triggered', {
      productId: fertilizer.catalogProductId,
      direction: guidanceWarning.direction,
    });
  }, [guidanceWarning, fertilizer.catalogProductId]);

  const applySuggestion = (item: FertigationQuickAddItem) => {
    const resolved = resolveFertigationUnit(item.unit, fertilizer.unit);
    const currentQuantity = fertilizer.quantity ?? 0;
    onUpdate({
      name: item.name,
      unit: resolved.unit,
      quantity: currentQuantity > 0 ? currentQuantity : (item.quantity ?? 0),
      // Same precedence as quick-add: the item's explicit basis, then the
      // unit string's per-acre testimony, then the row, then the sniff.
      quantityBasis:
        item.quantityBasis ??
        perAcreUnitTestimony(resolved.basisFromUnit) ??
        fertilizer.quantityBasis ??
        resolveQuantityBasis(item.unit?.trim() ?? resolved.unit),
      warehouseItemId: item.warehouseItemId ?? null,
      catalogProductId: item.catalogProductId ?? null,
      planItemId: item.planItemId ?? null,
      compositionSnapshot: item.composition ?? null,
      densityKgPerL: item.densityKgPerL ?? null,
    });
    if (currentQuantity <= 0 && item.quantity !== null && item.quantity !== undefined) {
      setQuantityText(item.quantity.toString());
      // Telemetry: a dose prefill (#236) actually REACHED the input — an
      // already-typed quantity is preserved above and must not count.
      if (item.catalogProductId != null) {
        telemetry.capture('recommended_dose_prefilled', { productId: item.catalogProductId });
      }
    }
    quantityRef.current?.focus();
  };

  // Typeahead pick → same fill path as suggestions. Fertigation options never
  // contain mixes, so every selection is a single item.
  const handleTypeaheadSelect = (selection: SearchSelectSelection) => {
    if (selection.kind === 'mix') return;
    setNameText(selection.name);
    applySuggestion({
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
  };

  const handleChipSelect = (chip: FertigationUnitChip) => {
    // The chip is the single source of unit + basis — no separate toggle.
    onUpdate({ unit: chip.unit, quantityBasis: chip.basis });
  };

  // Collapsed receipt line — tap anywhere to re-open for editing.
  if (!expanded) {
    const perAcreMarker =
      !activeChip && fertilizer.quantityBasis === 'per_acre'
        ? ` (${t('fertigationForm.fertilizers.perAcre')})`
        : '';
    // approxText carries its own '≈ ' prefix; to_total resolves the plot total
    // ("≈ 25 kg"), the other direction resolves a rate — mark it "/acre".
    const echoSuffix = areaEcho
      ? ` · ${areaEcho.approxText}${areaEcho.direction === 'to_total' ? '' : '/acre'}`
      : '';
    return (
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={fertilizer.name}
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
            backgroundColor: m3.colorScheme.success,
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
            {fertilizer.name}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s600, marginTop: 1 }}>
            {`${fertilizer.quantity ?? 0} ${unitLabel}${perAcreMarker}${echoSuffix}`}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconSymbol
            name="minus.circle.fill"
            size={22}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)}
          />
        </Pressable>
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
            value={nameText}
            onChangeText={(name) => {
              setNameText(name);
              onUpdate({ name });
            }}
            onFocus={(event) => {
              setIsNameFocused(true);
              onInputFocus?.(event);
            }}
            onBlur={() => setIsNameFocused(false)}
          />

          {showTypeahead ? (
            <ProductTypeahead
              query={nameText}
              history={historyOptions}
              plan={planOptions}
              catalog={catalogOptions}
              onSelect={handleTypeaheadSelect}
              accentColor={m3.colorScheme.success}
            />
          ) : null}
        </View>
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
      </View>

      {/* Fused quantity + unit input — the unit segment opens the unit menu. */}
      <View style={{ marginTop: spacing[2] }}>
        <QtyUnitField
          value={isQuantityEditing ? quantityText : syncedQuantityText}
          onChangeText={handleQuantityChange}
          unitLabel={unitLabel}
          onUnitPress={() => setShowUnitPicker(true)}
          accentColor={m3.colorScheme.success}
          placeholder="Qty"
          inputRef={quantityRef}
          onFocus={(event) => {
            setIsQuantityEditing(true);
            onInputFocus?.(event);
          }}
          onBlur={() => setIsQuantityEditing(false)}
          unitAccessibilityLabel={t('fertigationForm.fertilizers.selectUnit')}
        />
      </View>

      {/* Live area echo — total ↔ per-acre, both directions, kernel-resolved. */}
      {areaEcho ? (
        <Text
          style={{
            marginTop: spacing[1],
            marginLeft: spacing[1],
            fontSize: fontSize.xs,
            color: m3.surface.s600,
          }}
        >
          {areaEcho.direction === 'to_total'
            ? t('fertigationForm.fertilizers.areaEcho.toTotal', {
                quantity: fertilizer.quantity,
                unit: unitLabel,
                total: areaEcho.approxText,
              })
            : t('fertigationForm.fertilizers.areaEcho.toPerAcre', {
                quantity: fertilizer.quantity,
                unit: unitLabel,
                rate: areaEcho.approxText,
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
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={14}
            color={m3.colorScheme.warning}
          />
          <Text style={{ flex: 1, fontSize: fontSize.xs, color: m3.colorScheme.warning }}>
            {t(
              `fertigationForm.fertilizers.doseGuard.${doseWarning.direction}${
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

      {/* Recommended-dose range guardrail (#236) — advisory only, separate from
          the plan/history guardrail above. Fires at 2× outside the label range. */}
      {guidanceWarning ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginTop: spacing[2],
            gap: 6,
          }}
        >
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={14}
            color={m3.colorScheme.warning}
          />
          <Text style={{ flex: 1, fontSize: fontSize.xs, color: m3.colorScheme.warning }}>
            {t(
              `fertigationForm.fertilizers.doseGuard.recommended${
                guidanceWarning.direction === 'high' ? 'High' : 'Low'
              }`,
              {
                entered: `${guidanceWarning.entered} ${guidanceWarning.unit}`,
                min: String(guidanceWarning.reference.minValue),
                max: String(guidanceWarning.reference.maxValue),
                unit: guidanceWarning.reference.unit,
              },
            )}
          </Text>
        </View>
      ) : null}

      {/* Verbatim units (ppm, kg/ha, unknown strings) are outside the chip
          vocabulary — their raw text renders in the unit segment, never coerced. */}
      {!activeChip ? (
        <Text
          style={{
            marginTop: spacing[2],
            marginLeft: spacing[1],
            fontSize: fontSize.xs,
            color: m3.surface.s600,
          }}
        >
          {t('fertigationForm.fertilizers.verbatimUnitHint', { unit: fertilizer.unit })}
        </Text>
      ) : null}

      {/* Unit menu: per-acre rates first, then the gram/mL family, with the
          bare kg/L totals pushed to the end of the list. */}
      <UnitPickerModal
        visible={showUnitPicker}
        onClose={() => setShowUnitPicker(false)}
        onSelect={(key) => {
          const chip = fertigationUnitChipByKey(key);
          if (chip) handleChipSelect(chip);
        }}
        selectedValue={activeChip?.key ?? ''}
        options={[
          ...FERTIGATION_UNIT_CHIPS.filter((chip) => chip.basis !== 'total'),
          ...FERTIGATION_UNIT_OVERFLOW_CHIPS,
          ...FERTIGATION_UNIT_CHIPS.filter((chip) => chip.basis === 'total'),
        ].map((chip) => chip.key)}
        getLabel={(key) => fertigationUnitChipByKey(key)?.label ?? key}
        getHint={(key) => {
          const hintKey = fertigationUnitChipByKey(key)?.hintKey;
          return hintKey ? t(hintKey) : undefined;
        }}
        title={t('fertigationForm.fertilizers.selectUnit')}
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
    fertilizers: [
      {
        id: generateRowId(),
        name: '',
        quantity: 0,
        // Manual entry defaults to the bare 'kg' chip — total for the plot.
        unit: 'kg',
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
