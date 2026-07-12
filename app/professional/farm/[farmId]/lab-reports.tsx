import { useMemo, useState, useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNativeElement } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { triggerHaptic } from '@/utils/haptics';
import { getDaysAfterPruning, formatLocalDate } from '@/utils/date';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { usePetioleTests, useSoilTests } from '@/hooks/use-lab-tests';
import {
  usePetioleTriage,
  useCreatePetioleTriage,
  useSendFertilizerPlan,
} from '@/hooks/use-consultant-reviews';
import { useOrgFertilizerPlanItemHistory } from '@/hooks/use-fertilizer-plan';
import {
  buildSearchSelectSections,
  professionalPlanPickerSources,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';
import { PetioleComparison } from '@/components/lab/petiole-comparison';
import { SoilBaselinePanel } from '@/components/professional/soil-baseline-panel';
import { ProductPickerField } from '@/components/professional/product-picker-field';
import { useFarmSoilBaseline } from '@/hooks/use-farm-soil-baseline';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { StackBackButton } from '@/components/ui/stack-back-button';
import {
  FormModal,
  FormInput,
  SectionHeader,
  SegmentedControl,
} from '@/components/ui/form-components';
import { toast } from '@/components/ui/toast';
import {
  type FertilizerMeasure,
  MEASURE_OPTIONS,
  MEASURE_TO_UNIT,
  resolveFertilizerMeasure,
} from '@/constants/fertilizer-units';
import { resolveVerbatimQuantityBasis } from '@/constants/unit-text';
import type { FertilizerPlanItem } from '@/types/database';

const FAB_SIZE = 56;
const FAB_RIGHT = 20;
const FAB_BOTTOM = 24;

interface DraftItem {
  name: string;
  quantity: string;
  measure: FertilizerMeasure;
  /** Catalog product id from a picker selection. Null = custom or manually edited. */
  productId: number | null;
}

function emptyDraft(): DraftItem {
  return { name: '', quantity: '', measure: 'kg', productId: null };
}

export default function LabReportsScreen() {
  const { farmId, userId } = useLocalSearchParams<{ farmId: string; userId: string }>();
  const m3 = useM3();
  const { t } = useTranslation();
  const workspace = useProfessionalWorkspace();
  const numericFarmId = Number(farmId);

  const petiole = usePetioleTests(numericFarmId);
  const soil = useSoilTests(numericFarmId);
  const farmSoil = useFarmSoilBaseline(numericFarmId);
  const triage = usePetioleTriage(workspace.data?.organization_id, numericFarmId);
  const createTriage = useCreatePetioleTriage();
  const sendPlan = useSendFertilizerPlan();

  const [fabOpen, setFabOpen] = useState(false);
  const [planNotes, setPlanNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyDraft()]);
  /** Which draft row the product picker is filling (null = closed). */
  const [productPickerIndex, setProductPickerIndex] = useState<number | null>(null);
  /** Search text for the open picker's inline results — shared because only one row is open at a time. */
  const [productQuery, setProductQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  /** Per-row node, used to scroll an expanding picker into view above the keyboard. */
  const rowRefs = useRef<Array<View | null>>([]);

  // Product picker sections: what this org prescribed before ("you often
  // prescribe") plus SearchSelect's custom-text escape hatch for new products.
  // The master fertilizer catalog is intentionally not a plan-authoring source.
  const orgPlanHistory = useOrgFertilizerPlanItemHistory(
    fabOpen ? workspace.data?.organization_id : undefined,
  );
  const productPickerSources = useMemo(
    () => professionalPlanPickerSources(orgPlanHistory.data ?? []),
    [orgPlanHistory.data],
  );
  const productPickerSections = useMemo(
    () =>
      buildSearchSelectSections({
        query: productQuery,
        history: productPickerSources.historyOptions,
        catalog: productPickerSources.catalogOptions,
      }),
    [productQuery, productPickerSources],
  );

  // Expanding a lower row pushes everything below it down, potentially past
  // the keyboard — without this the redesign's whole premise (see results
  // appear where you tapped) silently breaks on any row but the first.
  const scrollRowIntoView = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const rowNode = rowRefs.current[index];
      const scrollNode = scrollViewRef.current;
      if (!rowNode || !scrollNode) return;
      // Pass the ancestor's component instance, not findNodeHandle's numeric
      // handle — the handle form is deprecated and can silently no-op on newer
      // RN, which would break this row-into-view scroll on every lower row.
      // ScrollView satisfies ReactNativeElement at runtime; the cast bridges the
      // structural gap in its TS typings (system-discharge.tsx measures against a
      // View ancestor for the same reason).
      rowNode.measureLayout(
        scrollNode as unknown as ReactNativeElement,
        (_x, y) => scrollNode.scrollTo({ y: Math.max(y - spacing[4], 0), animated: true }),
        () => {},
      );
    });
  }, []);

  const openProductPicker = useCallback(
    (index: number) => {
      setProductPickerIndex(index);
      setProductQuery('');
      scrollRowIntoView(index);
    },
    [scrollRowIntoView],
  );

  // Optional `fromIndex` guards the blur-vs-open race: tapping from one row's
  // field directly into another fires the first row's deferred blur *after*
  // openProductPicker has already switched the index. Closing unconditionally
  // there would snap the newly focused row shut, so a row-scoped close only
  // acts when the picker still points at that row. Functional updates keep
  // this correct without depending on a possibly-stale index in closure.
  const closeProductPicker = useCallback((fromIndex?: number) => {
    if (fromIndex === undefined) {
      setProductPickerIndex(null);
      setProductQuery('');
      return;
    }
    setProductPickerIndex((current) => {
      if (current !== fromIndex) return current;
      setProductQuery('');
      return null;
    });
  }, []);

  const latestSoil = useMemo(() => (soil.data ?? [])[0] ?? null, [soil.data]);
  const latestPetioleTest = useMemo(() => (petiole.data ?? [])[0] ?? null, [petiole.data]);

  // Days since the latest petiole test's pruning date — today vs the pruning
  // date. Reuses the canonical date util rather than re-deriving the diff.
  const daysAfterPruning = latestPetioleTest?.date_of_pruning
    ? getDaysAfterPruning(formatLocalDate(new Date()), latestPetioleTest.date_of_pruning)
    : null;

  const client = useMemo(
    () => workspace.data?.clients.find((c) => c.farms.some((f) => f.id === numericFarmId)),
    [workspace.data, numericFarmId],
  );
  const clientUserId = client?.user_id;
  const farmerName = client?.full_name;
  const farmName = useMemo(
    () => client?.farms.find((f) => f.id === numericFarmId)?.name,
    [client, numericFarmId],
  );

  // A missing/garbage route param yields NaN. The lab hooks are gated on `farmId > 0`
  // so they never fire, but without this guard the screen would sit on a blank state
  // forever; surface the same error UI the sibling farm screen uses instead.
  const isInvalidFarm = !Number.isFinite(numericFarmId) || numericFarmId <= 0;
  const isLoading = !isInvalidFarm && (workspace.isLoading || petiole.isLoading || soil.isLoading);
  // farmSoil.isError is intentionally excluded: it's supplementary baseline
  // data (uses maybeSingle, so a missing row is null, not an error). A genuine
  // fetch failure just omits the farm chips rather than hiding the lab tests.
  const isError = isInvalidFarm || workspace.isError || petiole.isError || soil.isError;

  const updateItem = useCallback((index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const removeItem = useCallback(
    (index: number) => {
      setItems((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next.length === 0 ? [emptyDraft()] : next;
      });
      // Removing a row shifts every later index, so a picker left open on one
      // of them would silently point at the wrong row afterwards.
      closeProductPicker();
    },
    [closeProductPicker],
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyDraft()]);
  }, []);

  const handleProductSelection = useCallback(
    (selection: SearchSelectSelection) => {
      const index = productPickerIndex;
      setProductPickerIndex(null);
      if (index === null || selection.kind === 'mix') return;
      setItems((prev) => {
        const current = prev[index];
        if (!current) return prev;
        const next = [...prev];
        const prefillQuantity = selection.prefill?.quantity;
        // Org-history rows carry the last prescribed dose: prefill it only
        // into an untouched quantity, and map the stored unit back to a
        // measure (keeping the current one when the unit is unrecognized).
        // catalogProductId is stored so the submitted plan item carries
        // product_id identity (Phase W). Custom picks arrive with null.
        next[index] = {
          ...current,
          name: selection.name,
          productId: selection.catalogProductId ?? null,
          quantity:
            current.quantity.trim() === '' &&
            typeof prefillQuantity === 'number' &&
            prefillQuantity > 0
              ? String(prefillQuantity)
              : current.quantity,
          measure: selection.prefill?.unit
            ? resolveFertilizerMeasure(selection.prefill.unit, current.measure)
            : current.measure,
        };
        return next;
      });
    },
    [productPickerIndex],
  );

  const selectProduct = useCallback(
    (selection: SearchSelectSelection) => {
      triggerHaptic();
      handleProductSelection(selection);
      setProductQuery('');
    },
    [handleProductSelection],
  );

  const resetForm = () => {
    setPlanNotes('');
    setItems([emptyDraft()]);
    // Clearing picker state here (and in closePlanForm) means reopening the
    // form can't remount a row with a stale expanded query/results from the
    // last session — the inline picker always starts collapsed.
    closeProductPicker();
  };

  // Covers the dismiss paths (close button, Android back, backdrop) — save
  // goes through resetForm instead. Both must drop picker state so the next
  // open isn't stale.
  const closePlanForm = useCallback(() => {
    setFabOpen(false);
    closeProductPicker();
  }, [closeProductPicker]);

  // Enables the Send button. At least one product needs a name and a positive
  // quantity; blank extra rows are ignored (see handleSubmit).
  const canSend = useMemo(
    () => items.some((d) => d.name.trim() !== '' && Number(d.quantity) > 0),
    [items],
  );

  const handleSubmit = async () => {
    // Ignore fully-blank rows so a stray empty "Add another product" tap never
    // blocks a valid submission.
    const drafts = items.filter((d) => d.name.trim() !== '' || d.quantity.trim() !== '');

    const planItems: FertilizerPlanItem[] = [];
    for (const draft of drafts) {
      const qtyRaw = draft.quantity.trim();
      const qty = Number(qtyRaw);
      if (!draft.name.trim() || qtyRaw === '' || !Number.isFinite(qty) || qty <= 0) {
        toast.error(t('professional.reviews.errors.itemQuantityRequired'));
        return;
      }
      planItems.push({
        fertilizer_name: draft.name.trim(),
        quantity: qty,
        unit: MEASURE_TO_UNIT[draft.measure],
        product_id: draft.productId,
        quantity_basis: resolveVerbatimQuantityBasis(MEASURE_TO_UNIT[draft.measure]),
      });
    }

    if (planItems.length === 0) {
      toast.error(t('professional.reviews.errors.itemQuantityRequired'));
      return;
    }

    try {
      let reviewId = triage.data?.[0]?.id;

      // If the triage query is still loading, refetch to avoid creating a
      // duplicate triage for a review that already exists server-side.
      if (!reviewId && triage.isLoading && workspace.data?.organization_id) {
        const freshTriage = await triage.refetch();
        reviewId = freshTriage.data?.[0]?.id;
      }

      if (!reviewId && latestPetioleTest?.id && workspace.data?.organization_id && clientUserId) {
        const review = await createTriage.mutateAsync({
          organizationId: workspace.data.organization_id,
          farmId: numericFarmId,
          petioleTestId: latestPetioleTest.id,
          clientUserId,
        });
        reviewId = review.id;
      }

      if (!reviewId) {
        toast.info(t('labTests.list.comparison.noPetioleTests'));
        return;
      }

      await sendPlan.mutateAsync({
        reviewId,
        // The backend requires a title. Use the first prescribed product now
        // that professional-mode plan authoring no longer exposes a title field.
        title: planItems[0].fertilizer_name,
        notes: planNotes.trim() || null,
        items: planItems,
      });

      toast.success(t('professional.reviews.planSent'));
      resetForm();
      setFabOpen(false);
    } catch (error) {
      console.error('Failed to send plan:', error);
      toast.error(t('professional.reviews.errors.sendFailed'));
    }
  };

  const isSubmitting = createTriage.isPending || sendPlan.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen
        options={{
          title: t('professional.reports.labReportsTitle'),
          headerShown: true,
          headerLeft: () => (
            <StackBackButton
              fallback={{
                pathname: '/professional/farm/[farmId]',
                params: { farmId, userId },
              }}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing[4] }} />
        ) : isError ? (
          <Text style={{ color: m3.colorScheme.error }}>
            {t('professional.reviews.errors.loadFailed')}
          </Text>
        ) : (
          <View style={{ gap: spacing[5] }}>
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[3],
                  gap: spacing[2],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.onSurface,
                  }}
                >
                  {t('professional.reviews.petioleComparison')}
                </Text>
                {daysAfterPruning !== null && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      borderRadius: borderRadius.lg,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize['2xs'],
                        fontWeight: fontWeight.semibold,
                        color: m3.colorScheme.primary,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('professional.reviews.dayAfterPruning')}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {daysAfterPruning}
                    </Text>
                  </View>
                )}
              </View>
              <PetioleComparison tests={petiole.data ?? []} />
            </View>

            <SoilBaselinePanel farmSoil={farmSoil.data} test={latestSoil} />
          </View>
        )}
      </ScrollView>

      {/* FAB — open the fertilizer plan form */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('professional.reviews.createPlan')}
        onPress={() => setFabOpen(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: FAB_BOTTOM,
          right: FAB_RIGHT,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: borderRadius.full,
          backgroundColor: m3.colorScheme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <UiSymbol name="plus" size={24} color={m3.colorScheme.onPrimary} />
      </Pressable>

      {/* Fertilizer plan sheet — standard FormModal shell (drag handle, centered
          title, sticky Send footer, keyboard handling) for app-wide consistency. */}
      {fabOpen && (
        <FormModal
          visible={fabOpen}
          onClose={closePlanForm}
          title={t('professional.reviews.createPlan')}
          onSave={handleSubmit}
          saveLabel={t('professional.reviews.sendPlan')}
          isLoading={isSubmitting}
          isSaveDisabled={!canSend}
          saveFullWidth
          scrollViewRef={scrollViewRef}
        >
          {/* Who this plan is going to */}
          {(farmerName || farmName) && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
                paddingVertical: spacing[3],
                paddingHorizontal: spacing[4],
                borderRadius: borderRadius.md,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.06),
                marginBottom: spacing[5],
              }}
            >
              <UiSymbol name="person.fill" size={16} color={m3.colorScheme.primary} />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
                  {t('professional.reviews.sendingTo')}{' '}
                </Text>
                <Text style={{ fontWeight: fontWeight.semibold }}>
                  {[farmerName, farmName].filter(Boolean).join('  ·  ')}
                </Text>
              </Text>
            </View>
          )}

          {/* Products */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing[3],
            }}
          >
            <SectionHeader title={t('professional.reviews.products')} style={{ marginBottom: 0 }} />
            <View
              style={{
                minWidth: 22,
                height: 22,
                paddingHorizontal: spacing[2],
                borderRadius: borderRadius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.primary,
                }}
              >
                {items.length}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing[3] }}>
            {items.map((draft, index) => (
              <View
                key={index}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                style={{
                  padding: spacing[4],
                  borderRadius: borderRadius.lg,
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: spacing[3],
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: borderRadius.full,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.bold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.colorScheme.onSurface,
                    }}
                  >
                    {t('professional.reviews.itemNumber', { number: index + 1 })}
                  </Text>
                  {items.length > 1 && (
                    <Pressable
                      onPress={() => removeItem(index)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.delete')}
                    >
                      <UiSymbol name="trash" size={18} color={m3.colorScheme.error} />
                    </Pressable>
                  )}
                </View>

                {/* Product name — inline accordion (org history + custom escape
                    hatch); the free-text input is deliberately gone so names
                    converge on the canonical catalog spelling. */}
                <View style={{ marginBottom: spacing[3] }}>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s500,
                      marginBottom: spacing[2],
                    }}
                  >
                    {t('professional.reviews.productName')}
                    <Text style={{ color: m3.colorScheme.error }}> *</Text>
                  </Text>
                  <ProductPickerField
                    productName={draft.name}
                    isOpen={productPickerIndex === index}
                    query={productPickerIndex === index ? productQuery : ''}
                    sections={productPickerIndex === index ? productPickerSections : []}
                    onOpen={() => openProductPicker(index)}
                    onClose={() => closeProductPicker(index)}
                    onQueryChange={setProductQuery}
                    onSelect={selectProduct}
                  />
                </View>

                <FormInput
                  label={t('professional.reviews.quantity')}
                  required
                  keyboardType="decimal-pad"
                  value={draft.quantity}
                  onChangeText={(text) => updateItem(index, { quantity: text })}
                  placeholder="0"
                  style={{ marginBottom: spacing[3] }}
                />

                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.medium,
                    color: m3.surface.s500,
                    marginBottom: spacing[2],
                  }}
                >
                  {t('professional.reviews.unit')}
                </Text>
                <SegmentedControl
                  options={MEASURE_OPTIONS}
                  selectedValue={draft.measure}
                  onSelect={(value) => updateItem(index, { measure: value as FertilizerMeasure })}
                />
              </View>
            ))}
          </View>

          {/* Add-product — deliberately loud (dashed tinted panel + filled icon
              chip) so it never reads as a disabled hint and is impossible to miss. */}
          <Pressable
            onPress={addItem}
            accessibilityRole="button"
            accessibilityLabel={t('professional.reviews.addItem')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing[2],
              marginTop: spacing[4],
              paddingVertical: spacing[4],
              borderRadius: borderRadius.lg,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: m3.colorScheme.primary,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: borderRadius.full,
                backgroundColor: m3.colorScheme.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UiSymbol name="plus" size={16} color={m3.colorScheme.onPrimary} />
            </View>
            <Text
              style={{
                color: m3.colorScheme.primary,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.base,
              }}
            >
              {t('professional.reviews.addItem')}
            </Text>
          </Pressable>

          {/* Notes — last, so the consultant fills products first, then adds any
              closing guidance for the farmer. */}
          <FormInput
            label={t('professional.reviews.planNotes')}
            value={planNotes}
            onChangeText={setPlanNotes}
            placeholder={t('professional.reviews.planNotes')}
            multiline
            numberOfLines={3}
            style={{ marginTop: spacing[6], marginBottom: 0 }}
          />
        </FormModal>
      )}
    </View>
  );
}
