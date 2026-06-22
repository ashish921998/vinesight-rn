import { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useM3 } from '@/styles/use-theme';
import { spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles/theme';
import { useProfessionalWorkspace } from '@/hooks/use-professional-workspace';
import { usePetioleTests, useSoilTests } from '@/hooks/use-lab-tests';
import {
  usePetioleTriage,
  useCreatePetioleTriage,
  useSendFertilizerPlan,
} from '@/hooks/use-consultant-reviews';
import { PetioleComparison } from '@/components/lab/petiole-comparison';
import { SoilBaselinePanel } from '@/components/professional/soil-baseline-panel';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { PLAN_ITEM_UNIT_OPTIONS } from '@/constants/consultant-lab-config';
import type { FertilizerPlanItem } from '@/types/database';

const FAB_SIZE = 56;
const FAB_RIGHT = 20;
const FAB_BOTTOM = 24;

interface DraftItem {
  name: string;
  quantity: string;
  unit: string;
}

function emptyDraft(): DraftItem {
  return { name: '', quantity: '', unit: PLAN_ITEM_UNIT_OPTIONS[0] };
}

export default function LabReportsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const m3 = useM3();
  const { t } = useTranslation();
  const workspace = useProfessionalWorkspace();
  const numericFarmId = Number(farmId);

  const petiole = usePetioleTests(numericFarmId);
  const soil = useSoilTests(numericFarmId);
  const triage = usePetioleTriage(workspace.data?.organization_id, numericFarmId);
  const createTriage = useCreatePetioleTriage();
  const sendPlan = useSendFertilizerPlan();

  const [fabOpen, setFabOpen] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([emptyDraft()]);

  const latestSoil = useMemo(() => (soil.data ?? [])[0] ?? null, [soil.data]);
  const latestPetioleTest = useMemo(() => (petiole.data ?? [])[0] ?? null, [petiole.data]);

  const clientUserId = useMemo(() => {
    const client = workspace.data?.clients.find((c) => c.farms.some((f) => f.id === numericFarmId));
    return client?.user_id;
  }, [workspace.data, numericFarmId]);

  // A missing/garbage route param yields NaN. The lab hooks are gated on `farmId > 0`
  // so they never fire, but without this guard the screen would sit on a blank state
  // forever; surface the same error UI the sibling farm screen uses instead.
  const isInvalidFarm = !Number.isFinite(numericFarmId) || numericFarmId <= 0;
  const isLoading = !isInvalidFarm && (workspace.isLoading || petiole.isLoading || soil.isLoading);
  const isError = isInvalidFarm || workspace.isError || petiole.isError || soil.isError;

  const updateItem = useCallback((index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next.length === 0 ? [emptyDraft()] : next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyDraft()]);
  }, []);

  const resetForm = () => {
    setItems([emptyDraft()]);
  };

  const handleSubmit = async () => {
    const planItems: FertilizerPlanItem[] = [];
    for (const draft of items) {
      const qtyRaw = draft.quantity.trim();
      const qty = Number(qtyRaw);
      if (!draft.name.trim() || qtyRaw === '' || !Number.isFinite(qty) || qty <= 0) {
        toast.error(t('professional.reviews.errors.itemQuantityRequired'));
        return;
      }
      planItems.push({
        fertilizer_name: draft.name.trim(),
        quantity: qty,
        unit: draft.unit,
      });
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
        toast.info(t('labTests.comparison.noPetioleTests'));
        return;
      }

      await sendPlan.mutateAsync({
        reviewId,
        title: planItems[0].fertilizer_name,
        notes: null,
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
      <Stack.Screen options={{ title: t('professional.reports.labReportsTitle') }} />
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
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                  marginBottom: spacing[3],
                }}
              >
                {t('professional.reviews.petioleComparison')}
              </Text>
              <PetioleComparison tests={petiole.data ?? []} />
            </View>

            <View>
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                  marginBottom: spacing[3],
                }}
              >
                {t('professional.reviews.soilBaseline')}
              </Text>
              <SoilBaselinePanel test={latestSoil} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* FAB — open quick fertilizer plan form */}
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

      {/* Quick plan modal — name, quantity, unit per item, multiple items */}
      <Modal
        visible={fabOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFabOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setFabOpen(false)} />
          <View
            style={{
              backgroundColor: m3.colorScheme.surface,
              borderTopLeftRadius: borderRadius.xl,
              borderTopRightRadius: borderRadius.xl,
              padding: spacing[5],
              gap: spacing[4],
              maxHeight: '80%',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {t('professional.reviews.createPlan')}
              </Text>
              <Pressable onPress={() => setFabOpen(false)}>
                <UiSymbol name="xmark" size={22} color={m3.colorScheme.onSurfaceVariant} />
              </Pressable>
            </View>

            {/* Item list */}
            <ScrollView>
              <View style={{ gap: spacing[3] }}>
                {items.map((draft, index) => (
                  <View
                    key={index}
                    style={{
                      padding: spacing[3],
                      borderRadius: borderRadius.lg,
                      backgroundColor: m3.colorScheme.surfaceVariant,
                      gap: spacing[2],
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                      >
                        {t('professional.reviews.itemNumber', { number: index + 1 })}
                      </Text>
                      {items.length > 1 && (
                        <Pressable onPress={() => removeItem(index)}>
                          <UiSymbol name="trash" size={16} color={m3.colorScheme.error} />
                        </Pressable>
                      )}
                    </View>

                    {/* Name */}
                    <TextInput
                      value={draft.name}
                      onChangeText={(text) => updateItem(index, { name: text })}
                      placeholder={t('professional.reviews.productName')}
                      placeholderTextColor={m3.colorScheme.onSurfaceVariant}
                      style={{
                        padding: spacing[2],
                        borderRadius: borderRadius.md,
                        backgroundColor: m3.colorScheme.surface,
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.sm,
                      }}
                    />

                    {/* Quantity + Unit */}
                    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                      <TextInput
                        value={draft.quantity}
                        onChangeText={(text) => updateItem(index, { quantity: text })}
                        keyboardType="decimal-pad"
                        placeholder={t('professional.reviews.quantity')}
                        placeholderTextColor={m3.colorScheme.onSurfaceVariant}
                        style={{
                          flex: 1,
                          padding: spacing[2],
                          borderRadius: borderRadius.md,
                          backgroundColor: m3.colorScheme.surface,
                          color: m3.colorScheme.onSurface,
                          fontSize: fontSize.sm,
                        }}
                      />
                      <View
                        style={{
                          flexDirection: 'row',
                          borderRadius: borderRadius.md,
                          backgroundColor: m3.colorScheme.surface,
                          overflow: 'hidden',
                        }}
                      >
                        {PLAN_ITEM_UNIT_OPTIONS.map((u) => (
                          <Pressable
                            key={u}
                            onPress={() => updateItem(index, { unit: u })}
                            style={{
                              paddingHorizontal: spacing[2],
                              paddingVertical: spacing[2],
                              backgroundColor:
                                draft.unit === u ? m3.colorScheme.primary : undefined,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: fontSize.xs,
                                color:
                                  draft.unit === u
                                    ? m3.colorScheme.onPrimary
                                    : m3.colorScheme.onSurface,
                                fontWeight:
                                  draft.unit === u ? fontWeight.semibold : fontWeight.normal,
                              }}
                            >
                              {u}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Add item + submit */}
            <Pressable
              onPress={addItem}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[1],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.full,
                borderWidth: 1,
                borderColor: m3.colorScheme.primary,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <UiSymbol name="plus" size={16} color={m3.colorScheme.primary} />
              <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.medium }}>
                {t('professional.reviews.addItem')}
              </Text>
            </Pressable>

            <Button
              title={t('professional.reviews.sendPlan')}
              onPress={handleSubmit}
              disabled={isSubmitting}
              isLoading={isSubmitting}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
