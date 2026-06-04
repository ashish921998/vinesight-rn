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
  StyleSheet,
} from 'react-native';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol as UiSymbol } from '@/components/ui/symbol';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { formatCurrency, formatDate } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
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
  useDailyNotesByFarms,
  useDeleteDailyNote,
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
  DailyNoteRecord,
} from '@/types';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { getExpenseIconName } from '@/utils/expense-icons';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { getDaysAfterPruning } from '@/utils/date';

interface CombinedLog {
  id: string;
  type: LogTypeId;
  date: string;
  description: string;
  data:
    | IrrigationRecord
    | SprayRecord
    | HarvestRecord
    | ExpenseRecord
    | FertigationRecord
    | DailyNoteRecord;
  searchableText?: string;
  daysAfterPruning?: number | null;
}

export default function LogsScreen() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();

  const router = useRouter();
  const { setEditActivity } = useModalStore();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();
  const allLogTypeIds = useMemo(() => LOG_TYPES.map((logType) => logType.id as LogTypeId), []);
  // Cellar Ledger: No shadows on cards, use borders instead
  const filterCardStyle = Platform.select({
    ios: {},
    android: {},
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
    dailyNotes = [],
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
  const allRecordsDailyNotes = useDailyNotesByFarms(selectedFarmId === undefined ? allFarmIds : []);

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
  const displayDailyNotes = useMemo(
    () => (selectedFarmId === undefined ? (allRecordsDailyNotes.data ?? []) : dailyNotes),
    [selectedFarmId, allRecordsDailyNotes.data, dailyNotes],
  );

  const isLoadingAllRecords =
    selectedFarmId === undefined
      ? allRecordsIrrigation.isLoading ||
        allRecordsSpray.isLoading ||
        allRecordsHarvest.isLoading ||
        allRecordsExpense.isLoading ||
        allRecordsFertigation.isLoading ||
        allRecordsDailyNotes.isLoading
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
  const deleteDailyNote = useDeleteDailyNote();

  const getFertigationDescription = useCallback(
    (record: FertigationRecord) => {
      if (record.fertilizers && record.fertilizers.length > 0) {
        return record.fertilizers.map((f) => f.name).join(', ');
      }
      return t('logs.fertigationApplied', {
        count: 0,
        countFormatted: '0',
      });
    },
    [t],
  );

  const farmPruningDateByFarmId = useMemo<Record<number, string | null>>(
    () =>
      farms.reduce<Record<number, string | null>>((acc, farm) => {
        if (farm.id == null) return acc;
        acc[farm.id] = farm.date_of_pruning ?? null;
        return acc;
      }, {}),
    [farms],
  );

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
        daysAfterPruning: getDaysAfterPruning(
          r.date,
          r.date_of_pruning ?? farmPruningDateByFarmId[r.farm_id],
        ),
        data: r,
      });
    });

    displaySprayRecords.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        description: r.chemical || t('logs.sprayApplication'),
        daysAfterPruning: getDaysAfterPruning(
          r.date,
          r.date_of_pruning ?? farmPruningDateByFarmId[r.farm_id],
        ),
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
        daysAfterPruning: getDaysAfterPruning(
          r.date,
          r.date_of_pruning ?? farmPruningDateByFarmId[r.farm_id],
        ),
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
        daysAfterPruning: getDaysAfterPruning(
          r.date,
          r.date_of_pruning ?? farmPruningDateByFarmId[r.farm_id],
        ),
        data: r,
      }),
    );

    displayFertigationRecords.forEach((r) => {
      const description = getFertigationDescription(r);
      const searchableText = r.fertilizers
        ? r.fertilizers.map((f) => f.name.toLowerCase()).join(' ')
        : '';
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        description,
        searchableText,
        daysAfterPruning: getDaysAfterPruning(
          r.date,
          r.date_of_pruning ?? farmPruningDateByFarmId[r.farm_id],
        ),
        data: r,
      });
    });

    displayDailyNotes.forEach((r) =>
      logs.push({
        id: `note-${r.id}`,
        type: 'note',
        date: r.date,
        description: r.notes || t('logs.types.note'),
        searchableText: r.notes?.toLowerCase() ?? '',
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
    displayDailyNotes,
    t,
    currency,
    getFertigationDescription,
    farmPruningDateByFarmId,
  ]);

  const filteredLogs = useMemo(() => {
    let logs = [...combinedLogs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      logs = logs.filter((log) => {
        const descriptionMatch = log.description.toLowerCase().includes(query);
        const additionalMatch = log.searchableText ? log.searchableText.includes(query) : false;
        return descriptionMatch || additionalMatch;
      });
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
        | FertigationRecord
        | DailyNoteRecord;
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
        case 'note': {
          const r = record as DailyNoteRecord;
          if (r.id) {
            await deleteDailyNote.mutateAsync({ id: r.id, farmId: farmIdNum, date: r.date });
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
    deleteDailyNote,
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
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: m3.colorScheme.background,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text style={{ marginTop: spacing[4], color: m3.surface.s500 }}>
            {t('common.loading')}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <LinearGradient
          pointerEvents="none"
          colors={[colorWithOpacity(m3.colorScheme.primary, 0.08), 'transparent']}
          style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
        />
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
                      StyleSheet.absoluteFillObject,
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
                {t('logs.screenTitle')}
              </Text>
            </View>

            <View style={{ width: 44, height: 44 }} />
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Farm Selector */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
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
                          color: m3.surface.s900,
                        }}
                      >
                        {selectedFarmId === undefined
                          ? t('logs.farmPicker.allFarms')
                          : selectedFarm?.name || t('logs.farmPicker.selectFarm')}
                      </Text>
                      {selectedFarm && (
                        <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                          {selectedFarm.crop} • {selectedFarm.area.toFixed(1)} {t('units.acres')}
                        </Text>
                      )}
                      {selectedFarmId === undefined && (
                        <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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

            {/* Filter Chips - Horizontal scroll */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[4] }}
              >
                <Pressable
                  onPress={() => {
                    if (selectedLogTypes.size === 0) {
                      setSelectedLogTypes(new Set(allLogTypeIds));
                    } else {
                      setSelectedLogTypes(new Set());
                    }
                    setCurrentPage(1);
                  }}
                  style={{
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                    borderRadius: borderRadius.full,
                    backgroundColor:
                      selectedLogTypes.size === 0
                        ? m3.colorScheme.primary
                        : m3.surface.surfaceContainerLow,
                    borderWidth: 1,
                    borderColor:
                      selectedLogTypes.size === 0
                        ? m3.colorScheme.primary
                        : m3.colorScheme.outlineVariant,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color:
                        selectedLogTypes.size === 0
                          ? m3.colorScheme.onPrimary
                          : m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    {t('common.all')}
                  </Text>
                </Pressable>

                {LOG_TYPES.map((logType) => {
                  const isSelected = selectedLogTypes.has(logType.id as LogTypeId);
                  const categoryColorMap: Record<string, string> = {
                    irrigation: domain.category.irrigation || '#3F6E78',
                    spray: domain.category.spray || '#6C7C46',
                    harvest: domain.category.harvest || '#A9752F',
                    expense: domain.category.expense || '#598066',
                    fertigation: domain.category.fertigation || '#56704E',
                  };
                  const chipColor = categoryColorMap[logType.id] || m3.colorScheme.primary;
                  return (
                    <Pressable
                      key={logType.id}
                      onPress={() => {
                        const newSet = new Set(selectedLogTypes);
                        if (isSelected) {
                          newSet.delete(logType.id as LogTypeId);
                        } else {
                          newSet.add(logType.id as LogTypeId);
                        }
                        setSelectedLogTypes(newSet);
                        setCurrentPage(1);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[2],
                        borderRadius: borderRadius.full,
                        backgroundColor: isSelected
                          ? m3.colorScheme.primary
                          : m3.surface.surfaceContainerLow,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? m3.colorScheme.primary
                          : m3.colorScheme.outlineVariant,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: radius.xs,
                          backgroundColor: chipColor,
                          marginRight: spacing[1],
                        }}
                      />
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: isSelected
                            ? m3.colorScheme.onPrimary
                            : m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {t(logType.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Search + inline Filter */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[3] }}>
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
                  ...(filterCardStyle ?? {}),
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
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    style={{ marginRight: spacing[2] }}
                    hitSlop={8}
                  >
                    <UiSymbol
                      name="xmark.circle.fill"
                      size={18}
                      color={m3.colorScheme.onSurfaceVariant}
                    />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setIsFilterSheetOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.filter')}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: spacing[2],
                    marginLeft: spacing[1],
                    borderLeftWidth: 1,
                    borderLeftColor: m3.colorScheme.outlineVariant,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <UiSymbol
                    name="line.3.horizontal.decrease"
                    size={18}
                    color={
                      hasActiveFilters ? m3.colorScheme.primary : m3.colorScheme.onSurfaceVariant
                    }
                  />
                  {hasActiveFilters && (
                    <View
                      style={{
                        marginLeft: spacing[1],
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 5,
                        borderRadius: radius.sm,
                        backgroundColor: m3.colorScheme.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize['2xs'],
                          fontWeight: fontWeight.bold,
                          color: m3.colorScheme.onPrimary,
                        }}
                      >
                        {selectedLogTypes.size + (dateFrom || dateTo ? 1 : 0)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {(dateFrom || dateTo || hasActiveFilters) && (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: spacing[2],
                    marginTop: spacing[3],
                  }}
                >
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
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          color: m3.colorScheme.error,
                        }}
                      >
                        {t('common.clearAll')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
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
                        backgroundColor: colorWithOpacity(m3.surface.s100, 0.7),
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
                    backgroundColor: colorWithOpacity(m3.surface.s100, 0.7),
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
                      color: m3.surface.s900,
                    }}
                  >
                    {t('logs.empty.title')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      color: m3.surface.s500,
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
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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
                        backgroundColor: pressed ? m3.surface.s200 : m3.surface.s50,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: borderRadius.lg,
                      })}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.surface.s500,
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

                  {/* Group logs by date */}
                  {(() => {
                    // Group logs by date string (YYYY-MM-DD)
                    const groupedLogs: Record<string, typeof paginatedLogs> = {};
                    paginatedLogs.forEach((log) => {
                      const dateKey = log.date.split('T')[0];
                      if (!groupedLogs[dateKey]) {
                        groupedLogs[dateKey] = [];
                      }
                      groupedLogs[dateKey].push(log);
                    });

                    // Sort dates descending
                    const sortedDates = Object.keys(groupedLogs).sort(
                      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
                    );

                    return (
                      <View style={{ gap: spacing[4] }}>
                        {sortedDates.map((dateKey) => {
                          // Parse YYYY-MM-DD in local time to avoid UTC shift
                          const [year, month, day] = dateKey.split('-').map(Number);
                          const dateObj = new Date(year, month - 1, day);
                          const formattedDate = formatDate(dateObj, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }).toUpperCase();

                          return (
                            <View key={dateKey}>
                              {/* Date Group Header */}
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  fontWeight: fontWeight.semibold,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.8,
                                  color: m3.surface.s400,
                                  marginBottom: spacing[2],
                                  paddingLeft: spacing[1],
                                }}
                              >
                                {formattedDate}
                              </Text>

                              {/* Logs for this date */}
                              <View style={{ gap: spacing[3] }}>
                                {groupedLogs[dateKey].map((log) => {
                                  const logType = LOG_TYPES.find((lt) => lt.id === log.type);
                                  // Category colors for left strip - using Cellar Ledger palette
                                  const categoryColorMap: Record<string, string> = {
                                    irrigation: domain.category.irrigation || '#3F6E78',
                                    spray: domain.category.spray || '#6C7C46',
                                    harvest: domain.category.harvest || '#A9752F',
                                    expense: domain.category.expense || '#598066',
                                    fertigation: domain.category.fertigation || '#56704E',
                                  };
                                  const categoryColor =
                                    categoryColorMap[log.type] || m3.colorScheme.primary;
                                  const iconName =
                                    log.type === 'expense'
                                      ? getExpenseIconName(
                                          (log.data as ExpenseRecord | undefined)?.type,
                                          resolveSymbolIconName(logType?.icon),
                                        )
                                      : resolveSymbolIconName(logType?.icon);
                                  const parsedDate = new Date(log.date);
                                  return (
                                    <View
                                      key={log.id}
                                      style={{
                                        backgroundColor: m3.surface.surfaceContainerLow,
                                        borderRadius: borderRadius.sm,
                                        overflow: 'hidden',
                                        flexDirection: 'row',
                                        borderWidth: 1,
                                        borderColor: m3.colorScheme.outlineVariant,
                                      }}
                                    >
                                      {/* 3px category-colored left strip */}
                                      <View
                                        style={{
                                          width: 3,
                                          backgroundColor: categoryColor,
                                        }}
                                      />
                                      <View
                                        style={{
                                          flex: 1,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          padding: spacing[4],
                                        }}
                                      >
                                        <View
                                          style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: borderRadius.xs,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: colorWithOpacity(categoryColor, 0.1),
                                          }}
                                        >
                                          <UiSymbol
                                            name={iconName}
                                            size={18}
                                            color={categoryColor}
                                          />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: spacing[3] }}>
                                          <Text
                                            style={{
                                              fontSize: fontSize.base,
                                              fontWeight: fontWeight.semibold,
                                              color: m3.surface.s900,
                                            }}
                                            numberOfLines={1}
                                          >
                                            {log.description}
                                          </Text>
                                          <View
                                            style={{
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              marginTop: spacing[1],
                                              gap: spacing[1],
                                            }}
                                          >
                                            <Text
                                              style={{
                                                fontSize: fontSize.xs,
                                                color: m3.surface.s500,
                                              }}
                                            >
                                              {formatDate(parsedDate, {
                                                month: 'short',
                                                day: 'numeric',
                                              })}
                                            </Text>
                                            {log.daysAfterPruning != null && (
                                              <>
                                                <View
                                                  style={{
                                                    width: 3,
                                                    height: 3,
                                                    borderRadius: radius.none,
                                                    backgroundColor: m3.surface.s400,
                                                  }}
                                                />
                                                <Text
                                                  style={{
                                                    fontSize: fontSize.xs,
                                                    fontWeight: fontWeight.medium,
                                                    color: m3.surface.s500,
                                                  }}
                                                >
                                                  {t('farmDetails.pruning.daysShort', {
                                                    count: log.daysAfterPruning,
                                                  })}
                                                </Text>
                                              </>
                                            )}
                                          </View>
                                        </View>
                                        <Pressable
                                          onPress={() => {
                                            const logFarm =
                                              selectedFarm ||
                                              farms.find(
                                                (f) =>
                                                  f.id ===
                                                  (log.data as { farm_id?: number }).farm_id,
                                              );
                                            const canEdit = Boolean(logFarm);
                                            const buttons: {
                                              text: string;
                                              style?: 'default' | 'destructive' | 'cancel';
                                              onPress?: () => void;
                                            }[] = [];
                                            if (canEdit) {
                                              buttons.push({
                                                text: t('common.edit'),
                                                onPress: () => {
                                                  if (log.type === 'note') {
                                                    router.push({
                                                      pathname: '/add-note',
                                                      params: {
                                                        farmId: String(
                                                          (log.data as DailyNoteRecord).farm_id,
                                                        ),
                                                        date: (log.data as DailyNoteRecord).date,
                                                      },
                                                    });
                                                    return;
                                                  }
                                                  const record = log.data as Exclude<
                                                    typeof log.data,
                                                    DailyNoteRecord
                                                  >;
                                                  setEditActivity({
                                                    farm: logFarm!,
                                                    logType: log.type,
                                                    record,
                                                  });
                                                  router.push(`/log-entry/edit/${log.id}`);
                                                },
                                              });
                                            }
                                            buttons.push({
                                              text: t('common.delete'),
                                              style: 'destructive',
                                              onPress: () => {
                                                setDeletingLog(log);
                                                setShowDeleteConfirmation(true);
                                              },
                                            });
                                            buttons.push({
                                              text: t('common.cancel'),
                                              style: 'cancel',
                                            });
                                            Alert.alert(log.description, undefined, buttons, {
                                              cancelable: true,
                                            });
                                          }}
                                          accessibilityRole="button"
                                          accessibilityLabel={t('common.moreOptions') as string}
                                          hitSlop={8}
                                          style={({ pressed }) => ({
                                            width: 36,
                                            height: 36,
                                            borderRadius: borderRadius.full,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: pressed
                                              ? colorWithOpacity(
                                                  m3.colorScheme.onSurface,
                                                  m3.stateLayerOpacity.pressed,
                                                )
                                              : 'transparent',
                                          })}
                                        >
                                          <UiSymbol
                                            name="ellipsis"
                                            size={20}
                                            color={m3.colorScheme.onSurfaceVariant}
                                          />
                                        </Pressable>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

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
                            currentPage === 1 ? m3.surface.s50 : m3.colorScheme.primary,
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
                                  currentPage === pageNum ? m3.colorScheme.primary : m3.surface.s50,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  fontWeight: fontWeight.semibold,
                                  color:
                                    currentPage === pageNum
                                      ? m3.colorScheme.onPrimary
                                      : m3.neutral.n700,
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
                            currentPage === totalPages ? m3.surface.s50 : m3.colorScheme.primary,
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
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
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
                backgroundColor: m3.surface.s100,
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
                  backgroundColor: m3.surface.s200,
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
                  color: m3.surface.s900,
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
                      selectedFarmId === undefined ? m3.colorScheme.primary : m3.surface.s50,
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
                          selectedFarmId === undefined ? m3.colorScheme.onPrimary : m3.surface.s900,
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
                            : m3.surface.s500,
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
                        selectedFarmId === farm.id ? m3.colorScheme.primary : m3.surface.s50,
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
                            selectedFarmId === farm.id ? m3.colorScheme.onPrimary : m3.surface.s900,
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
                              : m3.surface.s500,
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
                  backgroundColor: m3.surface.s50,
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: m3.neutral.n700 }}>
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
                backgroundColor: m3.surface.s100,
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
                    color: m3.surface.s900,
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
                    backgroundColor: pressed ? m3.surface.s100 : 'transparent',
                    marginBottom: spacing[2],
                  })}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: m3.surface.s900,
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
          statusBarTranslucent
        >
          <View
            style={{
              flex: 1,
              paddingTop: insets.top,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.3),
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: m3.surface.s100,
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                overflow: 'hidden',
                height: '78%',
              }}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    width: 48,
                    height: 4,
                    backgroundColor: m3.surface.s200,
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
                      color: m3.surface.s500,
                      marginBottom: spacing[2],
                    }}
                  >
                    {t('logs.filters.activityTypes')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                    {LOG_TYPES.map((logType) => {
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
                              color: isSelected ? m3.colorScheme.onPrimary : m3.neutral.n700,
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
                      color: m3.surface.s500,
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
                          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                            {t('common.from')}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: m3.surface.s900,
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
                          <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
                            {t('common.to')}
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: m3.surface.s900,
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
                        <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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
                        <Text style={{ fontSize: fontSize.xs, color: m3.surface.s500 }}>
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
                    borderTopColor: m3.surface.s200,
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
                      borderColor: m3.surface.s200,
                    }}
                  >
                    <Text style={{ fontWeight: fontWeight.semibold, color: m3.neutral.n700 }}>
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
          </View>
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
              backgroundColor: colorWithOpacity(m3.surface.s100, 0.95),
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
                color: m3.surface.s900,
                textAlign: 'center',
                marginBottom: spacing[2],
              }}
            >
              {t('logs.delete.title')}
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: m3.surface.s500,
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
                  borderColor: m3.surface.s200,
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: m3.neutral.n700 }}>
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
