import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency, formatDate } from '@/i18n/format';
import { getDefaultCurrency } from '@/i18n/currency';
import { useTranslation } from 'react-i18next';
import {
  useFarms,
  useFarmRecords,
  useDeleteIrrigationRecord,
  useDeleteSprayRecord,
  useDeleteHarvestRecord,
  useDeleteExpenseRecord,
  useDeleteFertigationRecord,
  useIrrigationRecordsByFarms,
  useSprayRecordsByFarms,
  useHarvestRecordsByFarms,
  useExpenseRecordsByFarms,
  useFertigationRecordsByFarms,
  useProfile,
} from '@/hooks';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import { useModalStore } from '@/stores';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3, useThemeColors } from '@/styles/use-theme';

interface CombinedLog {
  id: string;
  type: LogTypeId;
  date: string;
  description: string;
  data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
}

export default function LogsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const { setEditActivity } = useModalStore();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const currency = profile?.currency_preference ?? getDefaultCurrency();
  const filterCardStyle = Platform.select({
    ios: {
      shadowColor: m3.colorScheme.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
    default: {},
  });

  const { data: farms = [], isLoading: farmsLoading } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | undefined>(() => {
    if (!farmId) return undefined;
    const parsed = parseInt(farmId, 10);
    return isNaN(parsed) ? undefined : parsed;
  });

  // Set default farm when farms load
  React.useEffect(() => {
    if (!selectedFarmId && !farmId && farms.length > 0) {
      setSelectedFarmId(farms[0]?.id);
    }
  }, [farms, farmId, selectedFarmId]);

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId),
    [farms, selectedFarmId],
  );

  const {
    irrigationRecords = [],
    sprayRecords = [],
    harvestRecords = [],
    expenseRecords = [],
    fertigationRecords = [],
    isLoading: recordsLoading,
  } = useFarmRecords(selectedFarmId);

  const allFarmIds = useMemo(
    () => farms.map((f) => f.id).filter((id): id is number => id !== undefined),
    [farms],
  );

  const allRecordsIrrigation = useIrrigationRecordsByFarms(
    selectedFarmId === undefined ? allFarmIds : [],
  );
  const allRecordsSpray = useSprayRecordsByFarms(selectedFarmId === undefined ? allFarmIds : []);
  const allRecordsHarvest = useHarvestRecordsByFarms(
    selectedFarmId === undefined ? allFarmIds : [],
  );
  const allRecordsExpense = useExpenseRecordsByFarms(
    selectedFarmId === undefined ? allFarmIds : [],
  );
  const allRecordsFertigation = useFertigationRecordsByFarms(
    selectedFarmId === undefined ? allFarmIds : [],
  );

  const displayIrrigationRecords = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsIrrigation.data ?? []) : irrigationRecords),
    [selectedFarmId, allRecordsIrrigation.data, irrigationRecords],
  );
  const displaySprayRecords = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsSpray.data ?? []) : sprayRecords),
    [selectedFarmId, allRecordsSpray.data, sprayRecords],
  );
  const displayHarvestRecords = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsHarvest.data ?? []) : harvestRecords),
    [selectedFarmId, allRecordsHarvest.data, harvestRecords],
  );
  const displayExpenseRecords = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsExpense.data ?? []) : expenseRecords),
    [selectedFarmId, allRecordsExpense.data, expenseRecords],
  );
  const displayFertigationRecords = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsFertigation.data ?? []) : fertigationRecords),
    [selectedFarmId, allRecordsFertigation.data, fertigationRecords],
  );

  const isLoadingAllRecords =
    selectedFarmId === undefined
      ? allRecordsIrrigation.isLoading ||
        allRecordsSpray.isLoading ||
        allRecordsHarvest.isLoading ||
        allRecordsExpense.isLoading ||
        allRecordsFertigation.isLoading
      : recordsLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogTypes, setSelectedLogTypes] = useState<Set<LogTypeId>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deletingLog, setDeletingLog] = useState<CombinedLog | undefined>();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showFarmSelector, setShowFarmSelector] = useState(false);
  const [showRecordsPerPageSelector, setShowRecordsPerPageSelector] = useState(false);

  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();

  const openAndroidDatePicker = (current: Date | undefined, onSelect: (date: Date) => void) => {
    DateTimePickerAndroid.open({
      value: current ?? new Date(),
      mode: 'date',
      display: 'default',
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        onSelect(date);
      },
    });
  };

  const combinedLogs = useMemo<CombinedLog[]>(() => {
    const logs: CombinedLog[] = [];

    displayIrrigationRecords.forEach((r) => {
      const duration = r.duration ?? 0;
      const displayDuration = Number.isInteger(duration) ? duration : duration.toFixed(1);
      logs.push({
        id: `irrigation-${r.id}`,
        type: 'irrigation',
        date: r.date,
        description: t('logs.irrigationDurationHoursShort', { hours: displayDuration }),
        data: r,
      });
    });

    displaySprayRecords.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        description: r.chemical || t('logs.sprayApplication'),
        data: r,
      }),
    );

    displayHarvestRecords.forEach((r) =>
      logs.push({
        id: `harvest-${r.id}`,
        type: 'harvest',
        date: r.date,
        description: t('logs.harvestDescription', {
          quantityKg: (r.quantity ?? 0).toFixed(1),
          grade: r.grade || t('common.na'),
        }),
        data: r,
      }),
    );

    displayExpenseRecords.forEach((r) =>
      logs.push({
        id: `expense-${r.id}`,
        type: 'expense',
        date: r.date,
        description: t('logs.expenseDescription', {
          cost: formatCurrency(r.cost ?? 0, currency),
          type: r.type || t('common.general'),
        }),
        data: r,
      }),
    );

    displayFertigationRecords.forEach((r) =>
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        description: t('logs.fertigationApplied', {
          count: r.fertilizers?.length || 0,
          countFormatted: String(r.fertilizers?.length || 0),
        }),
        data: r,
      }),
    );

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    displayIrrigationRecords,
    displaySprayRecords,
    displayHarvestRecords,
    displayExpenseRecords,
    displayFertigationRecords,
    t,
    currency,
  ]);

  const filteredLogs = useMemo(() => {
    let logs = [...combinedLogs];

    if (searchQuery) {
      logs = logs.filter((log) =>
        log.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedLogTypes.size > 0) {
      logs = logs.filter((log) => selectedLogTypes.has(log.type));
    }

    if (dateFrom) {
      logs = logs.filter((log) => new Date(log.date) >= dateFrom);
    }

    if (dateTo) {
      const toDateEnd = new Date(dateTo);
      toDateEnd.setDate(toDateEnd.getDate() + 1);
      logs = logs.filter((log) => new Date(log.date) < toDateEnd);
    }

    return logs;
  }, [combinedLogs, searchQuery, selectedLogTypes, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));

  React.useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredLogs.slice(start, end);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleDeleteLog = useCallback(async () => {
    if (!deletingLog) return;

    try {
      const record = deletingLog.data as
        | IrrigationRecord
        | SprayRecord
        | HarvestRecord
        | ExpenseRecord
        | FertigationRecord;
      // Defensive: farm_id should be number per TypeScript types, but handle string
      // case in case Supabase returns strings (e.g., for certain database configs)
      const farmIdNum =
        selectedFarmId ??
        (record.farm_id
          ? typeof record.farm_id === 'string'
            ? parseInt(record.farm_id, 10)
            : record.farm_id
          : undefined);

      if (!farmIdNum) {
        Alert.alert(t('common.error'), t('common.errors.cannotDeleteLogFarmIdNotFound'));
        return;
      }

      switch (deletingLog.type) {
        case 'irrigation': {
          const r = record as IrrigationRecord;
          if (r.id) {
            await deleteIrrigation.mutateAsync({ id: r.id, farmId: farmIdNum });
          }
          break;
        }
        case 'spray': {
          const r = record as SprayRecord;
          if (r.id) {
            await deleteSpray.mutateAsync({ id: r.id, farmId: farmIdNum });
          }
          break;
        }
        case 'harvest': {
          const r = record as HarvestRecord;
          if (r.id) {
            await deleteHarvest.mutateAsync({ id: r.id, farmId: farmIdNum });
          }
          break;
        }
        case 'expense': {
          const r = record as ExpenseRecord;
          if (r.id) {
            await deleteExpense.mutateAsync({ id: r.id, farmId: farmIdNum });
          }
          break;
        }
        case 'fertigation': {
          const r = record as FertigationRecord;
          if (r.id) {
            await deleteFertigation.mutateAsync({ id: r.id, farmId: farmIdNum });
          }
          break;
        }
      }
      setShowDeleteConfirmation(false);
      setDeletingLog(undefined);
    } catch (_error) {
      Alert.alert(t('common.error'), t('common.errors.failedToDeleteLog'));
    }
  }, [
    deletingLog,
    selectedFarmId,
    deleteIrrigation,
    deleteSpray,
    deleteHarvest,
    deleteExpense,
    deleteFertigation,
    t,
  ]);

  const clearFilters = useCallback(() => {
    setSelectedLogTypes(new Set());
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  }, []);

  const handleItemsPerPageChange = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    setShowRecordsPerPageSelector(false);
  }, []);

  const handleAddActivity = useCallback(() => {
    if (selectedFarmId === undefined) return;
    router.push({
      pathname: '/log-entry/add',
      params: {
        farmId: selectedFarmId.toString(),
      },
    });
  }, [router, selectedFarmId]);

  const hasActiveFilters = selectedLogTypes.size > 0 || dateFrom || dateTo;

  if (farmsLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ marginTop: spacing[4], color: colors.surface[500] }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('logs.screenTitle'),
          headerStyle: { backgroundColor: m3.colorScheme.background },
          headerTintColor: m3.colorScheme.onBackground,
          headerRight: () =>
            selectedFarmId !== undefined && (
              <Pressable onPress={handleAddActivity} style={{ marginRight: spacing[4] }}>
                <UiSymbol name="plus.circle.fill" size={28} color={m3.colorScheme.primary} />
              </Pressable>
            ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background, paddingTop: insets.top }}>
        <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
          <LinearGradient
            colors={[colorWithOpacity(m3.colorScheme.primary, 0.08), 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Farm Selector */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  color: colors.surface[500],
                  marginBottom: spacing[2],
                }}
              >
                {t('logs.labels.selectedFarm')}
              </Text>
              <Pressable
                onPress={() => setShowFarmSelector(true)}
                style={{
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderRadius: borderRadius['2xl'],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        backgroundColor: m3.surface.surfaceContainerHigh,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UiSymbol
                        name={
                          selectedFarmId === undefined ? 'square.stack.3d.up.fill' : 'leaf.fill'
                        }
                        size={22}
                        color={m3.colorScheme.primary}
                      />
                    </View>
                    <View style={{ marginLeft: spacing[3] }}>
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          color: colors.surface[900],
                        }}
                      >
                        {selectedFarmId === undefined
                          ? t('logs.farmPicker.allFarms')
                          : selectedFarm?.name || t('logs.farmPicker.selectFarm')}
                      </Text>
                      {selectedFarm && (
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {selectedFarm.crop} • {selectedFarm.area.toFixed(1)} {t('units.acres')}
                        </Text>
                      )}
                      {selectedFarmId === undefined && (
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {t('logs.farmPicker.farmsCount', { count: farms.length })}
                        </Text>
                      )}
                    </View>
                  </View>
                  <UiSymbol
                    name="chevron.down"
                    size={20}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                  />
                </View>
              </Pressable>
            </View>

            {/* Search & Filters */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
              <View
                style={{
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                  backgroundColor: m3.surface.surfaceContainerLow,
                  borderWidth: 1,
                  borderColor: m3.colorScheme.outlineVariant,
                  ...(filterCardStyle ?? {}),
                }}
              >
                {/* Search Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: m3.surface.surfaceContainerHigh,
                    borderRadius: borderRadius.xl,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderWidth: 1,
                    borderColor: m3.colorScheme.outlineVariant,
                  }}
                >
                  <UiSymbol
                    name="magnifyingglass"
                    size={18}
                    color={m3.colorScheme.onSurfaceVariant}
                  />
                  <TextInput
                    placeholder={t('logs.search.placeholder')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={m3.colorScheme.onSurfaceVariant}
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: m3.colorScheme.onSurface,
                    }}
                  />
                  {searchQuery !== '' && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <UiSymbol
                        name="xmark.circle.fill"
                        size={18}
                        color={m3.colorScheme.onSurfaceVariant}
                      />
                    </Pressable>
                  )}
                </View>

                {/* Filter Controls */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: spacing[3],
                  }}
                >
                  <Pressable
                    onPress={() => setIsFilterSheetOpen(true)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: borderRadius.full,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.primary, 0.2)
                        : colorWithOpacity(m3.colorScheme.primary, 0.12),
                      borderWidth: 1,
                      borderColor: colorWithOpacity(m3.colorScheme.primary, 0.35),
                    })}
                  >
                    <UiSymbol
                      name="line.3.horizontal.decrease"
                      size={16}
                      color={m3.colorScheme.primary}
                    />
                    <Text
                      style={{
                        marginLeft: spacing[1],
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: m3.colorScheme.primary,
                      }}
                    >
                      {t('common.filter')}
                    </Text>
                    {hasActiveFilters && (
                      <View
                        style={{
                          marginLeft: spacing[2],
                          backgroundColor: m3.colorScheme.primary,
                          paddingHorizontal: spacing[2],
                          paddingVertical: 2,
                          borderRadius: borderRadius.full,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.bold,
                            color: m3.colorScheme.onPrimary,
                          }}
                        >
                          {selectedLogTypes.size + (dateFrom || dateTo ? 1 : 0)}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {hasActiveFilters && (
                    <Pressable
                      onPress={clearFilters}
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[1],
                        borderRadius: borderRadius.full,
                        backgroundColor: pressed
                          ? colorWithOpacity(m3.colorScheme.error, 0.12)
                          : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                          color: m3.colorScheme.error,
                        }}
                      >
                        {t('common.clearAll')}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {(selectedLogTypes.size > 0 ||
                  dateFrom ||
                  dateTo ||
                  selectedFarmId !== undefined) && (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: spacing[2],
                      marginTop: spacing[3],
                    }}
                  >
                    {LOG_TYPES.filter((lt) => lt.id !== 'note').map((logType) => {
                      if (!selectedLogTypes.has(logType.id as LogTypeId)) return null;
                      return (
                        <Pressable
                          key={logType.id}
                          onPress={() => {
                            const newSet = new Set(selectedLogTypes);
                            newSet.delete(logType.id as LogTypeId);
                            setSelectedLogTypes(newSet);
                            setCurrentPage(1);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: spacing[3],
                            paddingVertical: 6,
                            borderRadius: borderRadius.full,
                            backgroundColor: pressed
                              ? m3.surface.surfaceContainerHigh
                              : m3.surface.surfaceContainerLow,
                            borderWidth: 1,
                            borderColor: m3.colorScheme.outlineVariant,
                          })}
                        >
                          <UiSymbol
                            name={resolveSymbolIconName(logType.icon)}
                            size={12}
                            color={logType.color}
                          />
                          <Text
                            style={{
                              marginLeft: spacing[1],
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.semibold,
                              color: m3.colorScheme.onSurfaceVariant,
                            }}
                          >
                            {t(logType.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}

                    {selectedFarmId !== undefined && (
                      <Pressable
                        onPress={() => {
                          setSelectedFarmId(undefined);
                          setCurrentPage(1);
                        }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: spacing[3],
                          paddingVertical: 6,
                          borderRadius: borderRadius.full,
                          backgroundColor: pressed
                            ? m3.surface.surfaceContainerHigh
                            : m3.surface.surfaceContainerLow,
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                        })}
                      >
                        <UiSymbol name="leaf.fill" size={12} color={m3.colorScheme.primary} />
                        <Text
                          style={{
                            marginLeft: spacing[1],
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.semibold,
                            color: m3.colorScheme.onSurfaceVariant,
                          }}
                        >
                          {selectedFarm?.name ?? t('tasks.unknownFarm')}
                        </Text>
                      </Pressable>
                    )}

                    {(dateFrom || dateTo) && (
                      <Pressable
                        onPress={() => setIsFilterSheetOpen(true)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: spacing[3],
                          paddingVertical: 6,
                          borderRadius: borderRadius.full,
                          backgroundColor: pressed
                            ? m3.surface.surfaceContainerHigh
                            : m3.surface.surfaceContainerLow,
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                        })}
                      >
                        <UiSymbol name="calendar" size={12} color={m3.colorScheme.primary} />
                        <Text
                          style={{
                            marginLeft: spacing[1],
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.semibold,
                            color: m3.colorScheme.onSurfaceVariant,
                          }}
                        >
                          {dateFrom
                            ? formatDate(dateFrom, { month: 'short', day: 'numeric' })
                            : t('common.from')}
                          {' – '}
                          {dateTo
                            ? formatDate(dateTo, { month: 'short', day: 'numeric' })
                            : t('common.to')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Logs List */}
            <View
              style={{
                marginHorizontal: spacing[4],
                marginTop: spacing[4],
                paddingBottom: spacing[8],
              }}
            >
              {isLoadingAllRecords ? (
                <View style={{ gap: spacing[3] }}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={{
                        height: 80,
                        borderRadius: borderRadius['2xl'],
                        backgroundColor: colorWithOpacity(colors.surface[100], 0.7),
                      }}
                    />
                  ))}
                </View>
              ) : paginatedLogs.length === 0 ? (
                <View
                  style={{
                    borderRadius: borderRadius['2xl'],
                    alignItems: 'center',
                    padding: spacing[10],
                    backgroundColor: colorWithOpacity(colors.surface[100], 0.7),
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
                      backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
                    }}
                  >
                    <UiSymbol
                      name="calendar"
                      size={32}
                      color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                    }}
                  >
                    {t('logs.empty.title')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: colors.surface[500],
                      textAlign: 'center',
                      marginTop: spacing[1],
                    }}
                  >
                    {hasActiveFilters || searchQuery
                      ? t('logs.empty.subtitleFiltered')
                      : t('logs.empty.subtitleDefault')}
                  </Text>
                  {selectedFarmId !== undefined && !hasActiveFilters && !searchQuery ? (
                    <Pressable
                      onPress={handleAddActivity}
                      style={{
                        marginTop: spacing[4],
                        backgroundColor: m3.colorScheme.primary,
                        paddingHorizontal: spacing[6],
                        paddingVertical: spacing[3],
                        borderRadius: borderRadius.xl,
                      }}
                    >
                      <Text
                        style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold }}
                      >
                        {t('logs.cta.addActivity')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: spacing[3],
                      paddingHorizontal: spacing[1],
                    }}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                      {t('logs.pagination.showing', {
                        start: (currentPage - 1) * itemsPerPage + 1,
                        end: Math.min(currentPage * itemsPerPage, filteredLogs.length),
                        total: filteredLogs.length,
                      })}
                    </Text>
                    <Pressable
                      onPress={() => setShowRecordsPerPageSelector(true)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: pressed ? colors.surface[200] : colors.surface[50],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: borderRadius.lg,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.surface[500],
                        }}
                      >
                        {t('logs.pagination.perPage', { count: itemsPerPage })}
                      </Text>
                      <UiSymbol
                        name="chevron.down"
                        size={12}
                        color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                        style={{ marginLeft: spacing[1] }}
                      />
                    </Pressable>
                  </View>

                  <View style={{ gap: spacing[3] }}>
                    {paginatedLogs.map((log) => {
                      const logType = LOG_TYPES.find((lt) => lt.id === log.type);
                      const parsedDate = new Date(log.date);
                      return (
                        <View
                          key={log.id}
                          style={{
                            backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
                            borderRadius: borderRadius['2xl'],
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: spacing[4],
                            }}
                          >
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: borderRadius.full,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colorWithOpacity(
                                  logType?.color || m3.colorScheme.primary,
                                  0.12,
                                ),
                              }}
                            >
                              <UiSymbol
                                name={resolveSymbolIconName(logType?.icon)}
                                size={20}
                                color={logType?.color || m3.colorScheme.primary}
                              />
                            </View>
                            <View style={{ flex: 1, marginLeft: spacing[3] }}>
                              <Text
                                style={{
                                  fontSize: fontSize.sm,
                                  fontWeight: fontWeight.semibold,
                                  color: colors.surface[900],
                                }}
                              >
                                {logType ? t(logType.labelKey) : t('entryForm.addLog')}
                              </Text>
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  color: colors.surface[500],
                                  marginTop: 2,
                                }}
                                numberOfLines={1}
                              >
                                {log.description}
                              </Text>
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  color: colors.surface[500],
                                  marginTop: spacing[1],
                                }}
                              >
                                {formatDate(parsedDate, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                              <Pressable
                                onPress={() => {
                                  const logFarm =
                                    selectedFarm ||
                                    farms.find(
                                      (f) => f.id === (log.data as { farm_id?: number }).farm_id,
                                    );
                                  if (!logFarm) {
                                    Alert.alert(
                                      t('common.error'),
                                      t('common.errors.farmNotFoundForLog'),
                                    );
                                    return;
                                  }
                                  setEditActivity({
                                    farm: logFarm,
                                    logType: log.type,
                                    record: log.data,
                                  });
                                  router.push(`/log-entry/edit/${log.id}`);
                                }}
                                disabled={
                                  !(selectedFarm || (log.data as { farm_id?: number }).farm_id)
                                }
                                style={({ pressed }) => ({
                                  width: 44,
                                  height: 44,
                                  borderRadius: borderRadius.xl,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: pressed
                                    ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                                    : 'transparent',
                                  opacity:
                                    selectedFarm || (log.data as { farm_id?: number }).farm_id
                                      ? 1
                                      : 0.5,
                                })}
                              >
                                <UiSymbol
                                  name="pencil"
                                  size={20}
                                  color={
                                    selectedFarm || (log.data as { farm_id?: number }).farm_id
                                      ? m3.colorScheme.primary
                                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.6)
                                  }
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setDeletingLog(log);
                                  setShowDeleteConfirmation(true);
                                }}
                                style={({ pressed }) => ({
                                  width: 44,
                                  height: 44,
                                  borderRadius: borderRadius.xl,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: pressed
                                    ? colorWithOpacity(m3.colorScheme.error, 0.12)
                                    : 'transparent',
                                })}
                              >
                                <UiSymbol name="trash" size={20} color={m3.colorScheme.error} />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <View
                      style={{
                        marginTop: spacing[4],
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Pressable
                        onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          paddingHorizontal: spacing[4],
                          paddingVertical: spacing[2],
                          borderRadius: borderRadius.xl,
                          backgroundColor:
                            currentPage === 1 ? colors.surface[50] : m3.colorScheme.primary,
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      >
                        <UiSymbol
                          name="chevron.left"
                          size={18}
                          color={
                            currentPage === 1
                              ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                              : m3.colorScheme.onPrimary
                          }
                        />
                      </Pressable>

                      <View style={{ flexDirection: 'row' }}>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Pressable
                              key={pageNum}
                              onPress={() => setCurrentPage(pageNum)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: borderRadius.lg,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginHorizontal: 2,
                                backgroundColor:
                                  currentPage === pageNum
                                    ? m3.colorScheme.primary
                                    : colors.surface[50],
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  fontWeight: fontWeight.semibold,
                                  color:
                                    currentPage === pageNum
                                      ? m3.colorScheme.onPrimary
                                      : colors.gray[700],
                                }}
                              >
                                {pageNum}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable
                        onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          paddingHorizontal: spacing[4],
                          paddingVertical: spacing[2],
                          borderRadius: borderRadius.xl,
                          backgroundColor:
                            currentPage === totalPages
                              ? colors.surface[50]
                              : m3.colorScheme.primary,
                          opacity: currentPage === totalPages ? 0.5 : 1,
                        }}
                      >
                        <UiSymbol
                          name="chevron.right"
                          size={18}
                          color={
                            currentPage === totalPages
                              ? colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                              : m3.colorScheme.onPrimary
                          }
                        />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
          {selectedFarmId !== undefined ? (
            <Pressable
              onPress={handleAddActivity}
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
                shadowColor: m3.colorScheme.shadow,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 4,
              }}
              accessibilityRole="button"
              accessibilityLabel={t('logs.cta.addActivity')}
            >
              <UiSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Modals are now route-based */}
      {showFarmSelector && (
        <Modal
          transparent
          visible={showFarmSelector}
          onRequestClose={() => setShowFarmSelector(false)}
          animationType="slide"
        >
          <View style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3) }}>
            <View
              style={{
                flex: 1,
                marginTop: 'auto',
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                overflow: 'hidden',
                maxHeight: '78%',
                paddingTop: Math.max(insets.top, spacing[3]),
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 4,
                  backgroundColor: colors.surface[200],
                  borderRadius: borderRadius.full,
                  marginHorizontal: 'auto',
                  marginTop: spacing[3],
                  marginBottom: spacing[2],
                }}
              />
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  paddingHorizontal: spacing[6],
                  paddingTop: spacing[2],
                  paddingBottom: spacing[4],
                }}
              >
                {t('logs.farmPicker.title')}
              </Text>
              <ScrollView
                style={{ flex: 1, paddingHorizontal: spacing[4], paddingBottom: spacing[6] }}
              >
                <Pressable
                  onPress={() => {
                    setSelectedFarmId(undefined);
                    setCurrentPage(1);
                    setShowFarmSelector(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing[4],
                    borderRadius: borderRadius['2xl'],
                    marginBottom: spacing[2],
                    backgroundColor:
                      selectedFarmId === undefined ? m3.colorScheme.primary : colors.surface[50],
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: borderRadius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        selectedFarmId === undefined
                          ? colorWithOpacity(m3.colorScheme.onPrimary, 0.2)
                          : colorWithOpacity(m3.colorScheme.primary, 0.15),
                    }}
                  >
                    <UiSymbol
                      name="square.stack.3d.up.fill"
                      size={20}
                      color={
                        selectedFarmId === undefined
                          ? m3.colorScheme.onPrimary
                          : m3.colorScheme.primary
                      }
                    />
                  </View>
                  <View style={{ marginLeft: spacing[3], flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                        color:
                          selectedFarmId === undefined
                            ? m3.colorScheme.onPrimary
                            : colors.surface[900],
                      }}
                    >
                      {t('logs.farmPicker.allFarms')}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        color:
                          selectedFarmId === undefined
                            ? colorWithOpacity(m3.colorScheme.onPrimary, 0.8)
                            : colors.surface[500],
                      }}
                    >
                      {t('logs.farmPicker.farmsCount', { count: farms.length })}
                    </Text>
                  </View>
                  {selectedFarmId === undefined && (
                    <UiSymbol
                      name="checkmark.circle.fill"
                      size={22}
                      color={m3.colorScheme.onPrimary}
                    />
                  )}
                </Pressable>

                {farms.map((farm) => (
                  <Pressable
                    key={farm.id}
                    onPress={() => {
                      setSelectedFarmId(farm.id);
                      setCurrentPage(1);
                      setShowFarmSelector(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing[4],
                      borderRadius: borderRadius['2xl'],
                      marginBottom: spacing[2],
                      backgroundColor:
                        selectedFarmId === farm.id ? m3.colorScheme.primary : colors.surface[50],
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          selectedFarmId === farm.id
                            ? colorWithOpacity(m3.colorScheme.onPrimary, 0.2)
                            : colorWithOpacity(m3.colorScheme.primary, 0.15),
                      }}
                    >
                      <UiSymbol
                        name="leaf.fill"
                        size={20}
                        color={
                          selectedFarmId === farm.id
                            ? m3.colorScheme.onPrimary
                            : m3.colorScheme.primary
                        }
                      />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          color:
                            selectedFarmId === farm.id
                              ? m3.colorScheme.onPrimary
                              : colors.surface[900],
                        }}
                      >
                        {farm.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color:
                            selectedFarmId === farm.id
                              ? colorWithOpacity(m3.colorScheme.onPrimary, 0.8)
                              : colors.surface[500],
                        }}
                      >
                        {farm.crop} • {farm.area.toFixed(1)} {t('units.acres')}
                      </Text>
                    </View>
                    {selectedFarmId === farm.id && (
                      <UiSymbol
                        name="checkmark.circle.fill"
                        size={22}
                        color={m3.colorScheme.onPrimary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setShowFarmSelector(false)}
                style={{
                  marginHorizontal: spacing[4],
                  marginBottom: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: colors.surface[50],
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.gray[700] }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {showRecordsPerPageSelector && (
        <Modal
          transparent
          visible={showRecordsPerPageSelector}
          onRequestClose={() => setShowRecordsPerPageSelector(false)}
          animationType="fade"
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => setShowRecordsPerPageSelector(false)}
          >
            <View
              style={{
                width: '80%',
                maxWidth: 320,
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[6],
              }}
              onStartShouldSetResponder={() => true}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[4],
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {t('logs.pagination.recordsPerPage')}
                </Text>
                <Pressable onPress={() => setShowRecordsPerPageSelector(false)}>
                  <UiSymbol
                    name="xmark.circle.fill"
                    size={24}
                    color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                  />
                </Pressable>
              </View>
              {[10, 50, 100].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => handleItemsPerPageChange(value)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing[3],
                    borderRadius: borderRadius.xl,
                    backgroundColor: pressed ? colors.surface[100] : 'transparent',
                    marginBottom: spacing[2],
                  })}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: colors.surface[900],
                    }}
                  >
                    {value}
                  </Text>
                  {itemsPerPage === value && (
                    <UiSymbol
                      name="checkmark.circle.fill"
                      size={20}
                      color={m3.colorScheme.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}

      {isFilterSheetOpen && (
        <Modal
          transparent
          visible={isFilterSheetOpen}
          onRequestClose={() => setIsFilterSheetOpen(false)}
          animationType="slide"
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3) }}
          >
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: colors.surface[100],
                  borderTopLeftRadius: borderRadius['3xl'],
                  borderTopRightRadius: borderRadius['3xl'],
                  overflow: 'hidden',
                  height: '78%',
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 4,
                    backgroundColor: colors.surface[200],
                    borderRadius: borderRadius.full,
                    marginHorizontal: 'auto',
                    marginTop: spacing[3],
                    marginBottom: spacing[2],
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: spacing[6],
                    paddingTop: spacing[2],
                    paddingBottom: spacing[4],
                  }}
                >
                  <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>
                    {t('common.filter')}
                  </Text>
                  <Pressable onPress={() => setIsFilterSheetOpen(false)}>
                    <UiSymbol
                      name="xmark.circle.fill"
                      size={24}
                      color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flex: 1, paddingHorizontal: spacing[6] }}
                  contentContainerStyle={{ paddingBottom: spacing[4] }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[500],
                      marginBottom: spacing[2],
                    }}
                  >
                    {t('logs.filters.activityTypes')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                    {LOG_TYPES.filter((lt) => lt.id !== 'note').map((logType) => {
                      const isSelected = selectedLogTypes.has(logType.id as LogTypeId);
                      return (
                        <Pressable
                          key={logType.id}
                          onPress={() => {
                            const newSet = new Set(selectedLogTypes);
                            if (newSet.has(logType.id as LogTypeId)) {
                              newSet.delete(logType.id as LogTypeId);
                            } else {
                              newSet.add(logType.id as LogTypeId);
                            }
                            setSelectedLogTypes(newSet);
                            setCurrentPage(1);
                          }}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: spacing[3],
                            paddingVertical: 6,
                            borderRadius: borderRadius.full,
                            backgroundColor: isSelected
                              ? m3.colorScheme.primary
                              : pressed
                                ? m3.surface.surfaceContainerHigh
                                : m3.surface.surfaceContainerLow,
                            borderWidth: isSelected ? 0 : 1,
                            borderColor: m3.colorScheme.outlineVariant,
                          })}
                        >
                          <UiSymbol
                            name={resolveSymbolIconName(logType.icon)}
                            size={14}
                            color={isSelected ? m3.colorScheme.onPrimary : logType.color}
                          />
                          <Text
                            style={{
                              marginLeft: spacing[1],
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.semibold,
                              color: isSelected ? m3.colorScheme.onPrimary : colors.gray[700],
                            }}
                          >
                            {t(logType.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[500],
                      marginTop: spacing[5],
                      marginBottom: spacing[2],
                    }}
                  >
                    {t('logs.filters.dateRange')}
                  </Text>

                  {Platform.OS === 'android' ? (
                    <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                      <Pressable
                        onPress={() => openAndroidDatePicker(dateFrom, (date) => setDateFrom(date))}
                        style={{ flex: 1 }}
                      >
                        <View
                          style={{
                            backgroundColor: m3.surface.surfaceContainerLow,
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                            borderRadius: borderRadius.xl,
                            borderWidth: 1,
                            borderColor: m3.colorScheme.outlineVariant,
                          }}
                        >
                          <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                            {t('common.from')}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.surface[900],
                            }}
                          >
                            {dateFrom
                              ? formatDate(dateFrom, { month: 'short', day: 'numeric' })
                              : t('common.selectDate')}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() => openAndroidDatePicker(dateTo, (date) => setDateTo(date))}
                        style={{ flex: 1 }}
                      >
                        <View
                          style={{
                            backgroundColor: m3.surface.surfaceContainerLow,
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                            borderRadius: borderRadius.xl,
                            borderWidth: 1,
                            borderColor: m3.colorScheme.outlineVariant,
                          }}
                        >
                          <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                            {t('common.to')}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.surface[900],
                            }}
                          >
                            {dateTo
                              ? formatDate(dateTo, { month: 'short', day: 'numeric' })
                              : t('common.selectDate')}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={{ gap: spacing[4] }}>
                      <View
                        style={{
                          padding: spacing[3],
                          borderRadius: borderRadius.xl,
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                          backgroundColor: m3.surface.surfaceContainerLow,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {t('common.from')}
                        </Text>
                        <DateTimePicker
                          value={dateFrom || new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) setDateFrom(date);
                          }}
                          style={{ height: 140 }}
                        />
                      </View>
                      <View
                        style={{
                          padding: spacing[3],
                          borderRadius: borderRadius.xl,
                          borderWidth: 1,
                          borderColor: m3.colorScheme.outlineVariant,
                          backgroundColor: m3.surface.surfaceContainerLow,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {t('common.to')}
                        </Text>
                        <DateTimePicker
                          value={dateTo || new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(_, date) => {
                            if (date) setDateTo(date);
                          }}
                          style={{ height: 140 }}
                        />
                      </View>
                    </View>
                  )}
                </ScrollView>

                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing[3],
                    paddingHorizontal: spacing[6],
                    paddingTop: spacing[3],
                    paddingBottom: Math.max(insets.bottom, spacing[4]),
                    borderTopWidth: 1,
                    borderTopColor: colors.surface[200],
                  }}
                >
                  <Pressable
                    onPress={() => {
                      clearFilters();
                      setIsFilterSheetOpen(false);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius.xl,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: colors.surface[200],
                    }}
                  >
                    <Text style={{ fontWeight: fontWeight.semibold, color: colors.gray[700] }}>
                      {t('common.clearAll')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsFilterSheetOpen(false)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing[3],
                      borderRadius: borderRadius.xl,
                      alignItems: 'center',
                      backgroundColor: m3.colorScheme.primary,
                    }}
                  >
                    <Text
                      style={{ fontWeight: fontWeight.semibold, color: m3.colorScheme.onPrimary }}
                    >
                      {t('common.done')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      <Modal
        visible={showDeleteConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.5),
            paddingHorizontal: spacing[8],
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: colorWithOpacity(colors.surface[100], 0.95),
              borderRadius: borderRadius['2xl'],
              padding: spacing[6],
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing[4] }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.12),
                }}
              >
                <UiSymbol
                  name="exclamationmark.triangle.fill"
                  size={28}
                  color={m3.colorScheme.error}
                />
              </View>
            </View>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
                textAlign: 'center',
                marginBottom: spacing[2],
              }}
            >
              {t('logs.delete.title')}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.surface[500],
                textAlign: 'center',
                marginBottom: spacing[6],
              }}
            >
              {t('logs.delete.body', {
                type: deletingLog ? t(`logs.types.${deletingLog.type}`) : '',
                date: deletingLog
                  ? formatDate(new Date(deletingLog.date), { month: 'short', day: 'numeric' })
                  : '',
              })}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
              <Pressable
                onPress={() => setShowDeleteConfirmation(false)}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.gray[700] }}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteLog}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: m3.colorScheme.error,
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: m3.colorScheme.onError }}>
                  {t('common.delete')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
