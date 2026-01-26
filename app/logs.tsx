import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Symbol } from '@/components/ui/Symbol';
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
import { LOG_TYPES, type LogTypeId } from '@/constants/calculatorModels';
import { AddEntryModal, EditActivityModal } from '@/components/screens';
import type {
  IrrigationRecord,
  SprayRecord,
  HarvestRecord,
  ExpenseRecord,
  FertigationRecord,
} from '@/types';

interface CombinedLog {
  id: string;
  type: LogTypeId;
  date: string;
  description: string;
  data: IrrigationRecord | SprayRecord | HarvestRecord | ExpenseRecord | FertigationRecord;
}

export default function LogsScreen() {
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
    refetch: refetchRecords,
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLog, setEditingLog] = useState<CombinedLog | undefined>();
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#f2f2f7',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        edges={['top']}
      >
        <ActivityIndicator size="large" color="#408059" />
        <Text className="mt-4 text-[#8e8e93]">Loading...</Text>
      </SafeAreaView>
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
            selectedFarm && (
              <TouchableOpacity onPress={() => setShowAddModal(true)} className="mr-4">
                <Symbol name="plus.circle.fill" size={28} color="#408059" />
              </TouchableOpacity>
            ),
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }} edges={['top']}>
        <View className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
          <LinearGradient
            colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
            style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
          />

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Farm Selector */}
            <View className="mx-4 mt-4">
              <Text className="text-xs font-bold text-[#8e8e93] mb-2">SELECTED FARM</Text>
              <TouchableOpacity
                onPress={() => setShowFarmSelector(true)}
                className="rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: 12,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-11 h-11 bg-[#408059]/15 rounded-full items-center justify-center">
                      <Symbol
                        name={
                          selectedFarmId === undefined ? 'square.stack.3d.up.fill' : 'leaf.fill'
                        }
                        size={22}
                        color="#408059"
                      />
                    </View>
                    <View className="ml-3">
                      <Text className="text-base font-semibold text-[#1c1c1e]">
                        {selectedFarmId === undefined
                          ? 'All Farms'
                          : selectedFarm?.name || 'Select farm'}
                      </Text>
                      {selectedFarm && (
                        <Text className="text-xs text-[#8e8e93]">
                          {selectedFarm.crop} • {selectedFarm.area.toFixed(1)} acres
                        </Text>
                      )}
                      {selectedFarmId === undefined && (
                        <Text className="text-xs text-[#8e8e93]">
                          {farms.length} farm{farms.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Symbol name="chevron.down" size={20} color="#8e8e93" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Search & Filters */}
            <View className="mx-4 mt-4">
              <View
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 5px 10px rgba(0, 0, 0, 0.08)',
                }}
              >
                {/* Search Bar */}
                <View className="flex-row items-center bg-[#f9f9f9] rounded-xl px-3 py-2.5">
                  <Symbol name="magnifyingglass" size={18} color="#8e8e93" />
                  <TextInput
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#8e8e93"
                    className="flex-1 ml-2 text-[#1c1c1e]"
                  />
                  {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Symbol name="xmark.circle.fill" size={18} color="#8e8e93" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Toggle */}
                <View className="flex-row items-center justify-between mt-3">
                  <TouchableOpacity
                    onPress={() => setShowFilters(!showFilters)}
                    className="flex-row items-center"
                  >
                    <Text className="text-sm font-semibold text-[#408059]">Filter</Text>
                    {hasActiveFilters && (
                      <View className="ml-2 bg-[#408059]/15 px-2 py-0.5 rounded-full">
                        <Text className="text-xs font-bold text-[#408059]">
                          {selectedLogTypes.size + (dateFrom || dateTo ? 1 : 0)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {hasActiveFilters && (
                    <TouchableOpacity onPress={clearFilters}>
                      <Text className="text-sm font-semibold text-red-500">Clear All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Panel */}
                {showFilters && (
                  <View className="mt-4 pt-4 border-t border-[#e5e5ea]">
                    <Text className="text-xs font-bold text-[#8e8e93] mb-2">ACTIVITY TYPES</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {LOG_TYPES.filter((lt) => lt.id !== 'note').map((logType) => {
                        const isSelected = selectedLogTypes.has(logType.id as LogTypeId);
                        return (
                          <TouchableOpacity
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
                            className={`flex-row items-center px-3 py-1.5 rounded-full ${
                              isSelected ? 'bg-[#408059]' : 'bg-[#f9f9f9]'
                            }`}
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
                              className={`ml-1 text-xs font-semibold ${
                                isSelected ? 'text-white' : 'text-[#374151]'
                              }`}
                            >
                              {logType.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View className="flex-row items-center justify-between mt-4">
                      <TouchableOpacity
                        onPress={() => setShowDatePickerFrom(true)}
                        className="flex-1 mr-2"
                      >
                        <View className="bg-[#f9f9f9] px-3 py-2.5 rounded-xl">
                          <Text className="text-xs text-[#8e8e93]">From</Text>
                          <Text className="text-sm font-semibold text-[#1c1c1e]">
                            {dateFrom
                              ? dateFrom.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Select date'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowDatePickerTo(true)}
                        className="flex-1 ml-2"
                      >
                        <View className="bg-[#f9f9f9] px-3 py-2.5 rounded-xl">
                          <Text className="text-xs text-[#8e8e93]">To</Text>
                          <Text className="text-sm font-semibold text-[#1c1c1e]">
                            {dateTo
                              ? dateTo.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Select date'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Logs List */}
            <View className="mx-4 mt-4 pb-32">
              {isLoadingAllRecords ? (
                <View className="gap-3">
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      className="h-20 rounded-2xl"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.6)' }}
                    />
                  ))}
                </View>
              ) : paginatedLogs.length === 0 ? (
                <View
                  className="rounded-2xl items-center p-10"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: 'rgba(142, 142, 147, 0.2)' }}
                  >
                    <Symbol name="calendar" size={32} color="#9CA3AF" />
                  </View>
                  <Text className="text-base font-semibold text-[#1c1c1e]">
                    No activity logs found
                  </Text>
                  <Text className="text-sm text-[#8e8e93] text-center mt-1">
                    {hasActiveFilters || searchQuery
                      ? 'Try adjusting your filters'
                      : 'Start logging activities to see them here'}
                  </Text>
                </View>
              ) : (
                <>
                  <View className="flex-row items-center justify-between mb-3 px-1">
                    <Text className="text-xs text-[#8e8e93]">
                      Showing {(currentPage - 1) * itemsPerPage + 1}-
                      {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of{' '}
                      {filteredLogs.length}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setCurrentPage(1);
                        setShowFilters(true);
                      }}
                    >
                      <View className="flex-row items-center bg-[#f9f9f9] px-2 py-1 rounded-lg">
                        <Symbol name="ellipsis" size={14} color="#8e8e93" />
                        <Text className="ml-1 text-xs text-[#8e8e93]">10 per page</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View className="gap-3">
                    {paginatedLogs.map((log) => {
                      const logType = LOG_TYPES.find((lt) => lt.id === log.type);
                      const parsedDate = new Date(log.date);
                      return (
                        <View
                          key={log.id}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          }}
                        >
                          <View className="flex-row items-center p-4">
                            <View
                              className="w-11 h-11 rounded-full items-center justify-center"
                              style={{ backgroundColor: `${logType?.color || '#408059'}1A` }}
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
                            <View className="flex-1 ml-3">
                              <Text className="text-sm font-semibold text-[#1c1c1e]">
                                {logType?.label}
                              </Text>
                              <Text className="text-xs text-[#8e8e93] mt-0.5" numberOfLines={1}>
                                {log.description}
                              </Text>
                              <Text className="text-xs text-[#c7c7cc] mt-1">
                                {parsedDate.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                            <View className="flex-row gap-2">
                              <TouchableOpacity
                                onPress={() => {
                                  if (selectedFarm) {
                                    setEditingLog(log);
                                  } else {
                                    const logFarm = farms.find(
                                      (f) => f.id === (log.data as { farm_id?: number }).farm_id,
                                    );
                                    if (logFarm) {
                                      setSelectedFarmId(logFarm.id);
                                      setEditingLog(log);
                                    } else {
                                      Alert.alert('Error', 'Farm not found for this log');
                                    }
                                  }
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
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setDeletingLog(log);
                                  setShowDeleteConfirmation(true);
                                }}
                              >
                                <Symbol name="trash" size={20} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <View className="mt-4 flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-xl"
                        style={{
                          backgroundColor: currentPage === 1 ? '#f9f9f9' : '#408059',
                          opacity: currentPage === 1 ? 0.5 : 1,
                        }}
                      >
                        <Symbol
                          name="chevron.left"
                          size={18}
                          color={currentPage === 1 ? '#8e8e93' : '#FFFFFF'}
                        />
                      </TouchableOpacity>

                      <View className="flex-row">
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
                            <TouchableOpacity
                              key={pageNum}
                              onPress={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg items-center justify-center mx-0.5 ${
                                currentPage === pageNum ? 'bg-[#408059]' : 'bg-[#f9f9f9]'
                              }`}
                            >
                              <Text
                                className={`text-xs font-semibold ${
                                  currentPage === pageNum ? 'text-white' : 'text-[#374151]'
                                }`}
                              >
                                {pageNum}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-xl"
                        style={{
                          backgroundColor: currentPage === totalPages ? '#f9f9f9' : '#408059',
                          opacity: currentPage === totalPages ? 0.5 : 1,
                        }}
                      >
                        <Symbol
                          name="chevron.right"
                          size={18}
                          color={currentPage === totalPages ? '#8e8e93' : '#FFFFFF'}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>

      {selectedFarm && (
        <AddEntryModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          farm={selectedFarm}
          tabs={['log']}
          initialTab="log"
          onLogSaveSuccess={() => {
            refetchRecords();
          }}
        />
      )}

      {selectedFarm && editingLog && (
        <EditActivityModal
          visible={!!editingLog}
          onClose={() => setEditingLog(undefined)}
          farm={selectedFarm}
          logType={editingLog.type}
          record={editingLog.data}
          onSaveSuccess={() => {
            setEditingLog(undefined);
            refetchRecords();
          }}
        />
      )}

      {showDatePickerFrom && (
        <Modal
          transparent
          visible={showDatePickerFrom}
          onRequestClose={() => setShowDatePickerFrom(false)}
          animationType="fade"
        >
          <View className="flex-1 bg-black/30 items-center justify-center">
            <View className="bg-white rounded-2xl p-4" style={{ width: '85%' }}>
              <Text className="text-lg font-semibold text-[#1c1c1e] mb-4 text-center">
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
              <TouchableOpacity
                onPress={() => setShowDatePickerFrom(false)}
                className="mt-4 py-3 rounded-xl items-center"
                style={{ backgroundColor: '#408059' }}
              >
                <Text className="font-semibold text-white">Done</Text>
              </TouchableOpacity>
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
          <View className="flex-1 bg-black/30">
            <View className="flex-1 mt-auto bg-white rounded-t-3xl overflow-hidden">
              <View className="w-12 h-1 bg-[#e5e5ea] rounded-full mx-auto mt-3 mb-2" />
              <Text className="text-lg font-semibold text-[#1c1c1e] px-6 pt-2 pb-4">
                Select Farm
              </Text>
              <ScrollView className="flex-1 px-4 pb-6">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFarmId(undefined);
                    setCurrentPage(1);
                    setShowFarmSelector(false);
                  }}
                  className={`flex-row items-center p-4 rounded-2xl mb-2 ${
                    selectedFarmId === undefined ? 'bg-[#408059]' : 'bg-[#f9f9f9]'
                  }`}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
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
                  <View className="ml-3 flex-1">
                    <Text
                      className={`text-base font-semibold ${
                        selectedFarmId === undefined ? 'text-white' : 'text-[#1c1c1e]'
                      }`}
                    >
                      All Farms
                    </Text>
                    <Text
                      className={`text-xs ${
                        selectedFarmId === undefined ? 'text-white/80' : 'text-[#8e8e93]'
                      }`}
                    >
                      {farms.length} farm{farms.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {selectedFarmId === undefined && (
                    <Symbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
                  )}
                </TouchableOpacity>

                {farms.map((farm) => (
                  <TouchableOpacity
                    key={farm.id}
                    onPress={() => {
                      setSelectedFarmId(farm.id);
                      setCurrentPage(1);
                      setShowFarmSelector(false);
                    }}
                    className={`flex-row items-center p-4 rounded-2xl mb-2 ${
                      selectedFarmId === farm.id ? 'bg-[#408059]' : 'bg-[#f9f9f9]'
                    }`}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{
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
                    <View className="ml-3 flex-1">
                      <Text
                        className={`text-base font-semibold ${
                          selectedFarmId === farm.id ? 'text-white' : 'text-[#1c1c1e]'
                        }`}
                      >
                        {farm.name}
                      </Text>
                      <Text
                        className={`text-xs ${
                          selectedFarmId === farm.id ? 'text-white/80' : 'text-[#8e8e93]'
                        }`}
                      >
                        {farm.crop} • {farm.area.toFixed(1)} acres
                      </Text>
                    </View>
                    {selectedFarmId === farm.id && (
                      <Symbol name="checkmark.circle.fill" size={22} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => setShowFarmSelector(false)}
                className="mx-4 mb-6 py-3.5 rounded-xl items-center"
                style={{ backgroundColor: '#f9f9f9' }}
              >
                <Text className="font-semibold text-[#374151]">Cancel</Text>
              </TouchableOpacity>
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
          <View className="flex-1 bg-black/30 items-center justify-center">
            <View className="bg-white rounded-2xl p-4" style={{ width: '85%' }}>
              <Text className="text-lg font-semibold text-[#1c1c1e] mb-4 text-center">
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
              <TouchableOpacity
                onPress={() => setShowDatePickerTo(false)}
                className="mt-4 py-3 rounded-xl items-center"
                style={{ backgroundColor: '#408059' }}
              >
                <Text className="font-semibold text-white">Done</Text>
              </TouchableOpacity>
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
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          <View
            className="rounded-2xl p-6 w-full"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
          >
            <View className="items-center mb-4">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <Symbol name="exclamationmark.triangle.fill" size={28} color="#EF4444" />
              </View>
            </View>
            <Text className="text-lg font-bold text-[#1c1c1e] text-center mb-2">Delete Log?</Text>
            <Text className="text-sm text-[#8e8e93] text-center mb-6">
              Are you sure you want to delete this {deletingLog?.type} log from{' '}
              {deletingLog
                ? new Date(deletingLog.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : ''}
              ?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowDeleteConfirmation(false)}
                className="flex-1 py-3 rounded-xl items-center border border-[#e5e5ea]"
              >
                <Text className="font-semibold text-[#374151]">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteLog}
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: '#EF4444' }}
              >
                <Text className="font-semibold text-white">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
