import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useWorkerAttendance, useWorkerTransactions, useWorkers, useCurrency } from '@/hooks';
import { formatCurrency, formatDate } from '@/i18n/format';
import { Spinner } from '@/components/ui/spinner';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import {
  computeWorkerMetrics,
  getDefaultDateRange,
  getWeeklySummaries,
  isDateInRange,
  normalizeDate,
  type DateRange,
} from '@/utils/worker-analytics';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useIsDark, useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

export default function WorkerAnalyticsDetailScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const isDark = useIsDark();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const rawWorkerId = Number(id);
  const hasValidWorkerId = Number.isFinite(rawWorkerId);
  const workerId = hasValidWorkerId ? rawWorkerId : 0;
  const { data: workers, isLoading: workersLoading } = useWorkers();
  const { data: attendance, isLoading: attendanceLoading } = useWorkerAttendance(workerId);
  const { data: transactions, isLoading: transactionsLoading } = useWorkerTransactions(workerId);
  const preferredCurrency = useCurrency();

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

  const handleDateChange = (type: 'from' | 'to', date: Date) => {
    const normalized = normalizeDate(date);
    if (type === 'from') {
      setRange((prev) => ({ ...prev, from: normalized }));
    } else {
      setRange((prev) => ({ ...prev, to: normalized }));
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" color={m3.colorScheme.primary} />
        </View>
      </>
    );
  }

  if (!hasValidWorkerId || !worker) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
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
            {t('workerAnalyticsDetail.notFound')}
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
            <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
              {t('common.goBack')}
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}
      edges={['left', 'right']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UiSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {worker.name}
            </Text>
          </View>

          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing[8] + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
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
            {t('workerAnalyticsDetail.dailyRate')}:{' '}
            {formatCurrency(worker.daily_rate, preferredCurrency)}
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
              {t('workerAnalyticsDetail.dateRange')}
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
                  {t('common.from')}
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
                  {t('common.to')}
                </Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                  {formatDate(range.to)}
                </Text>
              </Pressable>
            </View>
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
                {t('workerAnalyticsDetail.quickStats')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] }}>
                <StatChip
                  label={t('workerAnalyticsDetail.full')}
                  value={String(metrics.fullDays)}
                />
                <StatChip
                  label={t('workerAnalyticsDetail.half')}
                  value={String(metrics.halfDays)}
                />
                <StatChip
                  label={t('workerAnalyticsDetail.absent')}
                  value={String(metrics.absentDays)}
                />
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
                {t('workerAnalyticsDetail.weeklySummary')}
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
                    {week.workDaysEquivalent.toFixed(1)} {t('common.units.days')} ·{' '}
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
                {t('workerAnalyticsDetail.transactions')}
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
                      <Text
                        style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                      >
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
                  {t('workerAnalyticsDetail.noTransactionsInRange')}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {Platform.OS === 'ios' && (
        <BottomSheet
          index={showFromPicker ? 0 : -1}
          enableDynamicSizing
          enablePanDownToClose
          onClose={() => setShowFromPicker(false)}
          backgroundStyle={{ backgroundColor: m3.surface.surfaceContainerLow }}
        >
          <View
            style={{
              padding: spacing[4],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              gap: spacing[3],
            }}
          >
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {t('common.from')}
            </Text>
            <DateTimePicker
              value={range.from}
              mode="date"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_, date) => handleDateChange('from', date)}
              maximumDate={range.to}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={() => setShowFromPicker(false)}
                style={{
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[4],
                  borderRadius: borderRadius.lg,
                  alignItems: 'center',
                  backgroundColor: m3.colorScheme.primary,
                }}
              >
                <Text style={{ fontWeight: fontWeight.bold, color: m3.colorScheme.onPrimary }}>
                  {t('common.done')}
                </Text>
              </Pressable>
            </View>
          </View>
        </BottomSheet>
      )}
      {Platform.OS !== 'ios' && showFromPicker && (
        <DateTimePicker
          value={range.from}
          mode="date"
          presentation="dialog"
          onValueChange={(_, date) => {
            handleDateChange('from', date);
            setShowFromPicker(false);
          }}
          onDismiss={() => setShowFromPicker(false)}
          maximumDate={range.to}
        />
      )}
      {Platform.OS === 'ios' && (
        <BottomSheet
          index={showToPicker ? 0 : -1}
          enableDynamicSizing
          enablePanDownToClose
          onClose={() => setShowToPicker(false)}
          backgroundStyle={{ backgroundColor: m3.surface.surfaceContainerLow }}
        >
          <View
            style={{
              padding: spacing[4],
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              gap: spacing[3],
            }}
          >
            <Text style={{ ...m3.typography.titleMedium, color: m3.colorScheme.onSurface }}>
              {t('common.to')}
            </Text>
            <DateTimePicker
              value={range.to}
              mode="date"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_, date) => handleDateChange('to', date)}
              minimumDate={range.from}
              maximumDate={new Date()}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={() => setShowToPicker(false)}
                style={{
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[4],
                  borderRadius: borderRadius.lg,
                  alignItems: 'center',
                  backgroundColor: m3.colorScheme.primary,
                }}
              >
                <Text style={{ fontWeight: fontWeight.bold, color: m3.colorScheme.onPrimary }}>
                  {t('common.done')}
                </Text>
              </Pressable>
            </View>
          </View>
        </BottomSheet>
      )}
      {Platform.OS !== 'ios' && showToPicker && (
        <DateTimePicker
          value={range.to}
          mode="date"
          presentation="dialog"
          onValueChange={(_, date) => {
            handleDateChange('to', date);
            setShowToPicker(false);
          }}
          onDismiss={() => setShowToPicker(false)}
          minimumDate={range.from}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  const m3 = useM3();
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
