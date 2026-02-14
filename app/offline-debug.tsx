/**
 * Offline Debug Screen (dev-only)
 *
 * Shows: network status, sync queue length/status, last sync timestamp,
 * sync analytics, background task history, circuit breaker states,
 * and structured log entries.
 *
 * Phase 8 of offline functionality.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { useSyncStore, selectPendingCount, selectFailedCount } from '@/stores/sync-store';
import { getBackgroundTaskHistory, type BackgroundTaskRecord } from '@/services/background-sync';
import {
  getOfflineLogEntries,
  clearOfflineLog,
  getSyncAnalytics,
  resetSyncAnalytics,
  type OfflineLogEntry,
  type SyncAnalytics,
} from '@/services/offline-logger';
import {
  syncCircuitBreaker,
  mediaUploadCircuitBreaker,
  backgroundSyncCircuitBreaker,
  type CircuitBreakerSnapshot,
} from '@/services/circuit-breaker';
import { spacing, fontSize, fontWeight, borderRadius } from '@/styles/theme';

// ── Guard: only accessible in dev ──────────────────────────────────

export default function OfflineDebugScreen() {
  if (!__DEV__) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>This screen is only available in development mode.</Text>
      </View>
    );
  }

  return <OfflineDebugContent />;
}

// ── Main content ───────────────────────────────────────────────────

function OfflineDebugContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const network = useNetworkStatus();
  const { lastSyncAt, isSyncing, pendingCount, triggerSync } = useBackgroundSync();
  const failedCount = useSyncStore(selectFailedCount);
  const totalPending = useSyncStore(selectPendingCount);
  const syncItems = useSyncStore((s) => s.items);

  const [logEntries, setLogEntries] = useState<readonly OfflineLogEntry[]>([]);
  const [taskHistory, setTaskHistory] = useState<readonly BackgroundTaskRecord[]>([]);
  const [analyticsData, setAnalyticsData] = useState<SyncAnalytics | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<
    Array<{ name: string; snapshot: CircuitBreakerSnapshot }>
  >([]);
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(() => {
    setLogEntries([...getOfflineLogEntries()].reverse());
    setTaskHistory([...getBackgroundTaskHistory()].reverse());
    setAnalyticsData(getSyncAnalytics());
    setCircuitBreakers([
      { name: 'sync-queue', snapshot: syncCircuitBreaker.getSnapshot() },
      { name: 'media-upload', snapshot: mediaUploadCircuitBreaker.getSnapshot() },
      { name: 'background-sync', snapshot: backgroundSyncCircuitBreaker.getSnapshot() },
    ]);
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3_000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const mono =
    Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) ?? 'monospace';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing[4],
        paddingBottom: insets.bottom + spacing[8],
        paddingHorizontal: spacing[4],
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Text style={{ fontSize: fontSize.lg, color: '#2563eb' }}>← Back</Text>
        </Pressable>
        <Text style={{ fontSize: fontSize['xl'], fontWeight: fontWeight.bold, color: '#111' }}>
          Offline Debug
        </Text>
      </View>

      {/* Network Status */}
      <SectionCard title="Network Status">
        <Row label="Connected" value={network.isConnected ? '✅ Yes' : '❌ No'} mono={mono} />
        <Row
          label="Internet Reachable"
          value={network.isInternetReachable ? '✅ Yes' : '❌ No'}
          mono={mono}
        />
        <Row label="Cellular" value={network.isCellular ? 'Yes' : 'No'} mono={mono} />
        <Row
          label="Just Reconnected"
          value={network.justReconnected ? '🔄 Yes' : 'No'}
          mono={mono}
        />
      </SectionCard>

      {/* Sync Queue */}
      <SectionCard title="Sync Queue">
        <Row label="Syncing" value={isSyncing ? '🔄 Yes' : 'No'} mono={mono} />
        <Row label="Pending Items" value={String(pendingCount)} mono={mono} />
        <Row label="Failed Items" value={String(failedCount)} mono={mono} />
        <Row label="Total Tracked" value={String(totalPending)} mono={mono} />
        <Row label="Last Sync" value={lastSyncAt ?? 'Never'} mono={mono} />

        <Pressable
          onPress={() => void triggerSync()}
          style={[styles.button, { marginTop: spacing[2] }]}
        >
          <Text style={styles.buttonText}>Trigger Sync Now</Text>
        </Pressable>

        {Object.values(syncItems).length > 0 && (
          <View style={{ marginTop: spacing[2] }}>
            <Text style={[styles.sectionLabel, { marginBottom: spacing[1] }]}>Queue Items:</Text>
            {Object.values(syncItems).map((item) => (
              <Text key={item.id} style={{ fontSize: fontSize.xs, fontFamily: mono, color: '#666' }}>
                [{item.status}] {item.label ?? item.id} (retries: {item.retries})
              </Text>
            ))}
          </View>
        )}
      </SectionCard>

      {/* Sync Analytics */}
      {analyticsData && (
        <SectionCard title="Sync Analytics">
          <Row label="Total Sync Attempts" value={String(analyticsData.totalSyncAttempts)} mono={mono} />
          <Row label="Successes" value={String(analyticsData.totalSyncSuccesses)} mono={mono} />
          <Row label="Failures" value={String(analyticsData.totalSyncFailures)} mono={mono} />
          <Row label="Items Synced" value={String(analyticsData.totalItemsSynced)} mono={mono} />
          <Row label="Items Failed" value={String(analyticsData.totalItemsFailed)} mono={mono} />
          <Row label="Conflicts" value={String(analyticsData.totalConflicts)} mono={mono} />
          <Row label="Conflicts Resolved" value={String(analyticsData.totalConflictsResolved)} mono={mono} />
          <Row label="Corrupt Entries" value={String(analyticsData.totalCorruptEntries)} mono={mono} />
          <Row label="Storage Warnings" value={String(analyticsData.totalStorageWarnings)} mono={mono} />

          <Pressable
            onPress={() => {
              resetSyncAnalytics();
              refreshData();
            }}
            style={[styles.button, { marginTop: spacing[2] }]}
          >
            <Text style={styles.buttonText}>Reset Analytics</Text>
          </Pressable>
        </SectionCard>
      )}

      {/* Circuit Breakers */}
      <SectionCard title="Circuit Breakers">
        {circuitBreakers.map((cb) => (
          <View key={cb.name} style={{ marginBottom: spacing[2] }}>
            <Text style={styles.sectionLabel}>{cb.name}</Text>
            <Row
              label="State"
              value={
                cb.snapshot.state === 'closed'
                  ? '🟢 closed'
                  : cb.snapshot.state === 'half_open'
                    ? '🟡 half_open'
                    : '🔴 open'
              }
              mono={mono}
            />
            <Row
              label="Consecutive Failures"
              value={String(cb.snapshot.consecutiveFailures)}
              mono={mono}
            />
            <Row
              label="Last Failure"
              value={
                cb.snapshot.lastFailureAt
                  ? new Date(cb.snapshot.lastFailureAt).toISOString()
                  : 'Never'
              }
              mono={mono}
            />
          </View>
        ))}
      </SectionCard>

      {/* Background Task History */}
      <SectionCard title="Background Task History">
        {taskHistory.length === 0 ? (
          <Text style={{ fontSize: fontSize.sm, color: '#888' }}>No tasks recorded yet.</Text>
        ) : (
          taskHistory.slice(0, 10).map((task, i) => (
            <View key={`${task.timestamp}-${i}`} style={{ marginBottom: spacing[2] }}>
              <Text style={{ fontSize: fontSize.xs, fontFamily: mono, color: '#666' }}>
                {task.timestamp} [{task.result}] {task.itemsSynced} items, {task.duration}ms
                {task.error ? ` — ${task.error}` : ''}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      {/* Offline Log */}
      <SectionCard title="Offline Event Log">
        <Pressable
          onPress={() => {
            clearOfflineLog();
            refreshData();
          }}
          style={[styles.button, { marginBottom: spacing[2] }]}
        >
          <Text style={styles.buttonText}>Clear Log</Text>
        </Pressable>

        {logEntries.length === 0 ? (
          <Text style={{ fontSize: fontSize.sm, color: '#888' }}>No events logged yet.</Text>
        ) : (
          logEntries.slice(0, 30).map((entry, i) => (
            <View key={`${entry.timestamp}-${i}`} style={{ marginBottom: spacing[1] }}>
              <Text style={{ fontSize: fontSize.xs, fontFamily: mono, color: '#666' }}>
                {entry.timestamp.split('T')[1]?.slice(0, 8)} [{entry.type}]
                {entry.error ? ` ⚠️ ${entry.error}` : ''}
                {entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : ''}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </ScrollView>
  );
}

// ── Reusable sub-components ────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: '#f5f5f5',
        borderRadius: borderRadius.xl,
        padding: spacing[4],
        marginBottom: spacing[3],
      }}
    >
      <Text
        style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.bold,
          color: '#111',
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
      <Text style={{ fontSize: fontSize.sm, color: '#888' }}>{label}</Text>
      <Text style={{ fontSize: fontSize.sm, fontFamily: mono, color: '#333' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#666',
  },
});
