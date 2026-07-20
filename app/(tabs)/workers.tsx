import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import {
  useWorkers,
  useDeleteWorker,
  useFabBottomPosition,
  isAndroid,
  useAllWorkerAttendance,
  useAllWorkerTransactions,
} from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/query-keys';
import { useModalStore } from '@/stores';
import { AttendanceView, WorkerAnalyticsView, TempWorkerForm } from '@/components/screens';
import { WorkerSettlementModal } from '@/components/modals/worker-settlement-modal';
import { Button, SegmentedControl } from '@/components/ui';
import type { Worker, WorkerAttendance, WorkerTransaction } from '@/types';
import { WorkerCard } from '@/components/cards';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';
import { GuidedTourTarget, GUIDED_TOUR_TARGET_IDS } from '@/features/guided-tour';
import { WorkersTourCoachmark } from '@/features/guided-tour/workers-tour-coachmark';
import { useWorkersTourStore } from '@/features/guided-tour/workers-tour-store';
import { WorkersFabSheet } from '@/components/modals/workers-fab-sheet';
import { computeWorkerMetrics, getDefaultDateRange } from '@/utils/worker-analytics';

type WorkersTab = 'workers' | 'attendance' | 'analytics';

interface WorkersTabMeta {
  id: WorkersTab;
  labelKey: string;
}

const TAB_DATA: WorkersTabMeta[] = [
  { id: 'workers', labelKey: 'workers.tabs.workers' },
  { id: 'attendance', labelKey: 'workers.tabs.attendance' },
  { id: 'analytics', labelKey: 'workers.tabs.analytics' },
];

