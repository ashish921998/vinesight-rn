import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAllWorkerAttendance, useAllWorkerTransactions, useProfile, useWorkers } from '@/hooks';
import type { Worker } from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import {
  computeWorkerMetrics,
  computeOverview,
  getDefaultDateRange,
  type WorkerAnalyticsMetrics,
} from '@/utils/worker-analytics';
import { Symbol as UiSymbol } from '@/components/ui/symbol';

export function WorkerAnalyticsView() {
  const m3 = useM3();
  const { data: workers, isLoading: workersLoading } = useWorkers();
  const { data: attendance, isLoading: attendanceLoading } = useAllWorkerAttendance();
  const { data: transactions, isLoading: transactionsLoading } = useAllWorkerTransactions();
  const { data: profile } = useProfile();
  const preferredCurrency = profile?.currency_preference || 'INR';

  const dateRange = useMemo(() => getDefaultDateRange(30), []);

  const metricsByWorker = useMemo(() => {
    if (!workers || !attendance || !transactions) return [];
    return workers
      .filter((worker) => worker.id !== undefined)
      .map((worker) => ({
        worker,
        metrics: computeWorkerMetrics(
          worker,
          attendance.filter((record) => record.worker_id === worker.id),
          transactions.filter((record) => record.worker_id === worker.id),
          dateRange,
        ),
      }));
  }, [workers, attendance, transactions, dateRange]);

  const overview = useMemo(() => {
    const metrics = metricsByWorker.map((entry) => entry.metrics);
    return computeOverview(metrics);
  }, [metricsByWorker]);

  const hasAttendance = attendance && attendance.length > 0;
  const isLoading = workersLoading || attendanceLoading || transactionsLoading;

  const topWorkers = useMemo(() => {
    return metricsByWorker
      .slice()
      .sort((a, b) => b.metrics.earnings - a.metrics.earnings)
      .slice(0, 5);
  }, [metricsByWorker]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      </View>
    );
  }

  if (!hasAttendance) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[8],
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[4],
          }}
        >
          <UiSymbol name="calendar.badge.clock" size={40} color={m3.colorScheme.primary} />
        </View>
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
            textAlign: 'center',
          }}
        >
          No attendance data yet
        </Text>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: m3.colorScheme.onSurfaceVariant,
            textAlign: 'center',
            marginTop: spacing[2],
          }}
        >
          Mark attendance to start seeing analytics.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      showsVerticalScrollIndicator={false}
    >
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
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurfaceVariant,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Last 30 Days
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[3],
              marginTop: spacing[3],
            }}
          >
            <KpiCard label="Work Days" value={overview.totalWorkDays.toFixed(1)} />
            <KpiCard label="Attendance" value={`${Math.round(overview.attendanceRate * 100)}%`} />
            <KpiCard
              label="Earnings"
              value={formatCurrency(overview.totalEarnings, preferredCurrency)}
            />
            <KpiCard
              label="Net Balance"
              value={formatCurrency(overview.netBalance, preferredCurrency)}
            />
          </View>
        </View>
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
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[3],
            }}
          >
            Top Workers
          </Text>
          {topWorkers.map(({ worker, metrics }, index) => (
            <Pressable
              key={worker.id ?? index}
              onPress={() => router.push(`/worker-analytics/${worker.id}`)}
              style={({ pressed }) => ({
                paddingVertical: spacing[3],
                borderBottomWidth: index === topWorkers.length - 1 ? 0 : 1,
                borderColor: m3.colorScheme.outlineVariant,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <WorkerAnalyticsRow
                worker={worker}
                metrics={metrics}
                preferredCurrency={preferredCurrency}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  const m3 = useM3();
  return (
    <View
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        padding: spacing[3],
        borderRadius: borderRadius.lg,
        backgroundColor: m3.surface.surfaceContainerLow,
        borderWidth: 1,
        borderColor: m3.colorScheme.outlineVariant,
      }}
    >
      <Text
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          color: m3.colorScheme.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          marginTop: spacing[1],
          color: m3.colorScheme.onSurface,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function WorkerAnalyticsRow({
  worker,
  metrics,
  preferredCurrency,
}: {
  worker: Worker;
  metrics: WorkerAnalyticsMetrics;
  preferredCurrency: string;
}) {
  const m3 = useM3();
  const balanceColor = metrics.netBalance >= 0 ? m3.colorScheme.primary : m3.colorScheme.error;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
          }}
        >
          {worker.name}
        </Text>
        <Text
          style={{
            fontSize: fontSize.xs,
            color: m3.colorScheme.onSurfaceVariant,
            marginTop: spacing[1],
          }}
        >
          {Math.round(metrics.attendanceRate * 100)}% attendance ·{' '}
          {formatCurrency(metrics.earnings, preferredCurrency)}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: spacing[3],
          paddingVertical: 6,
          borderRadius: borderRadius.full,
          backgroundColor: colorWithOpacity(balanceColor, 0.12),
        }}
      >
        <Text
          style={{
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            color: balanceColor,
          }}
        >
          {formatCurrency(metrics.netBalance, preferredCurrency)}
        </Text>
      </View>
    </View>
  );
}
