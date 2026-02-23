import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useM3 } from '@/styles/use-theme';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate, formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import type { Worker } from '@/types';
import { calculateWorkerSettlement, createWorkerSettlement } from '@/services/worker-service';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';

type SettlementPeriod = 'this_week' | 'last_week' | 'custom';

interface WorkerSettlementModalProps {
  visible: boolean;
  onClose: () => void;
  workers: Worker[];
  initialWorkerId?: number | null;
  onSuccess: () => void;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function WorkerSettlementModal({
  visible,
  onClose,
  workers,
  initialWorkerId,
  onSuccess,
}: WorkerSettlementModalProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const isAndroid = Platform.OS === 'android';
  const currency = useCurrency();
  const insets = useSafeAreaInsets();

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<SettlementPeriod>('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [isCalculated, setIsCalculated] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [settlementCalculation, setSettlementCalculation] = useState<{
    days_worked: number;
    gross_amount: number;
  } | null>(null);

  const [totalSalary, setTotalSalary] = useState('');
  const [advanceDeduction, setAdvanceDeduction] = useState('');

  // Initialize selected worker when modal opens
  useEffect(() => {
    if (visible && workers.length > 0) {
      const initialWorker = initialWorkerId ? workers.find((w) => w.id === initialWorkerId) : null;
      setSelectedWorker(initialWorker ?? workers[0]);
    }
  }, [visible, workers, initialWorkerId]);

  // Period dates
  const periodDates = useMemo(() => {
    const today = new Date();
    if (selectedPeriod === 'this_week') {
      return {
        start: formatDateToYYYYMMDD(getWeekStart(today)),
        end: formatDateToYYYYMMDD(getWeekEnd(today)),
      };
    } else if (selectedPeriod === 'last_week') {
      const lastWeek = addDays(today, -7);
      return {
        start: formatDateToYYYYMMDD(getWeekStart(lastWeek)),
        end: formatDateToYYYYMMDD(getWeekEnd(lastWeek)),
      };
    } else {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Net payment calculation
  const netPayment = useMemo(() => {
    const salary = parseFloat(totalSalary) || 0;
    const deduction = parseFloat(advanceDeduction) || 0;
    return salary - deduction;
  }, [totalSalary, advanceDeduction]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setIsCalculated(false);
      setSettlementCalculation(null);
      setTotalSalary('');
      setAdvanceDeduction('');
      setSelectedPeriod('this_week');
      return;
    }

    // Set default dates for custom period
    const today = new Date();
    const lastWeekStart = getWeekStart(addDays(today, -7));
    setCustomStartDate(formatDateToYYYYMMDD(lastWeekStart));
    setCustomEndDate(formatDateToYYYYMMDD(today));
  }, [visible]);

  // Reset calculation when period or worker changes
  useEffect(() => {
    setIsCalculated(false);
    setSettlementCalculation(null);
    setTotalSalary('');
    setAdvanceDeduction('');
  }, [selectedPeriod, customStartDate, customEndDate, selectedWorker?.id]);

  const handleCalculate = async () => {
    if (!selectedWorker?.id) {
      Alert.alert(t('common.error'), 'Worker not selected');
      return;
    }

    if (selectedPeriod === 'custom') {
      // Validate dates are not empty
      if (!customStartDate || !customEndDate) {
        Alert.alert(t('common.error'), t('settlement.invalidDateRange'));
        return;
      }
      // Parse and compare dates
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        Alert.alert(t('common.error'), t('settlement.invalidDateRange'));
        return;
      }
    }

    setIsCalculating(true);
    try {
      const calculation = await calculateWorkerSettlement(
        selectedWorker.id,
        null,
        periodDates.start,
        periodDates.end,
      );
      setSettlementCalculation(calculation);
      setTotalSalary(calculation.gross_amount.toString());
      setAdvanceDeduction('0');
      setIsCalculated(true);
    } catch (_error: unknown) {
      Alert.alert(t('common.error'), t('settlement.calculationFailed'));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedWorker?.id || !settlementCalculation) return;

    const salary = parseFloat(totalSalary);
    const deduction = parseFloat(advanceDeduction);

    // Fetch fresh advance balance before validation
    const { data: freshWorker } = await supabase
      .from('workers')
      .select('advance_balance')
      .eq('id', selectedWorker.id)
      .single();

    const currentBalance = freshWorker?.advance_balance ?? 0;

    // Validation
    if (isNaN(salary) || salary < 0) {
      Alert.alert(t('common.error'), t('settlement.salaryCannotBeNegative'));
      return;
    }
    if (isNaN(deduction) || deduction < 0) {
      Alert.alert(t('common.error'), t('settlement.deductionCannotBeNegative'));
      return;
    }
    if (deduction > currentBalance) {
      Alert.alert(t('common.error'), t('settlement.deductionExceedsBalance'));
      return;
    }
    if (deduction > salary) {
      Alert.alert(t('common.error'), t('settlement.deductionExceedsSalary'));
      return;
    }

    setIsConfirming(true);
    try {
      await createWorkerSettlement({
        worker_id: selectedWorker.id,
        farm_id: null,
        period_start: periodDates.start,
        period_end: periodDates.end,
        days_worked: settlementCalculation.days_worked,
        gross_amount: salary,
        advance_deducted: deduction,
        net_payment: netPayment,
        status: 'confirmed',
        notes: null,
      });
      Alert.alert(
        t('settlement.settlementConfirmedTitle'),
        t('settlement.settlementConfirmedMessage', {
          formattedAmount: formatCurrency(netPayment, currency),
        }),
      );
      onSuccess();
      onClose();
    } catch (_error: unknown) {
      Alert.alert(t('common.error'), t('settlement.confirmationFailed'));
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  if (!selectedWorker) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
        behavior={isAndroid ? 'height' : 'padding'}
        keyboardVerticalOffset={isAndroid ? 0 : 100}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing[4],
            paddingTop: insets.top + spacing[4],
            paddingBottom: spacing[4],
            borderBottomWidth: 1,
            borderBottomColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
            {t('settlePayment')}
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: m3.surface.surfaceContainerHighest,
              borderRadius: borderRadius.full,
            }}
          >
            <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing[4] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Worker Selector */}
          <Text
            style={{
              fontSize: fontSize.sm,
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: spacing[2],
            }}
          >
            {t('selectWorkerAndPeriod')}
          </Text>
          <View
            style={{
              marginBottom: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLow,
              borderRadius: borderRadius.lg,
              overflow: 'hidden',
            }}
          >
            <Picker
              selectedValue={selectedWorker.id?.toString()}
              onValueChange={(itemValue) => {
                const worker = workers.find((w) => w.id?.toString() === itemValue);
                if (worker) setSelectedWorker(worker);
              }}
              style={{
                backgroundColor: m3.surface.surfaceContainerLow,
                color: m3.colorScheme.onSurface,
              }}
            >
              {workers.map((worker, index) => (
                <Picker.Item
                  key={worker.id ?? `worker-${index}`}
                  label={worker.name}
                  value={worker.id?.toString() ?? `worker-${index}`}
                  style={{ backgroundColor: m3.surface.surfaceContainerLow }}
                />
              ))}
            </Picker>
          </View>

