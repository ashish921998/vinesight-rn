/**
 * Edit Activity Modal
 * Modal for editing farm activities (irrigation, spray, harvest, expense, fertigation)
 * Ported from iOS EditCloudActivityLogView.swift
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  type TextInputProps,
  Keyboard,
  useWindowDimensions,
  UIManager,
  findNodeHandle,
} from 'react-native';
import { AppIcon } from '@/components/ui/app-icon';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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
  const { height: windowHeight } = useWindowDimensions();
  const isIOS = process.env.EXPO_OS === 'ios';
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializedRecordId, setInitializedRecordId] = useState<number | undefined>(undefined);
  const scrollViewRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);
  const keyboardHeightRef = useRef(0);

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
                    id: generateId(),
                    name: part,
                    quantity: 0,
                    unit: 'ml/L' as const,
                  };
                }
                if (!allowedUnits.includes(unit)) {
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
                };
              }
              console.warn('[EditActivityModal] Chemical parsing failed, using defaults:', part);
              return {
                id: generateId(),
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
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}
        >
          <ActivityIndicator size="large" color="#408059" />
          <Text selectable style={{ marginTop: 16, color: '#8e8e93' }}>
            Loading...
          </Text>
        </View>
      );
    }

    return (
      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
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
          style={{ flex: 1, backgroundColor: '#f2f2f7' }}
        >
          <LinearGradient
            colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />

          <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text selectable style={{ fontSize: 18, fontWeight: '700', color: '#1c1c1e' }}>
                  Edit Log
                </Text>
                <Text selectable style={{ fontSize: 14, color: '#8e8e93' }} numberOfLines={1}>
                  {farm.name}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose}>
                <AppIcon name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 12,
                backgroundColor: '#f9f9f9',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
              }}
            >
              <AppIcon name="calendar" size={18} color="#408059" />
              <Text
                selectable
                style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: '#1c1c1e' }}
              >
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
            contentInsetAdjustmentBehavior="automatic"
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text
                selectable
                style={{ fontSize: 16, fontWeight: '600', color: '#1c1c1e', marginBottom: 12 }}
              >
                Log Type
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${logTypeConfig?.color || '#408059'}15`,
                  }}
                >
                  <AppIcon
                    name={logTypeConfig?.icon ?? 'leaf'}
                    size={20}
                    color={logTypeConfig?.color || '#408059'}
                  />
                </View>
                <Text
                  selectable
                  style={{ marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#1c1c1e' }}
                >
                  {logTypeConfig?.label}
                </Text>
              </View>
            </View>

            {renderForm()}
          </ScrollView>

          <View
            style={{
              backgroundColor: '#ffffff',
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderColor: '#e5e5ea',
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
                  borderColor: '#e5e5ea',
                  alignItems: 'center',
                }}
              >
                <Text selectable style={{ fontWeight: '600', color: '#8e8e93' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!isFormValid || isSubmitting}
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
                    backgroundColor: isFormValid && !isSubmitting ? '#408059' : '#e5e5ea',
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
                      color={isFormValid && !isSubmitting ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      selectable
                      style={[
                        { marginLeft: 8, fontWeight: '600' },
                        { color: isFormValid && !isSubmitting ? '#FFFFFF' : '#9CA3AF' },
                      ]}
                    >
                      Save
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
