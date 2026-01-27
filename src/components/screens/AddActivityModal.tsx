/**
 * Add Activity Modal
 * Modal for logging farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS UnifiedDataLogsModalCloud.swift
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  type TextInputProps,
  Keyboard,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
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
  data:
    | IrrigationFormData
    | SprayFormData
    | HarvestFormData
    | ExpenseFormData
    | FertigationFormData;
  displayDescription: string;
}

const ACTIVITY_TYPES = LOG_TYPES.filter((lt) => lt.id !== 'note');

export function AddActivityModal({
  visible,
  onClose,
  farm,
  initialLogType,
  onSaveSuccess,
}: AddActivityModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const isIOS = process.env.EXPO_OS === 'ios';
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<LogTypeId | null>(initialLogType ?? null);
  const [showLogFormModal, setShowLogFormModal] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logFormScrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  // Form states
  const [irrigationData, setIrrigationData] = useState<IrrigationFormData>({ duration: 0 });
  const [sprayData, setSprayData] = useState<SprayFormData>(createEmptySprayFormData());
  const [harvestData, setHarvestData] = useState<HarvestFormData>(createEmptyHarvestFormData());
  const [expenseData, setExpenseData] = useState<ExpenseFormData>(createEmptyExpenseFormData());
  const [fertigationData, setFertigationData] = useState<FertigationFormData>(
    createEmptyFertigationFormData(),
  );

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

  useEffect(() => {
    if (visible && initialLogType) {
      setSelectedLogType(initialLogType);
      setShowLogFormModal(true);
    }
  }, [visible, initialLogType]);

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
          logFormScrollViewRef.current?.scrollTo({
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

    setPendingLogs((prev) => [...prev, newLog]);
    setSelectedLogType(null);
    setShowLogFormModal(false);
  }, [
    selectedLogType,
    isFormValid,
    irrigationData,
    sprayData,
    harvestData,
    expenseData,
    fertigationData,
    getLogDescription,
  ]);

  const removeLogFromSession = useCallback((id: string) => {
    setPendingLogs((prev) => prev.filter((log) => log.id !== id));
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
            if (
              farm.total_tank_capacity &&
              farm.system_discharge &&
              farm.total_tank_capacity > 0 &&
              farm.system_discharge > 0
            ) {
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
            const chemicalStr = data.chemicals
              .map((c) => `${c.name} (${c.quantity} ${c.unit})`)
              .join(', ');
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
              fertilizers: data.fertilizers.map((f) => ({
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
      Alert.alert('Discard Changes?', 'You have unsaved logs. Are you sure you want to close?', [
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
      ]);
    } else {
      setSelectedLogType(null);
      onClose();
    }
  };

  const renderLogTypeSelector = () => (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <Text
        selectable
        style={{ fontSize: 16, fontWeight: '600', color: '#2c2c2e', marginBottom: 12 }}
      >
        Activity Type
      </Text>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {ACTIVITY_TYPES.map((logType) => {
            const isSelected = selectedLogType === logType.id;
            return (
              <TouchableOpacity
                key={logType.id}
                onPress={() => {
                  setSelectedLogType(logType.id as LogTypeId);
                  setShowLogFormModal(true);
                }}
                style={[
                  {
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                  },
                  {
                    backgroundColor: isSelected ? '#408059' : '#F9FAFB',
                    borderWidth: 1,
                    borderColor: isSelected ? '#408059' : '#E5E7EB',
                  },
                ]}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${logType.color}15`,
                  }}
                >
                  <AppIcon
                    name={logType.icon}
                    size={20}
                    color={isSelected ? '#FFFFFF' : logType.color}
                  />
                </View>
                <Text
                  selectable
                  style={[
                    { fontSize: 12, fontWeight: '600' },
                    { color: isSelected ? '#FFFFFF' : '#374151' },
                  ]}
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
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        {selectedLogType === 'irrigation' && (
          <IrrigationForm
            data={irrigationData}
            onChange={setIrrigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'spray' && (
          <SprayForm data={sprayData} onChange={setSprayData} onInputFocus={scrollToFocusedInput} />
        )}
        {selectedLogType === 'harvest' && (
          <HarvestForm
            data={harvestData}
            onChange={setHarvestData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'expense' && (
          <ExpenseForm
            data={expenseData}
            onChange={setExpenseData}
            onInputFocus={scrollToFocusedInput}
          />
        )}
        {selectedLogType === 'fertigation' && (
          <FertigationForm
            data={fertigationData}
            onChange={setFertigationData}
            onInputFocus={scrollToFocusedInput}
          />
        )}

        {/* Add Entry Button */}
        <TouchableOpacity
          onPress={addLogToSession}
          disabled={!isFormValid}
          style={[
            {
              marginTop: 16,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
            },
            {
              backgroundColor: isFormValid ? '#408059' : '#E5E7EB',
            },
          ]}
        >
          <AppIcon name="add-circle" size={20} color={isFormValid ? '#FFFFFF' : '#9CA3AF'} />
          <Text
            selectable
            style={[
              { marginLeft: 8, fontWeight: '600' },
              { color: isFormValid ? '#FFFFFF' : '#9CA3AF' },
            ]}
          >
            Add Entry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLogFormModal = () => {
    if (!selectedLogType) return null;
    const logType = LOG_TYPES.find((lt) => lt.id === selectedLogType);
    return (
      <Modal
        visible={showLogFormModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowLogFormModal(false);
          setSelectedLogType(null);
        }}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : 'height'}
            keyboardVerticalOffset={isIOS ? 0 : 20}
            style={{ flex: 1, backgroundColor: '#f2f2f7' }}
          >
            <View
              style={{
                backgroundColor: '#ffffff',
                borderBottomWidth: 1,
                borderColor: '#ffffff',
                paddingHorizontal: 16,
                paddingBottom: 12,
                paddingTop: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ fontSize: 18, fontWeight: '600', color: '#2c2c2e' }}>
                    {logType?.label ?? 'Add Log'}
                  </Text>
                  <Text selectable style={{ fontSize: 12, color: '#8e8e93' }} numberOfLines={1}>
                    {farm.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowLogFormModal(false);
                    setSelectedLogType(null);
                  }}
                  style={{ width: 40, alignItems: 'flex-end' }}
                >
                  <AppIcon name="close-circle" size={26} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              ref={logFormScrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {renderForm()}
            </ScrollView>
          </KeyboardAvoidingView>
        </ScrollView>
      </Modal>
    );
  };

  const renderPendingLogs = () => {
    if (pendingLogs.length === 0) return null;

    return (
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <Text
          selectable
          style={{ fontSize: 16, fontWeight: '600', color: '#2c2c2e', marginBottom: 12 }}
        >
          Pending Logs ({pendingLogs.length})
        </Text>
        {pendingLogs.map((log) => {
          const logType = LOG_TYPES.find((lt) => lt.id === log.type);
          return (
            <View
              key={log.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
                backgroundColor: '#F3F4F6',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${logType?.color}15`,
                }}
              >
                <AppIcon name={logType?.icon ?? 'document-text'} size={18} color={logType?.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text selectable style={{ fontSize: 14, fontWeight: '600', color: '#2c2c2e' }}>
                  {logType?.label}
                </Text>
                <Text selectable style={{ fontSize: 12, color: '#8e8e93' }}>
                  {log.displayDescription}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeLogFromSession(log.id)}>
                <AppIcon name="trash-outline" size={20} color="#EF4444" />
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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <KeyboardAvoidingView
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? 0 : 20}
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        >
          {/* Header */}
          <View
            style={{
              backgroundColor: '#ffffff',
              paddingHorizontal: 16,
              paddingBottom: 16,
              paddingTop: 8,
              borderBottomWidth: 1,
              borderColor: '#ffffff',
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{ width: 48, height: 6, borderRadius: 999, backgroundColor: '#f2f2f7' }}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                  Add Farm Log
                </Text>
                <Text selectable style={{ fontSize: 14, color: '#8e8e93' }} numberOfLines={1}>
                  {farm.name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose}>
                <AppIcon name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Date Picker Row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <AppIcon name="calendar" size={18} color="#408059" />
                <Text
                  selectable
                  style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: '#2c2c2e' }}
                >
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>

              {pendingLogs.length > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#e1ebe5',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                >
                  <AppIcon name="document-text" size={14} color="#408059" />
                  <Text
                    selectable
                    style={{ marginLeft: 4, fontSize: 12, fontWeight: '600', color: '#2d5c3f' }}
                  >
                    {pendingLogs.length} draft{pendingLogs.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {showDatePicker && !isIOS && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
              }}
            />
          )}
          {showDatePicker && isIOS && (
            <Pressable
              onPress={() => setShowDatePicker(false)}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 50,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: '#ffffff',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 16,
                }}
                onStartShouldSetResponder={() => true}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#2c2c2e' }}>
                    Select Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <AppIcon name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={(_, date) => {
                    if (date) setSelectedDate(date);
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    { marginTop: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
                    { backgroundColor: '#408059' },
                  ]}
                >
                  <Text selectable style={{ fontWeight: '600', color: '#ffffff' }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          )}

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="automatic"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            showsVerticalScrollIndicator={true}
          >
            {renderLogTypeSelector()}
            {!selectedLogType && (
              <View
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#ffffff',
                }}
              >
                <Text selectable style={{ fontSize: 14, color: '#636366' }}>
                  Select an activity type to open the full-screen form.
                </Text>
              </View>
            )}
            {renderPendingLogs()}
          </ScrollView>

          {renderLogFormModal()}

          {/* Footer */}
          <View
            style={{
              backgroundColor: '#ffffff',
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderColor: '#ffffff',
            }}
          >
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#f2f2f7',
                  alignItems: 'center',
                }}
              >
                <Text selectable style={{ fontWeight: '600', color: '#636366' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveAllLogs}
                disabled={pendingLogs.length === 0 || isSubmitting}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  },
                  {
                    backgroundColor:
                      pendingLogs.length > 0 && !isSubmitting ? '#408059' : '#E5E7EB',
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <AppIcon
                      name="save"
                      size={18}
                      color={pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600' },
                        { color: pendingLogs.length > 0 ? '#FFFFFF' : '#9CA3AF' },
                      ]}
                    >
                      Save {pendingLogs.length > 0 ? `(${pendingLogs.length})` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </Modal>
  );
}
