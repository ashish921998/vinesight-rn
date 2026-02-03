import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useProfile, useWorkerAttendance, useWorkerTransactions, useWorkers } from '@/hooks';
import { formatCurrency, formatDate } from '@/i18n/format';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import {
  addDays,
  computeWorkerMetrics,
  getDefaultDateRange,
  getWeeklySummaries,
  isDateInRange,
  normalizeDate,
  type DateRange,
} from '@/utils/worker-analytics';
import { m3, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

export default function WorkerAnalyticsDetailScreen() {
  const { id } = useLocalSearchParams();
  const rawWorkerId = Number(id);
  const hasValidWorkerId = Number.isFinite(rawWorkerId);
  const workerId = hasValidWorkerId ? rawWorkerId : 0;
  const { data: workers, isLoading: workersLoading } = useWorkers();
  const { data: attendance, isLoading: attendanceLoading } = useWorkerAttendance(workerId);
  const { data: transactions, isLoading: transactionsLoading } = useWorkerTransactions(workerId);
  const { data: profile } = useProfile();
  const preferredCurrency = profile?.preferred_currency || 'USD';

  const [range, setRange] = useState<DateRange>(() => getDefaultDateRange(30));
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const worker = workers?.find((w) => w.id === workerId);
  const isLoading = workersLoading || attendanceLoading || transactionsLoading;

  const metrics = useMemo(() => {
    if (!worker || !attendance || !transactions) return null;
    return computeWorkerMetrics(worker, attendance, transactions, range);
  }, [worker, attendance, transactions, range]);

  const weeklySummaries = useMemo(() => {
    if (!worker || !attendance) return [];
    return getWeeklySummaries(worker, attendance, range);
  }, [worker, attendance, range]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((tx) => isDateInRange(tx.date, range));
  }, [transactions, range]);

  const handleDateChange = (type: 'from' | 'to', event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      if (type === 'from') setShowFromPicker(false);
      if (type === 'to') setShowToPicker(false);
      return;
    }

    if (date) {
      const normalized = normalizeDate(date);
      if (type === 'from') {
        setRange((prev) => ({ ...prev, from: normalized }));
      } else {
        setRange((prev) => ({ ...prev, to: normalized }));
      }
    }

    if (type === 'from') setShowFromPicker(false);
    if (type === 'to') setShowToPicker(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      </View>
    );
  }

  if (!hasValidWorkerId || !worker) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}
      >
        <UiSymbol name="exclamationmark.triangle.fill" size={40} color={m3.colorScheme.error} />
        <Text
          style={{
            marginTop: spacing[3],
            fontSize: fontSize.base,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
            textAlign: 'center',
          }}
        >
          Worker not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: spacing[4],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.full,
            backgroundColor: m3.colorScheme.primaryContainer,
          }}
        >
          <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing[2],
          }}
        >
          <UiSymbol name="chevron.left" size={18} color={m3.colorScheme.primary} />
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.primary,
              marginLeft: spacing[1],
            }}
          >
            Back
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
            marginTop: spacing[2],
          }}
        >
          {worker.name}
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: m3.colorScheme.onSurfaceVariant,
            marginTop: spacing[1],
          }}
        >
          Daily rate: {formatCurrency(worker.daily_rate, preferredCurrency)}
        </Text>
      </View>

      <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
        <View
          style={{
            borderRadius: borderRadius['2xl'],
            padding: spacing[4],
            backgroundColor: m3.surface.surfaceContainerLowest,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurfaceVariant,
            }}
          >
            Date range
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] }}>
            <Pressable
              onPress={() => setShowFromPicker(true)}
              style={{
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                backgroundColor: m3.surface.surfaceContainerLow,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                From
              </Text>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                {formatDate(range.from)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowToPicker(true)}
              style={{
                flex: 1,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                backgroundColor: m3.surface.surfaceContainerLow,
              }}
            >
              <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                To
              </Text>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                {formatDate(range.to)}
              </Text>
            </Pressable>
          </View>
          {showFromPicker && (
            <DateTimePicker
              value={range.from}
              mode="date"
              display="default"
              onChange={(event, date) => handleDateChange('from', event, date)}
              maximumDate={range.to}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={range.to}
              mode="date"
              display="default"
              onChange={(event, date) => handleDateChange('to', event, date)}
              minimumDate={range.from}
              maximumDate={addDays(new Date(), 1)}
            />
          )}
        </View>
      </View>

      {metrics && (
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLowest,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
              }}
            >
              Quick stats
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
              <StatChip label="Full" value={String(metrics.fullDays)} />
              <StatChip label="Half" value={String(metrics.halfDays)} />
              <StatChip label="Absent" value={String(metrics.absentDays)} />
            </View>
          </View>
        </View>
      )}

      {weeklySummaries.length > 0 && (
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLowest,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
                marginBottom: spacing[2],
              }}
            >
              Weekly summary
            </Text>
            {weeklySummaries.map((week) => (
              <View
                key={week.start}
                style={{
                  paddingVertical: spacing[2],
                  borderBottomWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                  {week.start} → {week.end}
                </Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                  {week.workDaysEquivalent.toFixed(1)} days ·{' '}
                  {formatCurrency(week.earnings, preferredCurrency)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {metrics && (
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
          <View
            style={{
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              backgroundColor: m3.surface.surfaceContainerLowest,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
                marginBottom: spacing[2],
              }}
            >
              Transactions
            </Text>
            {filteredTransactions.length ? (
              filteredTransactions.map((tx) => (
                <View
                  key={String(tx.id)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing[2],
                    borderBottomWidth: 1,
                    borderColor: m3.colorScheme.outlineVariant,
                  }}
                >
                  <View>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                      {tx.type.replace('_', ' ')}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
                      {tx.date}
                    </Text>
                  </View>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
                    {formatCurrency(tx.amount, preferredCurrency)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
                No transactions in this range.
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: spacing[2],
        borderRadius: borderRadius.full,
        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>{label}</Text>
      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>{value}</Text>
    </View>
  );
}