          {/* Selected Worker Info */}
          <View
            style={{
              padding: spacing[3],
              backgroundColor: m3.surface.surfaceContainerLow,
              borderRadius: borderRadius.lg,
              marginBottom: spacing[4],
            }}
          >
            <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
              {selectedWorker.name}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
              {t('dailyRate')}: {selectedWorker.daily_rate}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.error,
                marginTop: spacing[1],
              }}
            >
              {t('advanceBalance')}: {selectedWorker.advance_balance ?? 0}
            </Text>
          </View>

          {/* Period Selection */}
          <View style={{ marginBottom: spacing[4] }}>
            <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[2] }}>{t('period')}</Text>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: m3.surface.surfaceContainerLow,
                borderRadius: borderRadius.full,
                padding: spacing[1],
                marginBottom: spacing[3],
              }}
            >
              {(['this_week', 'last_week', 'custom'] as SettlementPeriod[]).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => setSelectedPeriod(period)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[2],
                    paddingHorizontal: spacing[3],
                    borderRadius: borderRadius.full,
                    alignItems: 'center',
                    backgroundColor:
                      selectedPeriod === period ? m3.colorScheme.surface : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight:
                        selectedPeriod === period ? fontWeight.semibold : fontWeight.normal,
                      color:
                        selectedPeriod === period
                          ? m3.colorScheme.primary
                          : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t(`settlement.${period}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {selectedPeriod === 'custom' && (
              <View style={{ gap: spacing[3] }}>
                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('startDate')}
                  </Text>
                  <Input
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('endDate')}
                  </Text>
                  <Input
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Calculate Button */}
          {!isCalculated && (
            <Button
              title={t('calculate')}
              onPress={handleCalculate}
              isLoading={isCalculating}
              disabled={
                selectedPeriod === 'custom' &&
                (!customStartDate ||
                  !customEndDate ||
                  new Date(customStartDate) > new Date(customEndDate))
              }
            />
          )}

          {/* Settlement Summary */}
          {isCalculated && settlementCalculation && (
            <>
              <View
                style={{
                  padding: spacing[4],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderRadius: borderRadius.lg,
                  marginBottom: spacing[4],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing[3],
                  }}
                >
                  {t('settlement.summary')}
                </Text>
                <View style={{ gap: spacing[2] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                      {t('period')}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                      {formatDate(new Date(periodDates.start), { month: 'short', day: 'numeric' })}{' '}
                      - {formatDate(new Date(periodDates.end), { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                      {t('daysWorked')}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                      {settlementCalculation.days_worked.toFixed(1)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                      {t('settlement.calculatedGross')}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                      {settlementCalculation.gross_amount.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                      {t('advanceBalance')}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.error }}>
                      {selectedWorker.advance_balance ?? 0}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Adjustments */}
              <View style={{ marginBottom: spacing[4], gap: spacing[3] }}>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing[1],
                  }}
                >
                  {t('settlement.adjustments')}
                </Text>

                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('settlement.totalSalary')}
                  </Text>
                  <Input
                    value={totalSalary}
                    onChangeText={setTotalSalary}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {t('settlement.totalSalaryHint')}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('settlement.cutFromAdvance')}
                  </Text>
                  <Input
                    value={advanceDeduction}
                    onChangeText={setAdvanceDeduction}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                    {t('settlement.max', { max: selectedWorker.advance_balance ?? 0 })}
                  </Text>
                </View>
              </View>

              {/* Net Payment */}
              <View
                style={{
                  padding: spacing[4],
                  backgroundColor:
                    netPayment >= 0
                      ? m3.colorScheme.primaryContainer
                      : m3.colorScheme.errorContainer,
                  borderRadius: borderRadius.lg,
                  marginBottom: spacing[6],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    color:
                      netPayment >= 0
                        ? m3.colorScheme.onPrimaryContainer
                        : m3.colorScheme.onErrorContainer,
                    marginBottom: spacing[2],
                  }}
                >
                  {t('settlement.netPayment')}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color:
                      netPayment >= 0
                        ? m3.colorScheme.onPrimaryContainer
                        : m3.colorScheme.onErrorContainer,
                  }}
                >
                  {netPayment.toFixed(2)}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color:
                      netPayment >= 0
                        ? m3.colorScheme.onPrimaryContainer
                        : m3.colorScheme.onErrorContainer,
                    marginTop: spacing[1],
                  }}
                >
                  {t('settlement.netPaymentHint')}
                </Text>
              </View>

              {/* Confirm Button */}
              <Button
                title={t('confirm')}
                onPress={handleConfirm}
                isLoading={isConfirming}
                disabled={netPayment < 0}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
