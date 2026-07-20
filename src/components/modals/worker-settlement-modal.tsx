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
import { useM3, useIsDark } from '@/styles/use-theme';
import { borderRadius, fontSize, radius, spacing } from '@/styles/theme';
import { formatCurrency, formatDate } from '@/i18n/format';
import { useCurrency } from '@/hooks';
import { Input } from '@/components/ui';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import type { Worker } from '@/types';
import { calculateWorkerSettlement, createWorkerSettlement } from '@/services/worker-service';
import { Picker } from '@expo/ui/community/picker';
import { supabase } from '@/lib/supabase';
import { GuidedTourTarget, GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour';
import { SettlementTourCoachmark } from '@/features/guided-tour/settlement-tour-coachmark';
import { useWorkersTourStore } from '@/features/guided-tour/workers-tour-store';
import { colorWithOpacity } from '@/utils/color';

type SettlementPeriod = 'this_week' | 'last_week' | 'custom';
type PaymentMethod = 'cash' | 'upi';

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

function parseYYYYMMDDToLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface LedgerRowProps {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}

function LedgerRow({ label, value, bold }: LedgerRowProps) {
  const m3 = useM3();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: m3.surface.s300,
      }}
    >
      <Text
        style={{
          fontSize: fontSize.sm,
          color: bold ? m3.surface.s900 : m3.surface.s500,
          fontWeight: bold ? '700' : '500',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: fontSize.sm,
          color: m3.surface.s900,
          fontWeight: bold ? '700' : '600',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function WorkerSettlementModal({
  visible,
  onClose,
  workers,
  initialWorkerId,
  onSuccess,
}: WorkerSettlementModalProps) {
  const m3 = useM3();
  const isDark = useIsDark();
  const { t } = useTranslation();
  const currency = useCurrency();
  const formatMoney = (amount: number) =>
    formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const isAndroid = Platform.OS === 'android';
  const insets = useSafeAreaInsets();

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SettlementPeriod>('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [settledAmount, setSettledAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [settlementCalculation, setSettlementCalculation] = useState<{
    days_worked: number;
    gross_amount: number;
    attendance_details: Array<{
      date: string;
      work_status: 'full_day' | 'half_day';
      work_type: string;
      rate: number;
      earnings: number;
    }>;
  } | null>(null);
  const [advanceDeduction, setAdvanceDeduction] = useState('');

  useEffect(() => {
    if (visible && workers.length > 0 && !selectedWorker) {
      const initialWorker = initialWorkerId ? workers.find((w) => w.id === initialWorkerId) : null;
      setSelectedWorker(initialWorker ?? workers[0]);
    }
  }, [visible, workers, initialWorkerId, selectedWorker]);

  const { _hydrated, hasSeenSettlementTour, startSettlementTour } = useWorkersTourStore();
  useEffect(() => {
    if (!_hydrated) return;
    if (visible && !hasSeenSettlementTour) {
      const timer = setTimeout(startSettlementTour, 600);
      return () => clearTimeout(timer);
    }
  }, [_hydrated, visible, hasSeenSettlementTour, startSettlementTour]);

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
      return { start: customStartDate, end: customEndDate };
    }
  }, [selectedPeriod, customStartDate, customEndDate]);

  const advanceDeductionAmount = parseFloat(advanceDeduction) || 0;
  const netPayment = useMemo(() => {
    const gross = settlementCalculation?.gross_amount ?? 0;
    return gross - advanceDeductionAmount;
  }, [settlementCalculation, advanceDeductionAmount]);

  // Aggregate lines for ledger display
  const ledgerLines = useMemo(() => {
    if (!settlementCalculation) return null;
    const details = settlementCalculation.attendance_details;
    const fullDays = details.filter((d) => d.work_status === 'full_day');
    const halfDays = details.filter((d) => d.work_status === 'half_day');
    const getUniformRate = (days: typeof details) => {
      const rates = Array.from(new Set(days.map((d) => d.rate)));
      return rates.length === 1 ? rates[0] : null;
    };
    const fullRate = getUniformRate(fullDays);
    const halfRate = getUniformRate(halfDays);
    const fullEarnings = fullDays.reduce((a, d) => a + d.earnings, 0);
    const halfEarnings = halfDays.reduce((a, d) => a + d.earnings, 0);
    return {
      fullDays: fullDays.length,
      halfDays: halfDays.length,
      fullRate,
      halfRate,
      fullEarnings,
      halfEarnings,
    };
  }, [settlementCalculation]);

  useEffect(() => {
    if (!visible) {
      setIsCalculated(false);
      setSettlementCalculation(null);
      setAdvanceDeduction('');
      setSelectedPeriod('this_week');
      setIsDone(false);
      setPaymentMethod('cash');
      setSelectedWorker(null);
      return;
    }
    const today = new Date();
    const lastWeekStart = getWeekStart(addDays(today, -7));
    setCustomStartDate(formatDateToYYYYMMDD(lastWeekStart));
    setCustomEndDate(formatDateToYYYYMMDD(today));
  }, [visible]);

  useEffect(() => {
    setIsCalculated(false);
    setSettlementCalculation(null);
    setAdvanceDeduction('');
  }, [selectedPeriod, customStartDate, customEndDate, selectedWorker?.id]);

  const handleCalculate = async () => {
    if (!selectedWorker?.id) {
      Alert.alert(t('common.error'), 'Worker not selected');
      return;
    }
    if (selectedPeriod === 'custom') {
      if (!customStartDate || !customEndDate) {
        Alert.alert(t('common.error'), t('settlement.invalidDateRange'));
        return;
      }
      const startDate = parseYYYYMMDDToLocalDate(customStartDate);
      const endDate = parseYYYYMMDDToLocalDate(customEndDate);
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
      if (calculation.attendance_details.length === 0) {
        setSettlementCalculation(null);
        setAdvanceDeduction('0');
        setIsCalculated(false);
        Alert.alert(
          t('common.info', { defaultValue: 'No payable attendance' }),
          t('settlement.noPayableAttendance', {
            defaultValue: 'There is no payable attendance for this period.',
          }),
        );
        return;
      }
      setSettlementCalculation(calculation);
      setAdvanceDeduction(
        selectedWorker.advance_balance > 0
          ? String(Math.min(selectedWorker.advance_balance, calculation.gross_amount))
          : '0',
      );
      setIsCalculated(true);
    } catch (_error: unknown) {
      Alert.alert(t('common.error'), t('settlement.calculationFailed'));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    if (!selectedWorker?.id || !settlementCalculation) return;
    const deduction = advanceDeduction.trim() === '' ? 0 : Number(advanceDeduction);
    if (Number.isNaN(deduction)) {
      Alert.alert(
        t('common.error'),
        t('settlement.invalidDeductionAmount', {
          defaultValue: 'Please enter a valid deduction amount.',
        }),
      );
      return;
    }

    if (deduction < 0) {
      Alert.alert(t('common.error'), t('settlement.deductionCannotBeNegative'));
      return;
    }
    if (deduction > settlementCalculation.gross_amount) {
      Alert.alert(t('common.error'), t('settlement.deductionExceedsSalary'));
      return;
    }

    setIsConfirming(true);
    try {
      const { data: freshWorker, error: freshWorkerError } = await supabase
        .from('workers')
        .select('advance_balance')
        .eq('id', selectedWorker.id)
        .single();

      if (freshWorkerError || !freshWorker) {
        Alert.alert(
          t('common.error'),
          t('settlement.balanceRefreshFailed', {
            defaultValue: 'Could not refresh the worker balance. Please try again.',
          }),
        );
        return;
      }

      const currentBalance = freshWorker.advance_balance ?? 0;
      if (deduction > currentBalance) {
        Alert.alert(t('common.error'), t('settlement.deductionExceedsBalance'));
        return;
      }

      await createWorkerSettlement({
        worker_id: selectedWorker.id,
        farm_id: null,
        period_start: periodDates.start,
        period_end: periodDates.end,
        days_worked: settlementCalculation.days_worked,
        gross_amount: settlementCalculation.gross_amount,
        advance_deducted: deduction,
        net_payment: netPayment,
        status: 'confirmed',
        notes: paymentMethod !== 'cash' ? paymentMethod : null,
      });
      setSettledAmount(netPayment);
      setIsDone(true);
    } catch (_error: unknown) {
      Alert.alert(t('common.error'), t('settlement.confirmationFailed'));
    } finally {
      setIsConfirming(false);
    }
  };

  // When the modal is in the done state, closing via the header X should also fire
  // onSuccess so the parent refreshes its data — same as the Done button path.
  const handleClose = () => {
    if (isDone) onSuccess();
    onClose();
  };

  const handleSettleNext = () => {
    onSuccess();
    const currentIndex = workers.findIndex((w) => w.id === selectedWorker?.id);
    const nextWorker = workers[currentIndex + 1] ?? null;
    setIsDone(false);
    setIsCalculated(false);
    setSettlementCalculation(null);
    setAdvanceDeduction('');
    setPaymentMethod('cash');
    if (nextWorker) {
      setSelectedWorker(nextWorker);
    }
  };

  if (!selectedWorker) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
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
            paddingBottom: spacing[3],
            borderBottomWidth: 1,
            borderBottomColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Pressable onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <UiSymbol name="xmark" size={20} color={m3.surface.s500} />
          </Pressable>
          <Text style={{ fontSize: fontSize.base, fontWeight: '600', color: m3.surface.s900 }}>
            {t('settlePayment', { defaultValue: 'Settle wages' })}
          </Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Done state */}
        {isDone ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: radius.full,
                backgroundColor: colorWithOpacity(m3.colorScheme.success, isDark ? 0.18 : 0.14),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}
            >
              <UiSymbol name="checkmark" size={36} color={m3.colorScheme.success} />
            </View>
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: '700',
                color: m3.surface.s900,
                letterSpacing: -0.3,
              }}
            >
              {t('settlement.settled', { defaultValue: 'Settled' })}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.surface.s500,
                marginTop: 8,
                lineHeight: 22,
                textAlign: 'center',
              }}
            >
              {t('settlement.paidToWorker', {
                defaultValue: 'Paid {{amount}} to {{name}} via {{method}}.',
                amount: formatMoney(settledAmount),
                name: selectedWorker.name.split(' ')[0],
                method: paymentMethod === 'cash' ? 'cash' : 'UPI',
              })}
            </Text>

            <View
              style={{
                marginTop: 22,
                width: '100%',
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
                borderRadius: radius.lg,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                  {t('daysWorked', { defaultValue: 'Days worked' })}
                </Text>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: m3.surface.s900 }}>
                  {settlementCalculation?.days_worked.toFixed(1)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                  {t('settlement.netPayment', { defaultValue: 'Net paid' })}
                </Text>
                <Text style={{ fontSize: fontSize.xs, fontWeight: '700', color: m3.surface.s900 }}>
                  {formatMoney(settledAmount)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 18, width: '100%', gap: 8 }}>
              <Pressable
                onPress={() => {
                  onSuccess();
                  onClose();
                }}
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: radius.lg,
                  backgroundColor: m3.colorScheme.primary,
                  opacity: pressed ? 0.85 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: '600',
                    color: m3.colorScheme.onPrimary,
                  }}
                >
                  {t('common.done', { defaultValue: 'Done' })}
                </Text>
              </Pressable>

              {workers.findIndex((w) => w.id === selectedWorker.id) < workers.length - 1 && (
                <Pressable
                  onPress={handleSettleNext}
                  style={({ pressed }) => ({
                    height: 48,
                    borderRadius: radius.lg,
                    backgroundColor: pressed ? m3.surface.s200 : 'transparent',
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: '600',
                      color: m3.surface.s900,
                    }}
                  >
                    {t('settlement.settleNext', { defaultValue: 'Settle next worker' })}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Worker chip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.full,
                  backgroundColor: isDark ? m3.primary.p400 : m3.primary.p600,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: '700',
                    color: '#F7F3ED',
                    letterSpacing: -0.2,
                  }}
                >
                  {selectedWorker.name
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: m3.surface.s900 }}>
                  {selectedWorker.name}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                  {periodDates.start
                    ? formatDate(parseYYYYMMDDToLocalDate(periodDates.start), {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}{' '}
                  –{' '}
                  {periodDates.end
                    ? formatDate(parseYYYYMMDDToLocalDate(periodDates.end), {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}{' '}
                  · {formatMoney(selectedWorker.daily_rate)}/day
                </Text>
              </View>
            </View>

            {/* Worker selector (if multiple) */}
            {workers.length > 1 && (
              <GuidedTourTarget
                targetId={GUIDED_TOUR_TARGET_IDS.SETTLEMENT_WORKER_PICKER}
                style={{ marginBottom: spacing[3] }}
              >
                <View
                  style={{
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
              </GuidedTourTarget>
            )}

            {/* Period Selection */}
            <GuidedTourTarget
              targetId={GUIDED_TOUR_TARGET_IDS.SETTLEMENT_PERIOD_SELECTOR}
              style={{ marginBottom: spacing[3] }}
            >
              <View>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: m3.surface.s500,
                    marginBottom: 8,
                  }}
                >
                  {t('period', { defaultValue: 'Period' })}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: m3.surface.s200,
                    borderRadius: radius.md,
                    padding: 3,
                    gap: 2,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                  }}
                >
                  {[
                    {
                      k: 'this_week' as SettlementPeriod,
                      l: t('settlement.this_week', { defaultValue: 'This week' }),
                    },
                    {
                      k: 'last_week' as SettlementPeriod,
                      l: t('settlement.last_week', { defaultValue: 'Last week' }),
                    },
                    {
                      k: 'custom' as SettlementPeriod,
                      l: t('settlement.custom', { defaultValue: 'Custom' }),
                    },
                  ].map((period) => {
                    const on = selectedPeriod === period.k;
                    return (
                      <Pressable
                        key={period.k}
                        onPress={() => setSelectedPeriod(period.k)}
                        style={{
                          flex: 1,
                          height: 34,
                          borderRadius: radius.sm,
                          backgroundColor: on ? m3.surface.s100 : 'transparent',
                          borderWidth: 1,
                          borderColor: on ? m3.surface.s300 : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: on ? '700' : '500',
                            color: on ? m3.surface.s900 : m3.surface.s500,
                          }}
                        >
                          {period.l}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </GuidedTourTarget>

            {selectedPeriod === 'custom' && (
              <View style={{ gap: spacing[3], marginBottom: spacing[3] }}>
                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('startDate', { defaultValue: 'Start date' })}
                  </Text>
                  <Input
                    value={customStartDate}
                    onChangeText={setCustomStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.sm, marginBottom: spacing[1] }}>
                    {t('endDate', { defaultValue: 'End date' })}
                  </Text>
                  <Input
                    value={customEndDate}
                    onChangeText={setCustomEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            )}

            {/* Calculate button */}
            {!isCalculated && (
              <GuidedTourTarget targetId={GUIDED_TOUR_TARGET_IDS.SETTLEMENT_CALCULATE_BTN}>
                <Pressable
                  onPress={handleCalculate}
                  disabled={
                    isCalculating ||
                    (selectedPeriod === 'custom' &&
                      (!customStartDate ||
                        !customEndDate ||
                        parseYYYYMMDDToLocalDate(customStartDate) >
                          parseYYYYMMDDToLocalDate(customEndDate)))
                  }
                  style={({ pressed }) => ({
                    height: 48,
                    borderRadius: radius.lg,
                    backgroundColor: m3.colorScheme.primary,
                    opacity: pressed || isCalculating ? 0.8 : 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: '600',
                      color: m3.colorScheme.onPrimary,
                    }}
                  >
                    {isCalculating
                      ? t('calculating', { defaultValue: 'Calculating…' })
                      : t('calculate', { defaultValue: 'Calculate' })}
                  </Text>
                </Pressable>
              </GuidedTourTarget>
            )}

            {/* Ledger calculation */}
            {isCalculated && settlementCalculation && ledgerLines && (
              <>
                {/* Calculation card */}
                <View
                  style={{
                    backgroundColor: m3.surface.s100,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    borderRadius: radius.lg,
                    marginBottom: 12,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: m3.surface.s300,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: '600',
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                        color: m3.surface.s500,
                      }}
                    >
                      {t('settlement.summary', { defaultValue: 'Calculation' })}
                    </Text>
                  </View>

                  {ledgerLines.fullDays > 0 && (
                    <LedgerRow
                      label={t('settlement.fullDaysLine', {
                        defaultValue:
                          ledgerLines.fullRate === null
                            ? 'Full days · {{count}} days'
                            : 'Full days · {{count}} × {{rate}}',
                        count: ledgerLines.fullDays,
                        rate:
                          ledgerLines.fullRate === null
                            ? undefined
                            : formatMoney(ledgerLines.fullRate),
                      })}
                      value={formatMoney(ledgerLines.fullEarnings)}
                    />
                  )}

                  {ledgerLines.halfDays > 0 && (
                    <LedgerRow
                      label={t('settlement.halfDaysLine', {
                        defaultValue:
                          ledgerLines.halfRate === null
                            ? 'Half days · {{count}} days'
                            : 'Half days · {{count}} × {{rate}}',
                        count: ledgerLines.halfDays,
                        rate:
                          ledgerLines.halfRate === null
                            ? undefined
                            : formatMoney(ledgerLines.halfRate),
                      })}
                      value={formatMoney(ledgerLines.halfEarnings)}
                    />
                  )}

                  <LedgerRow
                    label={t('settlement.calculatedGross', { defaultValue: 'Gross' })}
                    value={formatMoney(settlementCalculation.gross_amount)}
                    bold
                  />

                  {advanceDeductionAmount > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 11,
                        paddingHorizontal: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: m3.surface.s300,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          color: m3.surface.s500,
                          fontWeight: '500',
                        }}
                      >
                        {t('settlement.cutFromAdvance', { defaultValue: 'Advance deducted' })}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: '600',
                          color: m3.colorScheme.error,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        − {formatMoney(advanceDeductionAmount)}
                      </Text>
                    </View>
                  )}

                  {/* Net band */}
                  <View
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 14,
                      backgroundColor: colorWithOpacity(
                        m3.colorScheme.primary,
                        isDark ? 0.1 : 0.06,
                      ),
                      borderTopWidth: 1,
                      borderTopColor: m3.surface.s300,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: '600',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                          color: m3.surface.s500,
                        }}
                      >
                        {t('settlement.netPayment', { defaultValue: 'Net to pay' })}
                      </Text>
                      <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 2 }}>
                        {settlementCalculation.days_worked.toFixed(1)}{' '}
                        {t('daysWorked', { defaultValue: 'days worked' })}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: fontSize['2xl'],
                        fontWeight: '700',
                        color: m3.surface.s900,
                        letterSpacing: -0.4,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatMoney(netPayment)}
                    </Text>
                  </View>
                </View>

                {/* Advance deduction override */}
                {selectedWorker.advance_balance > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: '600',
                        color: m3.surface.s500,
                        marginBottom: 6,
                      }}
                    >
                      {t('settlement.cutFromAdvance', { defaultValue: 'Deduct from advance' })} (max
                      {formatMoney(selectedWorker.advance_balance)})
                    </Text>
                    <Input
                      value={advanceDeduction}
                      onChangeText={setAdvanceDeduction}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {/* Payment method */}
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: m3.surface.s500,
                    marginBottom: 8,
                  }}
                >
                  {t('settlement.payBy', { defaultValue: 'Pay by' })}
                </Text>
                <View style={{ gap: 6, marginBottom: 14 }}>
                  {[
                    {
                      k: 'cash' as PaymentMethod,
                      l: t('settlement.cash', { defaultValue: 'Cash' }),
                      sub: t('settlement.cashSub', { defaultValue: 'Mark as paid in hand' }),
                    },
                    {
                      k: 'upi' as PaymentMethod,
                      l: t('settlement.upi', { defaultValue: 'UPI / bank' }),
                      sub: t('settlement.upiSub', { defaultValue: 'Log a digital transfer' }),
                    },
                  ].map((opt) => {
                    const on = paymentMethod === opt.k;
                    return (
                      <Pressable
                        key={opt.k}
                        onPress={() => setPaymentMethod(opt.k)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 12,
                          paddingHorizontal: 14,
                          backgroundColor: on
                            ? colorWithOpacity(m3.colorScheme.primary, isDark ? 0.1 : 0.06)
                            : m3.surface.s100,
                          borderWidth: on ? 2 : 1,
                          borderColor: on ? m3.colorScheme.primary : m3.surface.s300,
                          borderRadius: radius.md,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: '600',
                              color: m3.surface.s900,
                            }}
                          >
                            {opt.l}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.xs,
                              color: m3.surface.s500,
                              marginTop: 2,
                            }}
                          >
                            {opt.sub}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: radius.full,
                            borderWidth: 2,
                            borderColor: on ? m3.colorScheme.primary : m3.surface.s300,
                            backgroundColor: on ? m3.colorScheme.primary : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {on && (
                            <UiSymbol name="checkmark" size={10} color={m3.colorScheme.onPrimary} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Confirm note */}
                <View
                  style={{
                    backgroundColor: m3.surface.s100,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    borderRadius: radius.md,
                    padding: 10,
                    paddingHorizontal: 12,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                    {t('settlement.confirmNote', {
                      defaultValue:
                        'Settling this period for {{name}} — a new period starts tomorrow. You can edit any day before settling.',
                      name: selectedWorker.name.split(' ')[0],
                    })}
                  </Text>
                </View>

                {/* Confirm button */}
                <Pressable
                  onPress={handleConfirm}
                  disabled={isConfirming || netPayment < 0}
                  style={({ pressed }) => ({
                    height: 48,
                    borderRadius: radius.lg,
                    backgroundColor: netPayment < 0 ? m3.surface.s300 : m3.colorScheme.primary,
                    opacity: pressed || isConfirming ? 0.8 : 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  })}
                >
                  <UiSymbol
                    name="checkmark"
                    size={16}
                    color={netPayment < 0 ? m3.surface.s500 : m3.colorScheme.onPrimary}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: '600',
                      color: netPayment < 0 ? m3.surface.s500 : m3.colorScheme.onPrimary,
                    }}
                  >
                    {isConfirming
                      ? t('confirming', { defaultValue: 'Confirming…' })
                      : t('settlement.confirmPay', {
                          defaultValue: 'Confirm · pay {{amount}}',
                          amount: formatMoney(netPayment),
                        })}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        )}

        <SettlementTourCoachmark />
      </KeyboardAvoidingView>
    </Modal>
  );
}
