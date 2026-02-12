/**
 * Edit Activity Modal
 * Modal for editing farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS EditCloudActivityLogView.swift
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  type TextInputProps,
  Keyboard,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
  Platform,
} from 'react-native';
import { Symbol as UISymbol } from '@/components/ui/symbol';
import { Button, FormModal, SectionHeader } from '@/components/ui';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import { useTranslation } from 'react-i18next';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { triggerHapticSuccess } from '@/utils/haptics';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import {
  IrrigationForm,
  SprayForm,
  HarvestForm,
  ExpenseForm,
  FertigationForm,
  validateIrrigationForm,
  validateSprayForm,
  validateHarvestForm,
  validateExpenseForm,
  validateFertigationForm,
  createEmptySprayFormData,
  createEmptyHarvestFormData,
  createEmptyExpenseFormData,
  createEmptyFertigationFormData,
  type IrrigationFormData,
  type SprayFormData,
  type HarvestFormData,
  type ExpenseFormData,
  type FertigationFormData,
} from '@/components/forms';
import { type ExpenseTypeId, type LogTypeId } from '@/constants/calculator-models';
import {
  useUpdateIrrigationRecord,
  useUpdateSprayRecord,
  useUpdateHarvestRecord,
  useUpdateExpenseRecord,
  useUpdateFertigationRecord,
} from '@/hooks';
import { toSupabaseDateString, fromSupabaseDateString } from '@/types';
import type {
  Farm,
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { mapExpenseRecordTypeToTypeId, mapExpenseTypeIdToRecordType } from '@/utils/expense-type';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

interface ActivityEditFormProps {
  visible?: boolean;
  onClose: () => void;
  farm: Farm;
  logType: LogTypeId;
  record: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
  onSaveSuccess?: () => void;
  presentation?: 'modal' | 'screen';
}

export function ActivityEditForm({
  visible,
  onClose,
  farm,
  logType,
  record,
  onSaveSuccess,
  presentation = 'modal',
}: ActivityEditFormProps) {
  const { t } = useTranslation();
  const m3 = useM3();
  const isVisible = visible ?? true;
  const { height: windowHeight } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedRecordId, setInitializedRecordId] = useState<number | undefined>(undefined);
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: undefined });
  const [sprayData, setSprayData] = useState<SprayFormData>(createEmptySprayFormData());
  const [harvestData, setHarvestData] = useState<HarvestFormData>(createEmptyHarvestFormData());
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(createEmptyExpenseFormData());
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(
    createEmptyFertigationFormData(),
  );

  const updateIrrigation = useUpdateIrrigationRecord();
  const updateSpray = useUpdateSprayRecord();
  const updateHarvest = useUpdateHarvestRecord();
  const updateExpense = useUpdateExpenseRecord();
  const updateFertigation = useUpdateFertigationRecord();

  const isFormValid = useMemo(() => {
    switch (logType) {
      case 'irrigation':
        return validateIrrigationForm(irrigationData);
      case 'spray':
        return validateSprayForm(sprayData);
      case 'harvest':
        return validateHarvestForm(harvestData);
      case 'expense':
        return validateExpenseForm(expenseData);
      case 'fertigation':
        return validateFertigationForm(fertigationData);
      default:
        return false;
    }
  }, [logType, irrigationData, sprayData, harvestData, expenseData, fertigationData]);

  const scrollToNode = useCallback(
    (nodeHandle: number) => {
      if (!keyboardHeightRef.current) return;
      const resolvedHandle = findNodeHandle(nodeHandle) ?? nodeHandle;
      if (typeof resolvedHandle !== 'number') return;
      UIManager.measureInWindow(resolvedHandle, (_x, y, _width, height) => {
        const keyboardTop = windowHeight - keyboardHeightRef.current;
        const inputBottom = y + height;
        const buffer = 24;
        if (inputBottom > keyboardTop - buffer) {
          const scrollBy = inputBottom - (keyboardTop - buffer);
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + scrollBy),
            animated: true,
          });
        }
      });
    },
    [windowHeight],
  );

  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      const focusedNode = focusedInputRef.current;
      if (focusedNode != null) {
        requestAnimationFrame(() => scrollToNode(focusedNode));
      }
    });
    return () => {
      keyboardShowListener.remove();
    };
  }, [scrollToNode]);

  type OnFocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

  const scrollToFocusedInput = useCallback(
    (event: OnFocusEvent) => {
      const target = (event as { target?: unknown }).target ?? null;
      const nodeHandle = findNodeHandle(target as unknown as number | React.Component | null);
      if (typeof nodeHandle !== 'number') return;
      focusedInputRef.current = nodeHandle;
      requestAnimationFrame(() => scrollToNode(nodeHandle));
    },
    [scrollToNode],
  );

  useEffect(() => {
    if (isVisible && (!isInitialized || initializedRecordId !== record.id)) {
      const parsedDate = fromSupabaseDateString(record.date);
      if (parsedDate) setSelectedDate(parsedDate);

      switch (logType) {
        case 'irrigation': {
          const r = record as IrrigationRecord;
          setIrrigationData({ duration: r.duration || 0 });
          break;
        }
        case 'spray': {
          const r = record as SprayRecord;
          const data = createEmptySprayFormData();

          if (r.dose && r.dose.includes('Water:')) {
            const waterMatch = r.dose.match(/Water:\s*(\d+(?:\.\d+)?)/);
            if (waterMatch) {
              const parsedVolume = parseFloat(waterMatch[1]);
              data.waterVolume = isNaN(parsedVolume) ? 0 : parsedVolume;
            } else {
              console.warn('[EditActivityModal] Water volume parsing failed:', r.dose);
            }
          }

          const allowedUnits = [
            'gm/L',
            'ml/L',
            'gm/acre',
            'ml/acre',
            'ppm',
            'kg',
            'gram',
            'liter',
            'ml',
          ] as const;
          type AllowedUnit = (typeof allowedUnits)[number];
          const allowedUnitByLowercase = new Map<string, AllowedUnit>(
            allowedUnits.map((unit) => [unit.toLowerCase(), unit]),
          );
          const normalizeLegacySprayUnit = (rawUnit: string): AllowedUnit | null => {
            const lowered = rawUnit.trim().toLowerCase();
            if (
              lowered === 'gm/liter' ||
              lowered === 'gm/litre' ||
              lowered === 'gm/l' ||
              lowered === 'g/l'
            ) {
              return 'gm/L';
            }
            if (lowered === 'ml/liter' || lowered === 'ml/litre' || lowered === 'ml/l') {
              return 'ml/L';
            }
            return allowedUnitByLowercase.get(lowered) ?? null;
          };

          if (r.chemical_items && r.chemical_items.length > 0) {
            data.chemicals = r.chemical_items.map((item) => ({
              id: generateId(),
              name: item.name,
              quantity: item.quantity ?? 0,
              unit: (item.unit as SprayFormData['chemicals'][number]['unit']) ?? 'ml/L',
              quantityBasis: item.quantity_basis ?? 'total',
              warehouseItemId: item.warehouse_item_id ?? null,
              compositionSnapshot: item.composition_snapshot ?? null,
              densityKgPerL: item.density_kg_per_l ?? null,
            }));
          } else if (r.chemical) {
            const chemicalParts = r.chemical.split(',').map((part) => part.trim());
            const chemicals = chemicalParts.map((part) => {
              const match = part.match(/(.+?)\s*\((\d+\.?\d*)\s*(.+?)\)/);
              if (match) {
                const unit = normalizeLegacySprayUnit(match[3]);
                const parsedQuantity = parseFloat(match[2]);
                if (isNaN(parsedQuantity)) {
                  console.warn('[EditActivityModal] Invalid chemical quantity:', match[2]);
                  return {
                    id: generateId(),
                    name: part,
                    quantity: 0,
                    unit: 'ml/L' as const,
                  };
                }
                if (!unit) {
                  console.warn('[EditActivityModal] Invalid unit, using default:', match[3]);
                  return {
                    id: generateId(),
                    name: match[1].trim(),
                    quantity: parsedQuantity,
                    unit: 'ml/L' as const,
                  };
                }
                return {
                  id: generateId(),
                  name: match[1].trim(),
                  quantity: parsedQuantity,
                  unit,
                  quantityBasis: 'total' as const,
                  warehouseItemId: null,
                  compositionSnapshot: null,
                  densityKgPerL: null,
                };
              }
              console.warn('[EditActivityModal] Chemical parsing failed, using defaults:', part);
              return {
                id: generateId(),
                name: part,
                quantity: 0,
                unit: 'ml/L' as const,
                quantityBasis: 'total' as const,
                warehouseItemId: null,
                compositionSnapshot: null,
                densityKgPerL: null,
              };
            });
            data.chemicals = chemicals;
          }
          setSprayData(data);
          break;
        }
        case 'harvest': {
          const r = record as HarvestRecord;
          setHarvestData({
            quantity: r.quantity || 0,
            grade: (r.grade || '') as
              | ''
              | 'A'
              | 'B'
              | 'C'
              | 'Export Quality'
              | 'Premium'
              | 'Standard'
              | 'Reject',
            price: r.price || 0,
            buyer: r.buyer || '',
          });
          break;
        }
        case 'expense': {
          const r = record as ExpenseRecord;
          setExpenseData({
            type: mapExpenseRecordTypeToTypeId(r.type, 'Other'),
            cost: r.cost || 0,
            remarks: r.remarks || '',
          });
          break;
        }
        case 'fertigation': {
          const r = record as FertigationRecord;
          const data = createEmptyFertigationFormData();
          if (r.water_volume != null) {
            data.waterVolume = r.water_volume;
          }
          if (r.fertilizers && r.fertilizers.length > 0) {
            data.fertilizers = r.fertilizers.map((f) => ({
              name: f.name,
              quantity: f.quantity ?? 0,
              unit: f.unit as FertigationFormData['fertilizers'][number]['unit'],
              quantityBasis: f.quantity_basis ?? 'total',
              warehouseItemId: f.warehouse_item_id ?? null,
              compositionSnapshot: f.composition_snapshot ?? null,
              densityKgPerL: f.density_kg_per_l ?? null,
            }));
          }
          setFertigationData(data);
          break;
        }
      }
      setInitializedRecordId(record.id);
      setIsInitialized(true);
    }
  }, [isVisible, isInitialized, initializedRecordId, logType, record]);

  const handleSave = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    const dateStr = toSupabaseDateString(selectedDate);

    try {
      switch (logType) {
        case 'irrigation': {
          const r = record as IrrigationRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateIrrigation.mutateAsync({
            id: r.id,
            updates: {
              duration: irrigationData.duration,
              date: dateStr,
            },
          });
          break;
        }
        case 'spray': {
          const r = record as SprayRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          const chemicalStr = sprayData.chemicals
            .map((c) => `${c.name} (${c.quantity} ${c.unit})`)
            .join(', ');
          const doseStr = `Water: ${sprayData.waterVolume}L`;
          const chemicalItems = sprayData.chemicals
            .filter((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
            .map((c) => ({
              name: c.name.trim(),
              unit: c.unit,
              quantity: c.quantity!,
              quantity_basis: c.quantityBasis ?? 'total',
              warehouse_item_id: c.warehouseItemId ?? null,
              composition_snapshot: c.compositionSnapshot ?? null,
              density_kg_per_l: c.densityKgPerL ?? null,
            }));
          const nutrientTotals = calculateNutrientTotalsForLog({
            items: chemicalItems,
            areaAcre: farm.area ?? 0,
            waterVolumeL: sprayData.waterVolume ?? null,
          });
          await updateSpray.mutateAsync({
            id: r.id,
            updates: {
              chemical: chemicalStr,
              chemical_items: chemicalItems,
              dose: doseStr,
              nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
              nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
              nutrient_calc_coverage: nutrientTotals.coveragePercent,
              date: dateStr,
            },
          });
          break;
        }
        case 'harvest': {
          const r = record as HarvestRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateHarvest.mutateAsync({
            id: r.id,
            updates: {
              quantity: harvestData.quantity,
              grade: harvestData.grade,
              price: harvestData.price || undefined,
              buyer: harvestData.buyer || undefined,
              date: dateStr,
            },
          });
          break;
        }
        case 'expense': {
          const r = record as ExpenseRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          await updateExpense.mutateAsync({
            id: r.id,
            updates: {
              type: mapExpenseTypeIdToRecordType((expenseData.type || 'Other') as ExpenseTypeId),
              cost: expenseData.cost,
              remarks: expenseData.remarks || undefined,
              date: dateStr,
            },
          });
          break;
        }
        case 'fertigation': {
          const r = record as FertigationRecord;
          if (r.id == null) {
            throw new Error('Record ID is missing');
          }
          const fertilizerItems = fertigationData.fertilizers.map((f) => ({
            name: f.name.trim(),
            unit: f.unit,
            quantity: f.quantity ?? 0,
            quantity_basis: f.quantityBasis ?? 'total',
            warehouse_item_id: f.warehouseItemId ?? null,
            composition_snapshot: f.compositionSnapshot ?? null,
            density_kg_per_l: f.densityKgPerL ?? null,
          }));
          const nutrientTotals = calculateNutrientTotalsForLog({
            items: fertilizerItems,
            areaAcre: farm.area ?? 0,
            waterVolumeL: fertigationData.waterVolume ?? null,
          });
          await updateFertigation.mutateAsync({
            id: r.id,
            updates: {
              fertilizers: fertilizerItems,
              water_volume: fertigationData.waterVolume,
              nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
              nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
              nutrient_calc_coverage: nutrientTotals.coveragePercent,
              date: dateStr,
            },
          });
          break;
        }
      }

      triggerHapticSuccess();
      onSaveSuccess?.();
      setIsInitialized(false);
      onClose();
    } catch (error) {
      if (__DEV__) console.error('Error updating log:', error);
      Alert.alert(t('common.error'), t('common.errors.failedToUpdateLog'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsInitialized(false);
    setInitializedRecordId(undefined);
    onClose();
  };

  const renderForm = () => {
    if (!isInitialized) {
      return (
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing[10],
          }}
        >
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text selectable style={{ marginTop: spacing[4], color: colors.surface[500] }}>
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: spacing[4] }}>
        {logType === 'irrigation' && (
          <IrrigationForm
            data={irrigationData}
            onChange={setIrrigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {logType === 'spray' && (
          <SprayForm data={sprayData} onChange={setSprayData} onInputFocus={scrollToFocusedInput} />
        )}
        {logType === 'harvest' && (
          <HarvestForm
            data={harvestData}
            onChange={setHarvestData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {logType === 'expense' && (
          <ExpenseForm
            data={expenseData}
            onChange={setExpenseData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {logType === 'fertigation' && (
          <FertigationForm
            data={fertigationData}
            onChange={setFertigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
      </View>
    );
  };

  return (
    <FormModal
      visible={isVisible}
      onClose={handleClose}
      title={t('activityEdit.title')}
      onSave={handleSave}
      saveLabel={t('common.saveChanges')}
      isLoading={isSubmitting}
      isSaveDisabled={!isFormValid}
      presentation={presentation}
      scrollViewRef={scrollViewRef}
      scrollViewProps={{
        keyboardShouldPersistTaps: 'handled',
        onScroll: (event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        },
        scrollEventThrottle: 16,
      }}
    >
      <SectionHeader
        title={t('activityEdit.detailsTitle')}
        subtitle={farm.name}
        style={{ marginBottom: spacing[4] }}
      />

      <View style={{ marginBottom: spacing[6] }}>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.surface[700],
            marginBottom: spacing[2],
          }}
        >
          {t('activityEdit.dateLabel')}
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface[100],
            borderRadius: borderRadius.xl,
            borderWidth: 2,
            borderColor: colors.surface[200],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary[50],
              marginRight: spacing[3],
            }}
          >
            <UISymbol name="calendar" size={16} color={colors.primary[600]} />
          </View>
          <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
            {formatDate(selectedDate, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Pressable>
      </View>

      {renderForm()}

      {showDatePicker && Platform.OS === 'ios' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 50,
          }}
        >
          <Pressable
            onPress={() => setShowDatePicker(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: colors.surface[100],
              borderTopLeftRadius: borderRadius['2xl'],
              borderTopRightRadius: borderRadius['2xl'],
              padding: spacing[4],
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: spacing[4],
              }}
            >
              <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                {t('common.selectDate')}
              </Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <UISymbol name="xmark.circle.fill" size={24} color={colors.surface[500]} />
              </Pressable>
            </View>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                if (date) setSelectedDate(date);
              }}
            />
            <Button
              title={t('common.done')}
              onPress={() => setShowDatePicker(false)}
              style={{ marginTop: spacing[4] }}
            />
          </View>
        </View>
      )}

      {showDatePicker && Platform.OS !== 'ios' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}
    </FormModal>
  );
}
