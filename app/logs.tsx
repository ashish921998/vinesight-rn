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
} from 'react-native';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Symbol } from '@/components/ui/symbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '@/hooks';
import { LOG_TYPES, type LogTypeId } from '@/constants/calculator-models';
import { useModalStore } from '@/stores';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface CombinedLog {
  id: string;
  type: LogTypeId;
  date: string;
  description: string;
  data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
}

export default function LogsScreen() {
  const router = useRouter();
  const { setAddEntry, setEditActivity } = useModalStore();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();

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
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deletingLog, setDeletingLog] = useState<CombinedLog | undefined>();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);
  const [showFarmSelector, setShowFarmSelector] = useState(false);

  const deleteIrrigation = useDeleteIrrigationRecord();
  const deleteSpray = useDeleteSprayRecord();
  const deleteHarvest = useDeleteHarvestRecord();
  const deleteExpense = useDeleteExpenseRecord();
  const deleteFertigation = useDeleteFertigationRecord();

  const combinedLogs = useMemo<CombinedLog[]>(() => {
    const logs: CombinedLog[] = [];

    displayIrrigationRecords.forEach((r) =>
      logs.push({
        id: `irrigation-${r.id}`,
        type: 'irrigation',
        date: r.date,
        description: `${r.duration?.toFixed(1) || 0}h duration`,
        data: r,
      }),
    );

    displaySprayRecords.forEach((r) =>
      logs.push({
        id: `spray-${r.id}`,
        type: 'spray',
        date: r.date,
        description: r.chemical || 'Spray application',
        data: r,
      }),
    );

    displayHarvestRecords.forEach((r) =>
      logs.push({
        id: `harvest-${r.id}`,
        type: 'harvest',
        date: r.date,
        description: `${r.quantity?.toFixed(1) || 0}kg - ${r.grade || 'N/A'}`,
        data: r,
      }),
    );

    displayExpenseRecords.forEach((r) =>
      logs.push({
        id: `expense-${r.id}`,
        type: 'expense',
        date: r.date,
        description: `₹${r.cost?.toLocaleString() || 0} - ${r.type || 'General'}`,
        data: r,
      }),
    );

    displayFertigationRecords.forEach((r) =>
      logs.push({
        id: `fertigation-${r.id}`,
        type: 'fertigation',
        date: r.date,
        description: `${r.fertilizers?.length || 0} fertilizer${(r.fertilizers?.length || 0) !== 1 ? 's' : ''} applied`,
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
        Alert.alert('Error', 'Cannot delete log: farm ID not found');
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
      Alert.alert('Error', 'Failed to delete log. Please try again.');
    }
  }, [
    deletingLog,
    selectedFarmId,
    deleteIrrigation,
    deleteSpray,
    deleteHarvest,
    deleteExpense,
    deleteFertigation,
  ]);

  const clearFilters = useCallback(() => {
    setSelectedLogTypes(new Set());
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = selectedLogTypes.size > 0 || dateFrom || dateTo;

  if (farmsLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#f2f2f7',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ marginTop: spacing[4], color: colors.surface[500] }}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Farm Logs',
          headerStyle: { backgroundColor: '#f2f2f7' },
          headerTintColor: '#000000',
          headerRight: () =>
            selectedFarmId !== undefined && (
              <Pressable
                onPress={() => {
                  setAddEntry({
                    tabs: ['log'],
                    initialTab: 'log',
                    initialFarmId: selectedFarmId,
                  });
                  router.push({
                    pathname: '/add-entry',
                    params: {
                      farmId: selectedFarmId.toString(),
                      tabs: 'log',
                      initialTab: 'log',
                    },
                  });
                }}
                style={{ marginRight: spacing[4] }}
              >
                <Symbol name="plus.circle.fill" size={28} color="#408059" />
              </Pressable>
            ),
        }}
      />

      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
        <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
          <LinearGradient
            colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
                SELECTED FARM
              </Text>
              <Pressable
                onPress={() => setShowFarmSelector(true)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: borderRadius['2xl'],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
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
                        backgroundColor: 'rgba(64, 128, 89, 0.15)',
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Symbol
                        name={
                          selectedFarmId === undefined ? 'square.stack.3d.up.fill' : 'leaf.fill'
                        }
                        size={22}
                        color="#408059"
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
                          ? 'All Farms'
                          : selectedFarm?.name || 'Select farm'}
                      </Text>
                      {selectedFarm && (
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {selectedFarm.crop} • {selectedFarm.area.toFixed(1)} acres
                        </Text>
                      )}
                      {selectedFarmId === undefined && (
                        <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                          {farms.length} farm{farms.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Symbol name="chevron.down" size={20} color="#8e8e93" />
                </View>
              </Pressable>
            </View>

            {/* Search & Filters */}
            <View style={{ marginHorizontal: spacing[4], marginTop: spacing[4] }}>
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 5px 10px rgba(0, 0, 0, 0.08)',
                  borderRadius: borderRadius['2xl'],
                  padding: spacing[4],
                }}
              >
                {/* Search Bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.xl,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                  }}
                >
                  <Symbol name="magnifyingglass" size={18} color="#8e8e93" />
                  <TextInput
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#8e8e93"
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: colors.surface[900],
                    }}
                  />
                  {searchQuery !== '' && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <Symbol name="xmark.circle.fill" size={18} color="#8e8e93" />
                    </Pressable>
                  )}
                </View>

                {/* Filter Toggle */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: spacing[3],
                  }}
                >
                  <Pressable
                    onPress={() => setShowFilters(!showFilters)}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: colors.primary[600],
                      }}
                    >
                      Filter
                    </Text>
                    {hasActiveFilters && (
                      <View
                        style={{
                          marginLeft: spacing[2],
                          backgroundColor: 'rgba(64, 128, 89, 0.15)',
                          paddingHorizontal: spacing[2],
                          paddingVertical: 2,
                          borderRadius: borderRadius.full,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.bold,
                            color: colors.primary[600],
                          }}
                        >
                          {selectedLogTypes.size + (dateFrom || dateTo ? 1 : 0)}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {hasActiveFilters && (
                    <Pressable onPress={clearFilters}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                          color: '#EF4444',
                        }}
                      >
                        Clear All
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Filter Panel */}
                {showFilters && (
                  <View
                    style={{
                      marginTop: spacing[4],
                      paddingTop: spacing[4],
                      borderTopWidth: 1,
                      borderTopColor: colors.surface[200],
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.bold,
                        color: colors.surface[500],
                        marginBottom: spacing[2],
                      }}
                    >
                      ACTIVITY TYPES
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
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: spacing[3],
                              paddingVertical: 6,
                              borderRadius: borderRadius.full,
                              backgroundColor: isSelected
                                ? colors.primary[600]
                                : colors.surface[50],
                            }}
                          >
                            <Symbol
                              name={
                                logType.icon === 'water'
                                  ? 'drop.fill'
                                  : logType.icon === 'flask'
                                    ? 'flask.fill'
                                    : logType.icon === 'basket'
                                      ? 'basket.fill'
                                      : logType.icon === 'cash'
                                        ? 'dollarsign.circle.fill'
                                        : logType.icon === 'leaf'
                                          ? 'leaf.fill'
                                          : logType.icon === 'document-text'
                                            ? 'doc.text.fill'
                                            : 'doc.fill'
                              }
                              size={14}
                              color={isSelected ? '#FFFFFF' : logType.color}
                            />
                            <Text
                              style={{
                                marginLeft: spacing[1],
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.semibold,
                                color: isSelected ? colors.white : colors.gray[700],
                              }}
                            >
                              {logType.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: spacing[4],
                      }}
                    >
                      <Pressable
                        onPress={() => setShowDatePickerFrom(true)}
                        style={{ flex: 1, marginRight: spacing[2] }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.surface[50],
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                            borderRadius: borderRadius.xl,
                          }}
                        >
                          <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                            From
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.surface[900],
                            }}
                          >
                            {dateFrom
                              ? dateFrom.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Select date'}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() => setShowDatePickerTo(true)}
                        style={{ flex: 1, marginLeft: spacing[2] }}
                      >
                        <View
                          style={{
                            backgroundColor: colors.surface[50],
                            paddingHorizontal: spacing[3],
                            paddingVertical: spacing[2],
                            borderRadius: borderRadius.xl,
                          }}
                        >
                          <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                            To
                          </Text>
                          <Text
                            style={{
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: colors.surface[900],
                            }}
                          >
                            {dateTo
                              ? dateTo.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Select date'}
                          </Text>
                        </View>
                      </Pressable>
                    </View>
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
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
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
                      backgroundColor: 'rgba(142, 142, 147, 0.2)',
                    }}
                  >
                    <Symbol name="calendar" size={32} color="#9CA3AF" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                    }}
                  >
                    No activity logs found
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
                      ? 'Try adjusting your filters'
                      : 'Start logging activities to see them here'}
                  </Text>
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
                      Showing {(currentPage - 1) * itemsPerPage + 1}-
                      {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of{' '}
                      {filteredLogs.length}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setCurrentPage(1);
                        setShowFilters(true);
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.surface[50],
                          paddingHorizontal: spacing[2],
                          paddingVertical: spacing[1],
                          borderRadius: borderRadius.lg,
                        }}
                      >
                        <Symbol name="ellipsis" size={14} color="#8e8e93" />
                        <Text
                          style={{
                            marginLeft: spacing[1],
                            fontSize: fontSize.xs,
                            color: colors.surface[500],
                          }}
                        >
                          10 per page
                        </Text>
                      </View>
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
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
                                backgroundColor: `${logType?.color || '#408059'}1A`,
                              }}
                            >
                              <Symbol
                                name={
                                  logType?.icon === 'water'
                                    ? 'drop.fill'
                                    : logType?.icon === 'flask'
                                      ? 'flask.fill'
                                      : logType?.icon === 'basket'
                                        ? 'basket.fill'
                                        : logType?.icon === 'cash'
                                          ? 'dollarsign.circle.fill'
                                          : logType?.icon === 'leaf'
                                            ? 'leaf.fill'
                                            : logType?.icon === 'document-text'
                                              ? 'doc.text.fill'
                                              : 'doc.fill'
                                }
                                size={20}
                                color={logType?.color || '#408059'}
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
                                {logType?.label}
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
                                  color: colors.surface[300],
                                  marginTop: spacing[1],
                                }}
                              >
                                {parsedDate.toLocaleDateString('en-US', {
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
                                    Alert.alert('Error', 'Farm not found for this log');
                                    return;
                                  }
                                  setEditActivity({
                                    farm: logFarm,
                                    logType: log.type,
                                    record: log.data,
                                  });
                                  router.push(`/edit-activity/${log.id}`);
                                }}
                                disabled={
                                  !(selectedFarm || (log.data as { farm_id?: number }).farm_id)
                                }
                              >
                                <Symbol
                                  name="pencil"
                                  size={20}
                                  color={
                                    selectedFarm || (log.data as { farm_id?: number }).farm_id
                                      ? '#408059'
                                      : '#c7c7cc'
                                  }
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  setDeletingLog(log);
                                  setShowDeleteConfirmation(true);
                                }}
                              >
                                <Symbol name="trash" size={20} color="#EF4444" />
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
                          backgroundColor: currentPage === 1 ? '#f9f9f9' : '#408059',
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      >
                        <Symbol
                          name="chevron.left"
                          size={18}
                          color={currentPage === 1 ? '#8e8e93' : '#FFFFFF'}
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
                                backgroundColor: currentPage === pageNum ? '#408059' : '#f9f9f9',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: fontSize.xs,
                                  fontWeight: fontWeight.semibold,
                                  color: currentPage === pageNum ? colors.white : colors.gray[700],
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
                          backgroundColor: currentPage === totalPages ? '#f9f9f9' : '#408059',
                          opacity: currentPage === totalPages ? 0.5 : 1,
                        }}
                      >
                        <Symbol
                          name="chevron.right"
                          size={18}
                          color={currentPage === totalPages ? '#8e8e93' : '#FFFFFF'}
                        />
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Modals are now route-based */}

      {showDatePickerFrom && (
        <Modal
          transparent
          visible={showDatePickerFrom}
          onRequestClose={() => setShowDatePickerFrom(false)}
          animationType="fade"
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '85%',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginBottom: spacing[4],
                  textAlign: 'center',
                }}
              >
                Select From Date
              </Text>
              <DateTimePicker
                value={dateFrom || new Date()}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  setShowDatePickerFrom(false);
                  if (date) setDateFrom(date);
                }}
                style={{ width: '100%' }}
              />
              <Pressable
                onPress={() => setShowDatePickerFrom(false)}
                style={{
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: '#408059',
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {showFarmSelector && (
        <Modal
          transparent
          visible={showFarmSelector}
          onRequestClose={() => setShowFarmSelector(false)}
          animationType="slide"
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View
              style={{
                flex: 1,
                marginTop: 'auto',
                backgroundColor: colors.white,
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                overflow: 'hidden',
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
                Select Farm
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
                    backgroundColor: selectedFarmId === undefined ? '#408059' : '#f9f9f9',
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
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(64,128,89,0.15)',
                    }}
                  >
                    <Symbol
                      name="square.stack.3d.up.fill"
                      size={20}
                      color={selectedFarmId === undefined ? '#FFFFFF' : '#408059'}
                    />
                  </View>
                  <View style={{ marginLeft: spacing[3], flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.semibold,
                        color: selectedFarmId === undefined ? colors.white : colors.surface[900],
                      }}
                    >
                      All Farms
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        color:
                          selectedFarmId === undefined
                            ? 'rgba(255,255,255,0.8)'
                            : colors.surface[500],
                      }}
                    >
                      {farms.length} farm{farms.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {selectedFarmId === undefined && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
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
                      backgroundColor: selectedFarmId === farm.id ? '#408059' : '#f9f9f9',
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
                            ? 'rgba(255,255,255,0.2)'
                            : 'rgba(64,128,89,0.15)',
                      }}
                    >
                      <Symbol
                        name="leaf.fill"
                        size={20}
                        color={selectedFarmId === farm.id ? '#FFFFFF' : '#408059'}
                      />
                    </View>
                    <View style={{ marginLeft: spacing[3], flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          color: selectedFarmId === farm.id ? colors.white : colors.surface[900],
                        }}
                      >
                        {farm.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color:
                            selectedFarmId === farm.id
                              ? 'rgba(255,255,255,0.8)'
                              : colors.surface[500],
                        }}
                      >
                        {farm.crop} • {farm.area.toFixed(1)} acres
                      </Text>
                    </View>
                    {selectedFarmId === farm.id && (
                      <Symbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
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
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {showDatePickerTo && (
        <Modal
          transparent
          visible={showDatePickerTo}
          onRequestClose={() => setShowDatePickerTo(false)}
          animationType="fade"
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                width: '85%',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginBottom: spacing[4],
                  textAlign: 'center',
                }}
              >
                Select To Date
              </Text>
              <DateTimePicker
                value={dateTo || new Date()}
                mode="date"
                display="spinner"
                onChange={(_, date) => {
                  setShowDatePickerTo(false);
                  if (date) setDateTo(date);
                }}
                style={{ width: '100%' }}
              />
              <Pressable
                onPress={() => setShowDatePickerTo(false)}
                style={{
                  marginTop: spacing[4],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: '#408059',
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>Done</Text>
              </Pressable>
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
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: spacing[8],
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                }}
              >
                <Symbol name="exclamationmark.triangle.fill" size={28} color="#EF4444" />
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
              Delete Log?
            </Text>
            <Text
              style={{
                fontSize: fontSize.sm,
                color: colors.surface[500],
                textAlign: 'center',
                marginBottom: spacing[6],
              }}
            >
              Are you sure you want to delete this {deletingLog?.type} log from{' '}
              {deletingLog
                ? new Date(deletingLog.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : ''}
              ?
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
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteLog}
                style={{
                  flex: 1,
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  alignItems: 'center',
                  backgroundColor: '#EF4444',
                }}
              >
                <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
