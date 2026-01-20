/**
 * Add Activity Modal
 * Modal for logging farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS UnifiedDataLogsModalCloud.swift
 */

import React, { useState, useCallback, useMemo } from 'react';
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
  useCreateIrrigationRecord,
  useCreateSprayRecord,
  useCreateHarvestRecord,
  useCreateExpenseRecord,
  useCreateFertigationRecord,
  useUpdateFarmWaterLevel,
} from '@/hooks';
import { toSupabaseDateString } from '@/types/database';
import type { Farm } from '@/types';

interface AddActivityModalProps {
  visible: boolean;
  onClose: () => void;
  farm: Farm;
  initialLogType?: LogTypeId;
  onSaveSuccess?: () => void;
}

interface PendingLog {
  id: string;
  type: LogTypeId;
  data: IrrigationFormData | SprayFormData | HarvestFormData | ExpenseFormData | FertigationFormData;
  displayDescription: string;
}

const ACTIVITY_TYPES = LOG_TYPES.filter(lt => lt.id !== 'note');

export function AddActivityModal({
  visible,
  onClose,
  farm,
  initialLogType,
  onSaveSuccess,
}: AddActivityModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<LogTypeId | null>(initialLogType ?? null);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: 0 });
  const [sprayData, setSprayData] = useState<SprayFormData>(createEmptySprayFormData());
  const [harvestData, setHarvestData] = useState<HarvestFormData>(createEmptyHarvestFormData());
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(createEmptyExpenseFormData());
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(createEmptyFertigationFormData());

  // Mutations
  const createIrrigation = useCreateIrrigationRecord();
  const createSpray = useCreateSprayRecord();
  const createHarvest = useCreateHarvestRecord();
  const createExpense = useCreateExpenseRecord();
  const createFertigation = useCreateFertigationRecord();
  const updateWaterLevel = useUpdateFarmWaterLevel();

  const isFormValid = useMemo(() => {
    if (!selectedLogType) return false;
    switch (selectedLogType) {
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
  }, [selectedLogType, irrigationData, sprayData, harvestData, expenseData, fertigationData]);

  const getLogDescription = useCallback((type: LogTypeId, data: unknown): string => {
    switch (type) {
      case 'irrigation':
        return `${(data as IrrigationFormData).duration} hours`;
      case 'spray': {
        const spray = data as SprayFormData;
        const chemCount = spray.chemicals.length;
        return `${spray.waterVolume}L water, ${chemCount} chemical${chemCount !== 1 ? 's' : ''}`;
      }
      case 'harvest': {
        const harvest = data as HarvestFormData;
        return `${harvest.quantity} kg, Grade ${harvest.grade}`;
      }
      case 'expense': {
        const expense = data as ExpenseFormData;
        return `₹${expense.cost} - ${expense.type}`;
      }
      case 'fertigation': {
        const fert = data as FertigationFormData;
        const fertCount = fert.fertilizers.length;
        return `${fertCount} fertilizer${fertCount !== 1 ? 's' : ''}`;
      }
      default:
        return '';
    }
  }, []);

  const addLogToSession = useCallback(() => {
    if (!selectedLogType || !isFormValid) return;

    let data: PendingLog['data'];
    switch (selectedLogType) {
      case 'irrigation':
        data = { ...irrigationData };
        setIrrigationData({ duration: 0 });
        break;
      case 'spray':
        data = { ...sprayData };
        setSprayData(createEmptySprayFormData());
        break;
      case 'harvest':
        data = { ...harvestData };
        setHarvestData(createEmptyHarvestFormData());
        break;
      case 'expense':
        data = { ...expenseData };
        setExpenseData(createEmptyExpenseFormData());
        break;
      case 'fertigation':
        data = { ...fertigationData };
        setFertigationData(createEmptyFertigationFormData());
        break;
      default:
        return;
    }

    const newLog: PendingLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: selectedLogType,
      data,
      displayDescription: getLogDescription(selectedLogType, data),
    };

    setPendingLogs(prev => [...prev, newLog]);
    setSelectedLogType(null);
  }, [selectedLogType, isFormValid, irrigationData, sprayData, harvestData, expenseData, fertigationData, getLogDescription]);

  const removeLogFromSession = useCallback((id: string) => {
    setPendingLogs(prev => prev.filter(log => log.id !== id));
  }, []);

  const saveAllLogs = async () => {
    if (pendingLogs.length === 0 || !farm.id) return;

    setIsSubmitting(true);
    const dateStr = toSupabaseDateString(selectedDate);

    try {
      for (const log of pendingLogs) {
        switch (log.type) {
          case 'irrigation': {
            const data = log.data as IrrigationFormData;
            await createIrrigation.mutateAsync({
              farm_id: farm.id,
              date: dateStr,
              duration: data.duration,
              area: farm.area,
              growth_stage: '',
              moisture_status: '',
              system_discharge: farm.system_discharge ?? 0,
              date_of_pruning: farm.date_of_pruning,
            });

            // Update water level if farm has required values
            if (farm.total_tank_capacity && farm.system_discharge && 
                farm.total_tank_capacity > 0 && farm.system_discharge > 0) {
              const waterAdded = data.duration * farm.system_discharge;
              const currentWater = farm.remaining_water ?? 0;
              const newWaterLevel = Math.min(farm.total_tank_capacity, currentWater + waterAdded);
              await updateWaterLevel.mutateAsync({
                farmId: farm.id,
                remainingWater: newWaterLevel,
              });
            }
            break;
          }
          case 'spray': {
            const data = log.data as SprayFormData;
            const chemicalStr = data.chemicals.map(c => `${c.name} (${c.quantity} ${c.unit})`).join(', ');
            await createSpray.mutateAsync({
              farm_id: farm.id,
              date: dateStr,
              chemical: chemicalStr,
              dose: `Water: ${data.waterVolume}L`,
              area: farm.area,
              weather: '',
              operator: '',
              date_of_pruning: farm.date_of_pruning,
            });
            break;
          }
          case 'harvest': {
            const data = log.data as HarvestFormData;
            await createHarvest.mutateAsync({
              farm_id: farm.id,
              date: dateStr,
              quantity: data.quantity,
              grade: data.grade,
              price: data.price || undefined,
              buyer: data.buyer || undefined,
              date_of_pruning: farm.date_of_pruning,
            });
            break;
          }
          case 'expense': {
            const data = log.data as ExpenseFormData;
            await createExpense.mutateAsync({
              farm_id: farm.id,
              date: dateStr,
              type: data.type,
              cost: data.cost,
              date_of_pruning: farm.date_of_pruning,
              remarks: data.remarks || undefined,
            });
            break;
          }
          case 'fertigation': {
            const data = log.data as FertigationFormData;
            await createFertigation.mutateAsync({
              farm_id: farm.id,
              date: dateStr,
              fertilizers: data.fertilizers.map(f => ({
                name: f.name,
                unit: f.unit,
                quantity: f.quantity,
              })),
              area: farm.area,
              date_of_pruning: farm.date_of_pruning,
            });
            break;
          }
        }
      }

      setPendingLogs([]);
      onSaveSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error saving logs:', error);
      Alert.alert('Error', 'Failed to save logs. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (pendingLogs.length > 0) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved logs. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setPendingLogs([]);
              setSelectedLogType(null);
              onClose();
            },
          },
        ]
      );
    } else {
      setSelectedLogType(null);
      onClose();
    }
  };

  const renderLogTypeSelector = () => (
    <View className="bg-white rounded-2xl p-4 mb-4">
      <Text className="text-base font-semibold text-surface-900 mb-3">Activity Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 12 }}>
          {ACTIVITY_TYPES.map((logType) => {
            const isSelected = selectedLogType === logType.id;
            return (
              <TouchableOpacity
                key={logType.id}
                onPress={() => setSelectedLogType(logType.id as LogTypeId)}
                className="items-center py-3 px-4 rounded-xl"
                style={{
                  backgroundColor: isSelected ? '#408059' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: isSelected ? '#408059' : '#E5E7EB',
                }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${logType.color}15` }}
                >
                  <Ionicons
                    name={logType.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={isSelected ? '#FFFFFF' : logType.color}
                  />
                </View>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: isSelected ? '#FFFFFF' : '#374151' }}
                >
                  {logType.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  const renderForm = () => {
    if (!selectedLogType) return null;

    return (
      <View className="bg-white rounded-2xl p-4 mb-4">
        {selectedLogType === 'irrigation' && (
          <IrrigationForm data={irrigationData} onChange={setIrrigationData} />
        )}
        {selectedLogType === 'spray' && (
          <SprayForm data={sprayData} onChange={setSprayData} />
        )}
        {selectedLogType === 'harvest' && (
          <HarvestForm data={harvestData} onChange={setHarvestData} />
        )}
        {selectedLogType === 'expense' && (
          <ExpenseForm data={expenseData} onChange={setExpenseData} />
        )}
        {selectedLogType === 'fertigation' && (
          <FertigationForm data={fertigationData} onChange={setFertigationData} />
        )}

        {/* Add Entry Button */}
        <TouchableOpacity
          onPress={addLogToSession}
          disabled={!isFormValid}
          className="mt-4 py-3 rounded-xl items-center flex-row justify-center"
          style={{
            backgroundColor: isFormValid ? '#408059' : '#E5E7EB',
          }}
        >
          <Ionicons name="add-circle" size={20} color={isFormValid ? '#FFFFFF' : '#9CA3AF'} />
          <Text
            className="ml-2 font-semibold"
            style={{ color: isFormValid ? '#FFFFFF' : '#9CA3AF' }}
          >
            Add Entry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPendingLogs = () => {
    if (pendingLogs.length === 0) return null;

    return (
      <View className="bg-white rounded-2xl p-4 mb-4">
        <Text className="text-base font-semibold text-surface-900 mb-3">
          Pending Logs ({pendingLogs.length})
        </Text>
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find(lt => lt.id === log.type);
          return (
            <View
              key={log.id}
              className="flex-row items-center p-3 rounded-xl mb-2"
              style={{ backgroundColor: '#F3F4F6' }}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{ backgroundColor: `${logType?.color}15` }}
              >
                <Ionicons
                  name={logType?.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={logType?.color}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-surface-900">{logType?.label}</Text>
                <Text className="text-xs text-surface-500">{log.displayDescription}</Text>
              </View>
              <TouchableOpacity onPress={() => removeLogFromSession(log.id)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          );
        })}
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
        className="flex-1 bg-surface-50"
      >
        {/* Header */}
        <View className="bg-white px-4 py-4 border-b border-surface-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-surface-900">Add Farm Log</Text>
              <Text className="text-sm text-surface-500" numberOfLines={1}>{farm.name}</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Date Picker Row */}
          <View className="flex-row items-center justify-between mt-3">
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center bg-surface-100 px-4 py-2 rounded-lg"
            >
              <Ionicons name="calendar" size={18} color="#408059" />
              <Text className="ml-2 text-sm font-medium text-surface-900">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>

            {pendingLogs.length > 0 && (
              <View className="flex-row items-center bg-primary-100 px-3 py-1.5 rounded-full">
                <Ionicons name="document-text" size={14} color="#408059" />
                <Text className="ml-1 text-xs font-semibold text-primary-700">
                  {pendingLogs.length} draft{pendingLogs.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
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

        {/* Content */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {renderLogTypeSelector()}
          {renderForm()}
          {renderPendingLogs()}
        </ScrollView>

        {/* Footer */}
        <View className="bg-white px-4 py-4 border-t border-surface-100">
          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 py-3.5 rounded-xl border border-surface-200 items-center"
            >
              <Text className="font-semibold text-surface-600">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveAllLogs}
              disabled={pendingLogs.length === 0 || isSubmitting}
              className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
              style={{
                backgroundColor: pendingLogs.length > 0 && !isSubmitting ? '#408059' : '#E5E7EB',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="save"
                    size={18}
                    color={pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF'}
                  />
                  <Text
                    className="ml-2 font-semibold"
                    style={{ color: pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF' }}
                  >
                    Save {pendingLogs.length > 0 ? `(${pendingLogs.length})` : ''}
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