export default function WorkersScreen() {
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottomPosition();
  const { setAddWorker } = useModalStore();
  const queryClient = useQueryClient();
  const { data: workers, isLoading, refetch } = useWorkers();
  const { data: allAttendance, refetch: refetchAllAttendance } = useAllWorkerAttendance();
  const { data: allTransactions, refetch: refetchAllTransactions } = useAllWorkerTransactions();
  const deleteWorker = useDeleteWorker();

  const [selectedTab, setSelectedTab] = useState<WorkersTab>('workers');
  const [settlementModalVisible, setSettlementModalVisible] = useState(false);
  const [tempWorkerFormVisible, setTempWorkerFormVisible] = useState(false);
  const [fabSheetVisible, setFabSheetVisible] = useState(false);
  const [attendanceActionBarVisible, setAttendanceActionBarVisible] = useState(false);

  const { _hydrated, hasSeenTour, isActive: isTourActive, startTour } = useWorkersTourStore();
  useEffect(() => {
    if (!_hydrated) return;
    if (!hasSeenTour && !isTourActive) {
      const timer = setTimeout(() => startTour(), 600);
      return () => clearTimeout(timer);
    }
  }, [_hydrated, hasSeenTour, isTourActive, startTour]);

  const dateRange = useMemo(() => getDefaultDateRange(30), []);

  const activeWorkers = useMemo(() => workers?.filter((w) => w.is_active) || [], [workers]);
  const inactiveWorkers = useMemo(() => workers?.filter((w) => !w.is_active) || [], [workers]);
  const showPrimaryFab =
    (selectedTab !== 'attendance' || !attendanceActionBarVisible) &&
    (selectedTab !== 'workers' || activeWorkers.length > 0);

  // Per-worker attendance map for strip visualization
  const attendanceByWorker = useMemo(() => {
    if (!allAttendance) return new Map<number, WorkerAttendance[]>();
    const map = new Map<number, WorkerAttendance[]>();
    allAttendance.forEach((record) => {
      const arr = map.get(record.worker_id) || [];
      arr.push(record);
      map.set(record.worker_id, arr);
    });
    return map;
  }, [allAttendance]);

  // Per-worker transactions map for settlement-aware pending totals
  const transactionsByWorker = useMemo(() => {
    if (!allTransactions) return new Map<number, WorkerTransaction[]>();
    const map = new Map<number, WorkerTransaction[]>();
    allTransactions.forEach((tx) => {
      const arr = map.get(tx.worker_id) || [];
      arr.push(tx);
      map.set(tx.worker_id, arr);
    });
    return map;
  }, [allTransactions]);

  // Period summary across all active workers — uses netBalance so settled amounts are excluded
  const periodSummary = useMemo(() => {
    if (!workers || !allAttendance || !allTransactions) return null;
    let totalPending = 0;
    let totalDays = 0;
    workers
      .filter((w) => w.is_active && w.id !== undefined)
      .forEach((w) => {
        const wAttendance = attendanceByWorker.get(w.id!) || [];
        const wTransactions = transactionsByWorker.get(w.id!) || [];
        const metrics = computeWorkerMetrics(w, wAttendance, wTransactions, dateRange);
        totalPending += Math.max(0, metrics.netBalance);
        totalDays += metrics.fullDays + metrics.halfDays;
      });
    return { totalPending, totalDays };
  }, [
    workers,
    allAttendance,
    allTransactions,
    attendanceByWorker,
    transactionsByWorker,
    dateRange,
  ]);

  const handleDeleteWorker = (worker: Worker) => {
    Alert.alert(
      t('workers.alerts.deleteWorkerTitle'),
      t('workers.alerts.deleteWorkerBody', { name: worker.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (worker.id) {
              try {
                await deleteWorker.mutateAsync(worker.id);
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error ? error.message : t('common.errors.failedToDeleteWorker');
                Alert.alert(t('common.error'), errorMessage);
              }
            }
          },
        },
      ],
    );
  };

  const handleEditWorker = (worker: Worker) => {
    setAddWorker({ worker });
    router.push('/add-worker');
  };

  const handleViewWorkerDetail = (worker: Worker) => {
    if (worker.id) {
      router.push(`/worker-detail/${worker.id}`);
    } else {
      handleEditWorker(worker);
    }
  };

  const handleCloseSettlement = () => {
    setSettlementModalVisible(false);
  };

  const handleRefreshWorkers = () => {
    void Promise.all([refetch(), refetchAllAttendance(), refetchAllTransactions()]);
  };

  const handleSettlementSuccess = () => {
    handleRefreshWorkers();
    queryClient.invalidateQueries({ queryKey: queryKeys.workerAttendance.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.workerTransactions.all });
  };

  const handleFabPress = () => {
    setFabSheetVisible(true);
  };

  const renderWorker = ({ item }: { item: Worker }) => (
    <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[3] }}>
      <WorkerCard
        worker={item}
        onPress={() => handleViewWorkerDetail(item)}
        onEdit={() => handleEditWorker(item)}
        onDelete={() => handleDeleteWorker(item)}
        isActive={item.is_active}
        attendance={item.id !== undefined ? attendanceByWorker.get(item.id) : undefined}
      />
    </View>
  );

  const renderPeriodSummaryBand = () => {
    if (!periodSummary || activeWorkers.length === 0) return null;
    return (
      <View style={{ marginHorizontal: spacing[4], marginBottom: spacing[3] }}>
        <View
          style={{
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: m3.surface.s300,
            borderRadius: radius.lg,
            padding: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: '600',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: m3.surface.s500,
              }}
            >
              {t('workers.period.thisMonth', { defaultValue: 'This period · last 30 days' })}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <Text
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: '700',
                  color: m3.surface.s900,
                  fontVariant: ['tabular-nums'],
                }}
              >
                ₹{periodSummary.totalPending.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                {t('workers.period.pendingAcrossTeam', { defaultValue: 'pending across team' })}
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500, marginTop: 4 }}>
              {periodSummary.totalDays} {t('workers.period.days', { defaultValue: 'days' })} ·{' '}
              {activeWorkers.length} {t('workers.period.workers', { defaultValue: 'workers' })}
            </Text>
          </View>
          <Pressable
            onPress={() => setSettlementModalVisible(true)}
            style={({ pressed }) => ({
              height: 38,
              paddingHorizontal: 14,
              borderRadius: radius.md,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, pressed ? 0.9 : 1),
              alignItems: 'center',
              justifyContent: 'center',
            })}
            accessibilityRole="button"
            accessibilityLabel={t('workers.actions.settleAll', {
              defaultValue: 'Settle all workers',
            })}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: '600',
                color: m3.colorScheme.onPrimary,
              }}
            >
              {t('workers.actions.settleAll', { defaultValue: 'Settle' })}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderWorkersTab = () => (
    <FlatList
      data={activeWorkers}
      renderItem={renderWorker}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{
        paddingTop: isAndroid ? spacing[1] : spacing[3],
        paddingBottom: fabBottom + 56 + spacing[8],
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <>
          {renderPeriodSummaryBand()}
          {activeWorkers.length > 0 ? (
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.onSurfaceVariant,
                letterSpacing: 0.5,
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
              }}
            >
              {t('workers.lists.activeTitle', { count: activeWorkers.length })}
            </Text>
          ) : null}
        </>
      }
      ListFooterComponent={
        inactiveWorkers.length > 0 ? (
          <View style={{ marginTop: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.onSurfaceVariant,
                letterSpacing: 0.5,
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
              }}
            >
              {t('workers.lists.inactiveTitle', { count: inactiveWorkers.length })}
            </Text>
            {inactiveWorkers.map((worker) => (
              <View key={String(worker.id)} style={{ opacity: 0.6 }}>
                {renderWorker({ item: worker })}
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? (
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
              <UiSymbol name="person.2" size={40} color={m3.colorScheme.primary} />
            </View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurface,
                textAlign: 'center',
              }}
            >
              {t('workers.empty.title')}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurfaceVariant,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              {t('workers.empty.subtitle')}
            </Text>
            <View style={{ marginTop: spacing[4], width: '100%', maxWidth: 360 }}>
              <Button
                title={t('workers.form.saveAdd')}
                onPress={() => {
                  setAddWorker({ worker: null });
                  router.push('/add-worker');
                }}
              />
            </View>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={handleRefreshWorkers}
          tintColor={m3.colorScheme.primary}
        />
      }
    />
  );

  const renderAttendanceTab = () => (
    <AttendanceView
      workers={activeWorkers}
      onSaveSuccess={handleRefreshWorkers}
      onBottomActionBarVisibilityChange={setAttendanceActionBarVisible}
    />
  );

  const renderAnalyticsTab = () => <WorkerAnalyticsView />;

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          paddingTop: insets.top + spacing[2],
        }}
      >
        {/* Tab Selector */}
        <View
          style={{
            backgroundColor: m3.colorScheme.background,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: spacing[2],
          }}
        >
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.WORKERS_TAB_SELECTOR}
            enabled={isTourActive}
            style={{
              backgroundColor: m3.surface.s200,
              borderRadius: borderRadius.full,
              padding: 3,
            }}
          >
            <GuidedTourTarget
              targetId={GUIDED_TOUR_TARGET_IDS.WORKERS_ATTENDANCE_TAB}
              enabled={isTourActive}
            >
              <SegmentedControl
                options={TAB_DATA.map((tab) => ({ value: tab.id, label: t(tab.labelKey) }))}
                selectedValue={selectedTab}
                onSelect={(value) => setSelectedTab(value as WorkersTab)}
              />
            </GuidedTourTarget>
          </GuidedTourTarget>
        </View>
        <View
          style={{
            height: isAndroid ? 1 : 0.5,
            backgroundColor: m3.colorScheme.outlineVariant,
            marginHorizontal: spacing[4],
          }}
        />

        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'attendance' && renderAttendanceTab()}
        {selectedTab === 'analytics' && renderAnalyticsTab()}

        {showPrimaryFab && (
          <GuidedTourTarget
            targetId={GUIDED_TOUR_TARGET_IDS.WORKERS_FAB}
            enabled={isTourActive}
            style={{
              position: 'absolute',
              bottom: fabBottom,
              right: spacing[6],
            }}
          >
            <Pressable
              onPress={handleFabPress}
              style={{
                width: 56,
                height: 56,
                backgroundColor: m3.colorScheme.primary,
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
              accessibilityRole="button"
              accessibilityLabel={t('workers.actions.title')}
            >
              {({ pressed }) => (
                <>
                  <UiSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      },
                    ]}
                  />
                </>
              )}
            </Pressable>
          </GuidedTourTarget>
        )}
      </View>

      <WorkersTourCoachmark onNavigateToAttendance={() => setSelectedTab('attendance')} />

      <WorkersFabSheet
        visible={fabSheetVisible}
        onClose={() => setFabSheetVisible(false)}
        onAddWorker={() => {
          setAddWorker({ worker: null });
          router.push('/add-worker');
        }}
        onSettlePayment={() => setSettlementModalVisible(true)}
        onAddTempWorker={() => setTempWorkerFormVisible(true)}
      />

      <WorkerSettlementModal
        visible={settlementModalVisible}
        onClose={handleCloseSettlement}
        workers={activeWorkers}
        onSuccess={handleSettlementSuccess}
      />

      <TempWorkerForm
        visible={tempWorkerFormVisible}
        onClose={() => setTempWorkerFormVisible(false)}
        onSaveSuccess={() => {
          setTempWorkerFormVisible(false);
          refetch();
        }}
      />
    </>
  );
}
