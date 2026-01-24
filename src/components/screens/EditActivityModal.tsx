/**
 * Edit Activity Modal
 * Modal for editing farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS EditCloudActivityLogView.swift
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

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
import { LOG_TYPES, type LogTypeId } from '@/constants/calculatorModels';
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

interface EditActivityModalProps {
  visible: boolean;
  onClose: () => void;
  farm: Farm;
  logType: LogTypeId;
  record: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
  onSaveSuccess?: () => void;
}

export function EditActivityModal({
  visible,
  onClose,
  farm,
  logType,
  record,
  onSaveSuccess,
}: EditActivityModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedRecordId, setInitializedRecordId] = useState<number | undefined>(undefined);

  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: 0 });
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

  const logTypeConfig = LOG_TYPES.find((lt) => lt.id === logType);

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

  useEffect(() => {
    if (visible && (!isInitialized || initializedRecordId !== record.id)) {
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

          const allowedUnits = ['gm/L', 'ml/L', 'gm/acre', 'ml/acre', 'ppm'] as const;
          type AllowedUnit = (typeof allowedUnits)[number];

          if (r.chemical) {
            const chemicalParts = r.chemical.split(',').map((part) => part.trim());
            const chemicals = chemicalParts.map((part) => {
              const match = part.match(/(.+?)\s*\((\d+\.?\d*)\s*(.+?)\)/);
              if (match) {
                const unit = match[3].trim() as AllowedUnit;
                const parsedQuantity = parseFloat(match[2]);
                if (isNaN(parsedQuantity)) {
                  console.warn('[EditActivityModal] Invalid chemical quantity:', match[2]);
                  return {
                    name: part,
                    quantity: 0,
                    unit: 'ml/L' as const,
                  };
                }
                if (!allowedUnits.includes(unit)) {
                  console.warn('[EditActivityModal] Invalid unit, using default:', match[3]);
                  return {
                    name: match[1].trim(),
                    quantity: parsedQuantity,
                    unit: 'ml/L' as const,
                  };
                }
                return {
                  name: match[1].trim(),
                  quantity: parsedQuantity,
                  unit,
                };
              }
              console.warn('[EditActivityModal] Chemical parsing failed, using defaults:', part);
              return {
                name: part,
                quantity: 0,
                unit: 'ml/L' as const,
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
            type: (r.type || '') as
              | ''
              | 'Equipment'
              | 'Fuel'
              | 'Seeds/Plants'
              | 'Packaging'
              | 'Transport'
              | 'Maintenance'
              | 'Other',
            cost: r.cost || 0,
            remarks: r.remarks || '',
          });
          break;
        }
        case 'fertigation': {
          const r = record as FertigationRecord;
          const data = createEmptyFertigationFormData();
          if (r.fertilizers && r.fertilizers.length > 0) {
            data.fertilizers = r.fertilizers.map((f) => ({
              name: f.name,
              quantity: f.quantity,
              unit: f.unit as 'kg/acre' | 'liter/acre',
            }));
          }
          setFertigationData(data);
          break;
        }
      }
      setInitializedRecordId(record.id);
      setIsInitialized(true);
    }
  }, [visible, isInitialized, initializedRecordId, logType, record]);

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
          await updateSpray.mutateAsync({
            id: r.id,
            updates: {
              chemical: chemicalStr,
              dose: doseStr,
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
              type: expenseData.type,
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
          await updateFertigation.mutateAsync({
            id: r.id,
            updates: {
              fertilizers: fertigationData.fertilizers.map((f) => ({
                name: f.name,
                unit: f.unit,
                quantity: f.quantity,
              })),
              date: dateStr,
            },
          });
          break;
        }
      }

      onSaveSuccess?.();
      setIsInitialized(false);
      onClose();
    } catch (error) {
      console.error('Error updating log:', error);
      Alert.alert('Error', 'Failed to update log. Please try again.');
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
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#408059" />
          <Text className="mt-4 text-[#8e8e93]">Loading...</Text>
        </View>
      );
    }

    return (
      <View className="bg-white rounded-2xl p-4 mb-4">
        {logType === 'irrigation' && (
          <IrrigationForm data={irrigationData} onChange={setIrrigationData} />
        )}
        {logType === 'spray' && <SprayForm data={sprayData} onChange={setSprayData} />}
        {logType === 'harvest' && <HarvestForm data={harvestData} onChange={setHarvestData} />}
        {logType === 'expense' && <ExpenseForm data={expenseData} onChange={setExpenseData} />}
        {logType === 'fertigation' && (
          <FertigationForm data={fertigationData} onChange={setFertigationData} />
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: '#f2f2f7' }}
      >
        <LinearGradient
          colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
          style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
        />

        <View className="px-4 pt-12 pb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-[#1c1c1e]">Edit Log</Text>
              <Text className="text-sm text-[#8e8e93]" numberOfLines={1}>
                {farm.name}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center mt-3 bg-[#f9f9f9] px-4 py-2 rounded-xl"
          >
            <Ionicons name="calendar" size={18} color="#408059" />
            <Text className="ml-2 text-sm font-medium text-[#1c1c1e]">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
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

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-white rounded-2xl p-4 mb-4">
            <Text className="text-base font-semibold text-[#1c1c1e] mb-3">Log Type</Text>
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: `${logTypeConfig?.color || '#408059'}15` }}
              >
                <Ionicons
                  name={logTypeConfig?.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={logTypeConfig?.color || '#408059'}
                />
              </View>
              <Text className="ml-3 text-base font-semibold text-[#1c1c1e]">
                {logTypeConfig?.label}
              </Text>
            </View>
          </View>

          {renderForm()}
        </ScrollView>

        <View className="bg-white px-4 py-4 border-t border-[#e5e5ea]">
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3.5 rounded-xl border border-[#e5e5ea] items-center"
            >
              <Text className="font-semibold text-[#8e8e93]">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isFormValid || isSubmitting}
              className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
              style={{
                backgroundColor: isFormValid && !isSubmitting ? '#408059' : '#e5e5ea',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="save"
                    size={18}
                    color={isFormValid && !isSubmitting ? '#FFFFFF' : '#9CA3AF'}
                  />
                  <Text
                    className="ml-2 font-semibold"
                    style={{ color: isFormValid && !isSubmitting ? '#FFFFFF' : '#9CA3AF' }}
                  >
                    Save
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
