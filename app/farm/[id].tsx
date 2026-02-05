import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import { Button } from '@/components/ui';
import {
  useFarm,
  useFarmRecords,
  useWeather,
  useDeleteFarm,
  useDeleteExpenseRecord,
  useDeleteFertigationRecord,
  useDeleteHarvestRecord,
  useDeleteIrrigationRecord,
  useDeleteSprayRecord,
  useCapabilities,
} from '@/hooks';
import { useTasks, useCompleteTask, useDeleteTask } from '@/hooks/use-tasks';
import { StatsCard, ActivityLogCard, TaskRow } from '@/components/cards';
import { useTranslation } from 'react-i18next';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { useModalStore } from '@/stores';
import { useM3, useThemeColors } from '@/styles/use-theme';

// Workboard action type
interface WorkboardAction {
  id: string;
  titleKey: string;
  icon: string;
  color: string;
  route?: string;
}

export default function FarmDetailScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const { setEditActivity, setAddEntry } = useModalStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const farmId = id ? parseInt(id, 10) : undefined;

  const { data: farm, isLoading: farmLoading, refetch: refetchFarm } = useFarm(farmId);
  const { data: capabilities } = useCapabilities();
  const retentionMonths = capabilities.capabilities.logs.retentionMonths;
  const {
    irrigationRecords,
    sprayRecords,
    harvestRecords,
    expenseRecords,
    fertigationRecords,
    refetch: refetchRecords,
  } = useFarmRecords(farmId, retentionMonths);

  const { data: tasks, refetch: refetchTasks } = useTasks(farmId);
  const { data: weather } = useWeather(farm?.latitude ?? undefined, farm?.longitude ?? undefined);
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const deleteFarmMutation = useDeleteFarm();
  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'activities' | 'tasks'>('activities');
  const showFab = isAndroid;
  const bottomBarHeight = showFab ? 0 : 72 + insets.bottom;
  const workboardActions = useMemo<WorkboardAction[]>(
    () => [
      {
        id: 'ai',
        titleKey: 'farmDetails.workboard.actions.ai',
        icon: 'lightbulb.fill',
        color: m3.colorScheme.primary,
      },
      {
        id: 'lab',
        titleKey: 'farmDetails.workboard.actions.lab',
        icon: 'flask.fill',
        color: m3.colorScheme.secondary,
      },
      {
        id: 'reports',
        titleKey: 'farmDetails.workboard.actions.reports',
        icon: 'chart.bar.fill',
        color: m3.colorScheme.tertiary,
      },
      {
        id: 'soil',
        titleKey: 'farmDetails.workboard.actions.soilMoisture',
        icon: 'square.stack.3d.up.fill',
        color: colors.task[500],
      },
    ],
    [colors.task, m3],
  );

  const aiEnabled = capabilities.capabilities.ai.chatbot;
  const soilWaterManualEnabled = capabilities.capabilities.soilWater.manualUpdate;

  // Calculate stats
  const totalRecords = useMemo(
    () =>
      (irrigationRecords?.length || 0) +
      (sprayRecords?.length || 0) +
      (harvestRecords?.length || 0) +
      (expenseRecords?.length || 0) +
      (fertigationRecords?.length || 0),
    [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords],
  );

  const totalWaterUsed = useMemo(() => {
    if (!irrigationRecords) return null;
    return irrigationRecords.reduce(
      (sum, record) => sum + (record.duration || 0) * (record.system_discharge || 0),
      0,
    );
  }, [irrigationRecords]);

  const formatWaterUsage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return t('farmDetails.water.noIrrigationLoggedYet');
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return t('farmDetails.water.mmUsed', { value: value.toFixed(digits) });
  };

  const waterUsageCaption =
    totalWaterUsed !== null
      ? t('farmDetails.water.captionThisSeason', { usage: formatWaterUsage(totalWaterUsed) })
      : t('farmDetails.water.captionLogIrrigation');

  // Days since pruning
  const daysSincePruning = useMemo(() => {
    if (!farm?.date_of_pruning) return null;
    const pruningDate = new Date(farm.date_of_pruning);
    const today = new Date();
    const diffTime = today.getTime() - pruningDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }, [farm]);

  // Recent activity logs - combine and sort
  const RECENT_ACTIVITY_LIMIT = 10;
  const recentLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'irrigation' | 'spray' | 'harvest' | 'expense' | 'fertigation';
      date: string;
      data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
    }> = [];

    irrigationRecords?.forEach((r) =>
      logs.push({
        id: `irrigation-${r.id}`,
        type: 'irrigation',
        date: r.date,
        data: r,
      }),
    );
    sprayRecords?.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        data: r,
      }),
    );
    harvestRecords?.forEach((r) =>
      logs.push({
        id: `harvest-${r.id}`,
        type: 'harvest',
        date: r.date,
        data: r,
      }),
    );
    expenseRecords?.forEach((r) =>
      logs.push({
        id: `expense-${r.id}`,
        type: 'expense',
        date: r.date,
        data: r,
      }),
    );
    fertigationRecords?.forEach((r) =>
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        data: r,
      }),
    );

    return logs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }, [irrigationRecords, sprayRecords, harvestRecords, expenseRecords, fertigationRecords]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchFarm(), refetchRecords(), refetchTasks()]);
    setRefreshing(false);
  };

  const handleAddActivity = () => {
    if (!farm?.id) return;
    router.push({
      pathname: '/log-entry/add',
      params: {
        farmId: farm.id.toString(),
      },
    });
  };

  const handleAddTask = () => {
    if (!farm?.id) return;
    router.push({
      pathname: '/add-entry',
      params: {
        farmId: farm.id.toString(),
        initialTab: 'task',
        tabs: 'log,task',
      },
    });
  };

  const handleEditActivity = (log: (typeof recentLogs)[number]) => {
    if (!farm) return;
    setEditActivity({
      farm,
      logType: log.type,
      record: log.data,
    });
    router.push(`/log-entry/edit/${log.id}`);
  };

  const handleDeleteActivity = (log: (typeof recentLogs)[number]) => {
    Alert.alert(
      t('logs.delete.title'),
      t('logs.delete.body', {
        type: t(`logs.types.${log.type}`),
        date: formatDate(new Date(log.date), { month: 'short', day: 'numeric' }),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const record = log.data as
                | IrrigationRecord
                | SprayRecord
                | HarvestRecord
                | ExpenseRecord
                | FertigationRecord;
              const farmIdNum =
                farm?.id ??
                (record.farm_id
                  ? typeof record.farm_id === 'string'
                    ? parseInt(record.farm_id, 10)
                    : record.farm_id
                  : undefined);

              if (!farmIdNum) {
                Alert.alert(t('common.error'), t('common.errors.cannotDeleteLogFarmIdNotFound'));
                return;
              }

              switch (log.type) {
                case 'irrigation': {
                  const r = record as IrrigationRecord;
                  if (r.id) await deleteIrrigation.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'spray': {
                  const r = record as SprayRecord;
                  if (r.id) await deleteSpray.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'harvest': {
                  const r = record as HarvestRecord;
                  if (r.id) await deleteHarvest.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'expense': {
                  const r = record as ExpenseRecord;
                  if (r.id) await deleteExpense.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
                case 'fertigation': {
                  const r = record as FertigationRecord;
                  if (r.id) await deleteFertigation.mutateAsync({ id: r.id, farmId: farmIdNum });
                  break;
                }
              }
            } catch (_error) {
              Alert.alert(t('common.error'), t('common.errors.failedToDeleteLog'));
            }
          },
        },
      ],
    );
  };

  const handleCompleteTask = (taskId: number) => {
    Alert.alert(t('tasks.alerts.completeTitle'), t('tasks.alerts.completeBodyGeneric'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.complete'),
        onPress: () => {
          completeMutation.mutate(taskId, {
            onSuccess: () => {
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert(
                t('common.error'),
                error.message || t('farmDetails.errors.completeTaskFailed'),
              );
            },
          });
        },
      },
    ]);
  };

  const handleDeleteTask = (taskId: number, taskTitle: string) => {
    Alert.alert(t('tasks.alerts.deleteTitle'), t('tasks.alerts.deleteBody', { title: taskTitle }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(taskId, {
            onSuccess: () => {
              refetchTasks();
            },
            onError: (error: Error) => {
              Alert.alert(
                t('common.error'),
                error.message || t('farmDetails.errors.deleteTaskFailed'),
              );
            },
          });
        },
      },
    ]);
  };

  const handleDeleteFarm = () => {
    if (!farmId || !farm) return;
    Alert.alert(
      t('farmDetails.deleteFarmTitle'),
      t('farmDetails.deleteFarmBody', { name: farm.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteFarmMutation.mutate(farmId, {
              onSuccess: () => {
                router.back();
              },
              onError: (error: Error) => {
                Alert.alert(
                  t('common.error'),
                  error.message || t('farmDetails.errors.deleteFarmFailed'),
                );
              },
            });
          },
        },
      ],
    );
  };

  const handleWorkboardAction = (action: WorkboardAction) => {
    switch (action.id) {
      case 'ai':
        if (!aiEnabled) {
          router.push('/locked?feature=ai');
          return;
        }
        router.push(`/ai-chat?id=${id}`);
        break;
      case 'lab':
        router.push(`/lab-tests?farmId=${id}`);
        break;
      case 'reports':
        router.push('/reports');
        break;
      case 'soil':
        router.push(`/soil-profiling?farmId=${id}`);
        break;
    }
  };

  if (farmLoading && !farm) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.surface,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[4] }}>
          {t('farmDetails.loadingFarm')}
        </Text>
      </View>
    );
  }

  if (!farm) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.surface,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}
      >
        <UiSymbol
          name="alert-circle-outline"
          size={48}
          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
        />
        <Text
          style={{
            color: m3.colorScheme.onSurface,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            marginTop: spacing[4],
          }}
        >
          {t('farmDetails.notFound.title')}
        </Text>
        <View style={{ marginTop: spacing[4], width: '100%', maxWidth: 320 }}>
          <Button title={t('common.goBack')} variant="outline" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: farm.name,
          headerStyle: { backgroundColor: m3.colorScheme.surface },
          headerTintColor: m3.colorScheme.onSurface,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push(`/farm/${id}/edit`)}
                style={{ marginRight: spacing[4] }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('farmDetails.a11y.editFarm')}
              >
                {({ pressed }) => (
                  <View style={{ borderRadius: 9999, overflow: 'hidden' }}>
                    <View style={{ padding: 4 }}>
                      <UiSymbol name="create-outline" size={24} color={m3.colorScheme.primary} />
                    </View>
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          backgroundColor: pressed
                            ? colorWithOpacity(
                                m3.colorScheme.onSurface,
                                m3.stateLayerOpacity.pressed,
                              )
                            : 'transparent',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={handleDeleteFarm}
                style={{
                  marginRight: spacing[2],
                  opacity: deleteFarmMutation.isPending ? 0.5 : 1,
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={deleteFarmMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('farmDetails.a11y.deleteFarm')}
              >
                {({ pressed }) => (
                  <View style={{ borderRadius: 9999, overflow: 'hidden' }}>
                    <View style={{ padding: 4 }}>
                      {deleteFarmMutation.isPending ? (
                        <ActivityIndicator size="small" color={m3.colorScheme.error} />
                      ) : (
                        <UiSymbol name="trash" size={24} color={m3.colorScheme.error} />
                      )}
                    </View>
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          backgroundColor:
                            pressed && !deleteFarmMutation.isPending
                              ? colorWithOpacity(
                                  m3.colorScheme.onSurface,
                                  m3.stateLayerOpacity.pressed,
                                )
                              : 'transparent',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
            </View>
          ),
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  color: m3.colorScheme.onSurface,
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.bold,
                }}
              >
                {farm.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: m3.colorScheme.onSurfaceVariant, fontSize: fontSize.xs }}>
                  {farm.crop_variety || farm.crop}
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onSurfaceVariant,
                    fontSize: fontSize.xs,
                    marginHorizontal: spacing[1],
                  }}
                >
                  •
                </Text>
                <View
                  style={{
                    backgroundColor: m3.colorScheme.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.full,
                  }}
                >
                  <UiSymbol name="resize" size={10} color={m3.colorScheme.onPrimary} />
                  <Text
                    style={{
                      color: m3.colorScheme.onPrimary,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      marginLeft: spacing[1],
                    }}
                  >
                    {farm.area != null
                      ? t('farmDetails.header.areaAcres', { value: farm.area.toFixed(1) })
                      : t('farmDetails.header.areaAcresUnknown')}
                  </Text>
                </View>
              </View>
            </View>
          ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + spacing[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={m3.colorScheme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Farm Header */}
          <View
            style={{
              marginHorizontal: spacing[4],
              marginTop: spacing[2],
              borderRadius: m3.shape.cornerLarge,
              overflow: 'hidden',
              backgroundColor: m3.surface.surfaceContainerLow,
              borderWidth: 1,
              borderColor: m3.colorScheme.outlineVariant,
            }}
          >
            <View style={{ padding: spacing[4] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: m3.colorScheme.primaryContainer,
                        borderRadius: m3.shape.cornerMedium,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UiSymbol name="leaf.fill" size={24} color={m3.colorScheme.primary} />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurface,
                            ...m3.typography.titleMedium,
                          }}
                        >
                          {farm.name}
                        </Text>
                        {daysSincePruning !== null && (
                          <View
                            style={{
                              marginLeft: spacing[2],
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                              borderRadius: borderRadius.full,
                              backgroundColor: m3.colorScheme.warning,
                            }}
                          >
                            <UiSymbol
                              name="cut-outline"
                              size={10}
                              color={m3.colorScheme.onWarning}
                            />
                            <Text
                              style={{
                                color: m3.colorScheme.onWarning,
                                ...m3.typography.labelSmall,
                                fontWeight: fontWeight.bold,
                                marginLeft: spacing[1],
                              }}
                            >
                              {t('farmDetails.pruning.daysShort', { count: daysSincePruning })}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={{
                          color: m3.colorScheme.onSurfaceVariant,
                          ...m3.typography.bodyMedium,
                        }}
                      >
                        {farm.crop_variety || farm.crop}
                      </Text>
                    </View>
                  </View>

                  {farm.region && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: spacing[3],
                      }}
                    >
                      <UiSymbol
                        name="location-outline"
                        size={16}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                      />
                      <Text
                        style={{
                          color: m3.colorScheme.onSurfaceVariant,
                          ...m3.typography.bodyMedium,
                          marginLeft: spacing[1],
                        }}
                      >
                        {farm.region}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Weather info */}
              {weather && (
                <View
                  style={{
                    marginTop: spacing[4],
                    paddingTop: spacing[4],
                    borderTopWidth: 1,
                    borderTopColor: m3.colorScheme.outlineVariant,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          backgroundColor: m3.colorScheme.primaryContainer,
                          borderRadius: m3.shape.cornerSmall,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UiSymbol name="partly-sunny" size={16} color={m3.colorScheme.primary} />
                      </View>
                      <View style={{ marginLeft: spacing[2] }}>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurfaceVariant,
                            ...m3.typography.labelSmall,
                          }}
                        >
                          {t('farmDetails.weather.current')}
                        </Text>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurface,
                            ...m3.typography.labelLarge,
                            fontWeight: fontWeight.semibold,
                          }}
                        >
                          {weather.current.condition}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurface,
                            fontSize: fontSize.lg,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          {weather.current.temperature}°
                        </Text>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurfaceVariant,
                            ...m3.typography.labelSmall,
                          }}
                        >
                          {t('farmDetails.weather.temperature')}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 1,
                          height: 32,
                          backgroundColor: m3.colorScheme.outlineVariant,
                        }}
                      />
                      <View style={{ alignItems: 'center' }}>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurface,
                            fontSize: fontSize.lg,
                            fontWeight: fontWeight.bold,
                          }}
                        >
                          {weather.forecast[0]?.et0 ?? 0}
                        </Text>
                        <Text
                          style={{
                            color: m3.colorScheme.onSurfaceVariant,
                            ...m3.typography.labelSmall,
                          }}
                        >
                          {t('farmDetails.weather.et0Mm')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Stats Grid - iOS Style */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title={t('farmDetails.stats.logEntriesTitle')}
                  value={totalRecords.toString()}
                  icon="document-text"
                  iconColor={m3.colorScheme.primary}
                  subtitle={t('farmDetails.stats.recordsSubtitle')}
                  onPress={() => router.push(`/logs?farmId=${id}`)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <StatsCard
                  title={t('farmDetails.stats.soilWaterTitle')}
                  value={farm.remaining_water ? farm.remaining_water.toFixed(1) : '--'}
                  icon="water"
                  iconColor={colors.irrigation[500]}
                  subtitle={waterUsageCaption}
                  onPress={() => {
                    if (!farm?.id) return;
                    if (!soilWaterManualEnabled) {
                      router.push('/locked?feature=soilWater');
                      return;
                    }
                    router.push({
                      pathname: '/water-level',
                      params: { farmId: farm.id.toString() },
                    });
                  }}
                />
              </View>
            </View>
          </View>

          {/* Workboard Section */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.labelSmall,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
                marginBottom: spacing[1],
              }}
            >
              {t('farmDetails.workboard.title')}
            </Text>
            <Text
              style={{
                color: m3.colorScheme.onSurfaceVariant,
                ...m3.typography.bodyMedium,
                marginBottom: spacing[2],
              }}
            >
              {t('farmDetails.workboard.subtitle')}
            </Text>

            <View
              style={{
                borderRadius: m3.shape.cornerLarge,
                padding: spacing[4],
                marginTop: spacing[2],
                backgroundColor: m3.surface.surfaceContainerLow,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row' }}>
                {workboardActions.map((action) => (
                  <Pressable
                    key={action.id}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: spacing[2] }}
                    onPress={() => handleWorkboardAction(action)}
                    accessibilityRole="button"
                    accessibilityLabel={t(action.titleKey)}
                  >
                    {({ pressed }) => {
                      const isLocked = action.id === 'ai' && !aiEnabled;
                      return (
                        <View
                          style={{
                            alignItems: 'center',
                            borderRadius: m3.shape.cornerMedium,
                            overflow: 'hidden',
                            paddingHorizontal: spacing[2],
                            paddingVertical: spacing[2],
                            opacity: isLocked ? 0.7 : 1,
                          }}
                        >
                          <View
                            style={{
                              borderRadius: borderRadius.full,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: spacing[2],
                              width: 40,
                              height: 40,
                              backgroundColor: colorWithOpacity(action.color, 0.12),
                            }}
                          >
                            <UiSymbol
                              name={isLocked ? 'lock.fill' : action.icon}
                              size={18}
                              color={action.color}
                            />
                          </View>
                          <Text
                            style={{
                              color: m3.colorScheme.onSurfaceVariant,
                              ...m3.typography.labelSmall,
                              fontWeight: fontWeight.medium,
                              textAlign: 'center',
                              lineHeight: 16,
                            }}
                          >
                            {t(action.titleKey)}
                          </Text>
                          {isLocked && (
                            <Text
                              style={{
                                marginTop: 2,
                                fontSize: fontSize.xs,
                                color: m3.colorScheme.primary,
                              }}
                            >
                              {t('subscription.badges.pro')}
                            </Text>
                          )}
                          <View
                            pointerEvents="none"
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                backgroundColor: pressed
                                  ? colorWithOpacity(
                                      m3.colorScheme.onSurface,
                                      m3.stateLayerOpacity.pressed,
                                    )
                                  : 'transparent',
                              },
                            ]}
                          />
                        </View>
                      );
                    }}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: m3.surface.surfaceContainerHigh,
                borderRadius: m3.shape.cornerLarge,
                borderWidth: 1,
                borderColor: m3.colorScheme.outlineVariant,
                overflow: 'hidden',
              }}
            >
              {(['activities', 'tasks'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => setSelectedTab(tab)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    tab === 'activities'
                      ? t('farmDetails.a11y.showActivities')
                      : t('farmDetails.a11y.showTasks')
                  }
                >
                  {({ pressed }) => {
                    const selected = selectedTab === tab;
                    const isFirst = tab === 'activities';
                    const isLast = tab === 'tasks';
                    return (
                      <View
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: spacing[3],
                          paddingHorizontal: spacing[2],
                          backgroundColor: selected
                            ? m3.colorScheme.primaryContainer
                            : 'transparent',
                          ...(selected
                            ? {
                                borderTopLeftRadius: isFirst ? m3.shape.cornerLarge : 0,
                                borderBottomLeftRadius: isFirst ? m3.shape.cornerLarge : 0,
                                borderTopRightRadius: isLast ? m3.shape.cornerLarge : 0,
                                borderBottomRightRadius: isLast ? m3.shape.cornerLarge : 0,
                                overflow: 'hidden',
                              }
                            : null),
                        }}
                      >
                        <Text
                          numberOfLines={isAndroid ? 2 : 1}
                          ellipsizeMode={isAndroid ? 'clip' : 'tail'}
                          style={{
                            width: '100%',
                            flexShrink: 1,
                            ...m3.typography.labelLarge,
                            fontWeight: fontWeight.semibold,
                            color: selected
                              ? m3.colorScheme.onPrimaryContainer
                              : m3.colorScheme.onSurfaceVariant,
                            textAlign: 'center',
                            maxWidth: '100%',
                            ...(isAndroid
                              ? {
                                  includeFontPadding: true,
                                  // Avoid occasional bottom clipping for Marathi glyphs in tight tab rows.
                                  paddingBottom: 2,
                                  // Prevent occasional right-edge glyph clipping due to pixel rounding.
                                  paddingRight: 3,
                                }
                              : null),
                          }}
                        >
                          {tab === 'activities'
                            ? t('farmDetails.tabs.activities')
                            : t('farmDetails.tabs.tasks')}
                        </Text>
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              backgroundColor: pressed
                                ? colorWithOpacity(
                                    m3.colorScheme.onSurface,
                                    m3.stateLayerOpacity.pressed,
                                  )
                                : 'transparent',
                            },
                          ]}
                        />
                      </View>
                    );
                  }}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tab Content */}
          <View
            style={{
              paddingHorizontal: spacing[4],
              marginTop: spacing[4],
              paddingBottom: spacing[8] + (showFab ? spacing[16] : bottomBarHeight + spacing[6]),
            }}
          >
            {selectedTab === 'activities' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    marginBottom: spacing[3],
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (!farm?.id) return;
                      router.push({
                        pathname: '/logs',
                        params: { farmId: farm.id.toString() },
                      });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('farmDetails.actions.seeAllActivities')}
                    style={({ pressed }) => ({
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                      borderRadius: m3.shape.cornerMedium,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        color: m3.colorScheme.primary,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.actions.seeAllActivities')}
                    </Text>
                  </Pressable>
                </View>
                {recentLogs.length > 0 ? (
                  <View style={{ gap: spacing[3] }}>
                    {recentLogs.map((log) => (
                      <ActivityLogCard
                        key={log.id}
                        type={log.type}
                        date={log.date}
                        data={log.data}
                        onEdit={() => handleEditActivity(log)}
                        onDelete={() => handleDeleteActivity(log)}
                      />
                    ))}
                  </View>
                ) : (
                  <View
                    style={{
                      borderRadius: m3.shape.cornerLarge,
                      alignItems: 'center',
                      padding: spacing[10],
                      backgroundColor: m3.surface.surfaceContainerLow,
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing[4],
                        backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                      }}
                    >
                      <UiSymbol
                        name="doc.text"
                        size={32}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                      />
                    </View>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.activities.empty.title')}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        fontSize: fontSize.sm,
                        textAlign: 'center',
                        marginTop: spacing[1],
                      }}
                    >
                      {t('farmDetails.activities.empty.subtitle')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {farm?.id ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      marginBottom: spacing[3],
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (!farm?.id) return;
                        router.push({
                          pathname: '/tasks',
                          params: { farmId: farm.id.toString() },
                        });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('farmDetails.actions.seeAllTasks')}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[1],
                        borderRadius: m3.shape.cornerMedium,
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                          : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          color: m3.colorScheme.primary,
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {t('farmDetails.actions.seeAllTasks')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {tasks && tasks.length > 0 ? (
                  <View style={{ gap: spacing[3] }}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        showFarmName={false}
                        onComplete={(item) => {
                          if (!item.id) return;
                          handleCompleteTask(item.id);
                        }}
                        onEdit={(item) => {
                          setAddEntry({
                            tabs: ['task'],
                            initialTab: 'task',
                            editingTask: item,
                          });
                          router.push({
                            pathname: '/add-entry',
                            params: { tabs: 'task', initialTab: 'task' },
                          });
                        }}
                        onDelete={(item) => {
                          if (!item.id) return;
                          handleDeleteTask(item.id, item.title);
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  <View
                    style={{
                      borderRadius: m3.shape.cornerLarge,
                      alignItems: 'center',
                      padding: spacing[10],
                      backgroundColor: m3.surface.surfaceContainerLow,
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: spacing[4],
                        backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
                      }}
                    >
                      <UiSymbol
                        name="checkbox-outline"
                        size={32}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                      />
                    </View>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurface,
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      {t('farmDetails.tasks.empty.title')}
                    </Text>
                    <Text
                      style={{
                        color: m3.colorScheme.onSurfaceVariant,
                        fontSize: fontSize.sm,
                        textAlign: 'center',
                        marginTop: spacing[1],
                      }}
                    >
                      {showFab
                        ? t('farmDetails.tasks.empty.subtitleAndroid')
                        : t('farmDetails.tasks.empty.subtitleIos')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Primary action */}
      {showFab ? (
        <Pressable
          onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
          accessibilityRole="button"
          accessibilityLabel={
            selectedTab === 'activities'
              ? t('farmDetails.actions.addActivity')
              : t('tasks.cta.addTask')
          }
          style={{
            position: 'absolute',
            bottom: spacing[6] + insets.bottom,
            right: spacing[6],
            width: 56,
            height: 56,
            backgroundColor: m3.colorScheme.primary,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {({ pressed }) => (
            <>
              <UiSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
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
      ) : (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: Math.max(insets.bottom, spacing[3]),
            backgroundColor: m3.surface.surfaceContainerLow,
            borderTopWidth: 1,
            borderTopColor: m3.colorScheme.outlineVariant,
          }}
        >
          <Button
            title={
              selectedTab === 'activities'
                ? t('farmDetails.actions.addActivity')
                : t('tasks.cta.addTask')
            }
            onPress={selectedTab === 'activities' ? handleAddActivity : handleAddTask}
          />
        </View>
      )}

      {/* Add Entry + Water Level handled via routes */}
    </>
  );
}
