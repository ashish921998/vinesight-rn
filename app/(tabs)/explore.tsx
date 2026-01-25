import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFarms,
  useDeleteFarm,
  useWorkers,
  useDeleteWorker,
  useWarehouseItems,
  useProfile,
  useDeleteWarehouseItem,
} from '@/hooks';
import { FarmCard } from '@/components/cards';
import {
  AddWorkerModal,
  AttendanceView,
  AddWarehouseItemModal,
  AddStockModal,
} from '@/components/screens';
import type { Farm, Worker, WarehouseItem } from '@/types';

type ExploreTab = 'farms' | 'workers' | 'warehouse';
type WorkersSubTab = 'workers' | 'attendance' | 'analytics';
type WarehouseFilter = 'all' | 'fertilizer' | 'spray';

const EXPLORE_TABS: { id: ExploreTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'farms', label: 'Farms', icon: 'leaf' },
  { id: 'workers', label: 'Workers', icon: 'people' },
  { id: 'warehouse', label: 'Warehouse', icon: 'cube' },
];

const WORKER_SUB_TABS: {
  id: WorkersSubTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'workers', label: 'Workers', icon: 'people' },
  { id: 'attendance', label: 'Attendance', icon: 'calendar' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
];

const COLORS = {
  primary: '#408059',
  background: '#f2f2f7',
  glass: 'rgba(255, 255, 255, 0.8)',
  lowStock: '#D9731F',
  warehouseFertilizer: '#598C6B',
  warehouseSpray: '#408059',
};

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<ExploreTab>('farms');

  // Scroll animation values
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const tabSwitchAnim = useMemo(() => new Animated.Value(1), []);
  const tabScaleAnims = useMemo(
    () => ({
      farms: new Animated.Value(1),
      workers: new Animated.Value(1),
      warehouse: new Animated.Value(1),
    }),
    [],
  );

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Farms state & hooks
  const { data: farms, isLoading: farmsLoading, refetch: refetchFarms } = useFarms();
  const deleteFarm = useDeleteFarm();

  // Workers state & hooks
  const { data: workers, isLoading: workersLoading, refetch: refetchWorkers } = useWorkers();
  const deleteWorker = useDeleteWorker();
  const [selectedWorkerSubTab, setSelectedWorkerSubTab] = useState<WorkersSubTab>('workers');
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | undefined>(undefined);

  // Warehouse state & hooks
  const {
    data: warehouseItems,
    isLoading: warehouseLoading,
    refetch: refetchWarehouse,
    isRefetching: warehouseRefetching,
  } = useWarehouseItems();
  const { data: profile } = useProfile();
  const deleteItemMutation = useDeleteWarehouseItem();
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseFilter>('all');
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingWarehouseItem, setEditingWarehouseItem] = useState<WarehouseItem | null>(null);
  const [stockItem, setStockItem] = useState<WarehouseItem | null>(null);

  const currency = profile?.preferred_currency || 'INR';

  // ============================================================
  // TAB SWITCHING WITH ANIMATION
  // ============================================================

  const handleTabChange = useCallback(
    (newTab: ExploreTab) => {
      if (newTab === selectedTab) return;

      // Scale animation on tap
      Animated.sequence([
        Animated.spring(tabScaleAnims[newTab], {
          toValue: 0.92,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.spring(tabScaleAnims[newTab], {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }),
      ]).start();

      // Fade out current content
      Animated.timing(tabSwitchAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setSelectedTab(newTab);
        // Reset scroll position and search
        scrollY.setValue(0);
        setSearchQuery('');
        // Fade in new content
        Animated.timing(tabSwitchAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    },
    [selectedTab, tabSwitchAnim, scrollY, tabScaleAnims],
  );

  // Header animation values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [70, 50],
    extrapolate: 'clamp',
  });

  const iconContainerHeight = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [48, 0],
    extrapolate: 'clamp',
  });

  const iconOpacity = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const textMargin = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [4, 0],
    extrapolate: 'clamp',
  });

  // ============================================================
  // FARMS TAB LOGIC
  // ============================================================

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  const filteredFarms = useMemo(() => {
    if (!farms) return [];
    if (!searchQuery.trim()) return farms;

    const query = searchQuery.toLowerCase().trim();
    return farms.filter(
      (farm) =>
        farm.name.toLowerCase().includes(query) ||
        farm.crop?.toLowerCase().includes(query) ||
        farm.crop_variety?.toLowerCase().includes(query) ||
        farm.region?.toLowerCase().includes(query),
    );
  }, [farms, searchQuery]);

  const handleFarmPress = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}`);
  };

  const handleAddFarm = () => {
    router.push('/farm/add');
  };

  const handleEditFarm = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}/edit`);
  };

  const handleDeleteFarm = (farm: Farm) => {
    const farmId = farm.id;
    if (typeof farmId !== 'number') return;
    Alert.alert(
      'Delete Farm',
      `Are you sure you want to delete "${farm.name}"? This will also delete all associated data including irrigation records, spray records, harvests, expenses, soil profiles, and other farm-related data. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFarm.mutateAsync(farmId);
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to delete farm';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ],
    );
  };

  // ============================================================
  // WORKERS TAB LOGIC
  // ============================================================

  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    if (!searchQuery.trim()) return workers;

    const query = searchQuery.toLowerCase().trim();
    return workers.filter((worker) => worker.name.toLowerCase().includes(query));
  }, [workers, searchQuery]);

  const activeWorkers = useMemo(
    () => filteredWorkers.filter((w) => w.is_active),
    [filteredWorkers],
  );
  const inactiveWorkers = useMemo(
    () => filteredWorkers.filter((w) => !w.is_active),
    [filteredWorkers],
  );

  const handleDeleteWorker = (worker: Worker) => {
    Alert.alert(
      'Delete Worker?',
      `This will permanently delete ${worker.name} and all their associated records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (worker.id) {
              await deleteWorker.mutateAsync(worker.id);
            }
          },
        },
      ],
    );
  };

  const handleEditWorker = (worker: Worker) => {
    setWorkerToEdit(worker);
    setShowAddWorkerModal(true);
  };

  const handleAddWorkerModalClose = () => {
    setShowAddWorkerModal(false);
    setWorkerToEdit(undefined);
  };

  // ============================================================
  // WAREHOUSE TAB LOGIC
  // ============================================================

  const filteredWarehouseItems = useMemo(() => {
    if (!warehouseItems) return [];

    let items = warehouseItems;

    // Filter by type
    if (warehouseFilter !== 'all') {
      items = items.filter((item) => item.type === warehouseFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) || item.notes?.toLowerCase().includes(query),
      );
    }

    return items;
  }, [warehouseItems, warehouseFilter, searchQuery]);

  const lowStockItems = useMemo(() => {
    if (!warehouseItems) return [];
    return warehouseItems.filter(
      (item) => item.reorder_quantity && item.quantity <= item.reorder_quantity,
    );
  }, [warehouseItems]);

  const warehouseTotals = useMemo(() => {
    if (!warehouseItems) return { count: 0, value: 0, fertilizers: 0, sprays: 0 };
    return {
      count: warehouseItems.length,
      value: warehouseItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      fertilizers: warehouseItems.filter((item) => item.type === 'fertilizer').length,
      sprays: warehouseItems.filter((item) => item.type === 'spray').length,
    };
  }, [warehouseItems]);

  const handleDeleteWarehouseItem = (item: WarehouseItem) => {
    Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (item.id) {
            deleteItemMutation.mutate(item.id, {
              onError: (error) => {
                Alert.alert('Error', error.message || 'Failed to delete item');
              },
            });
          }
        },
      },
    ]);
  };

  const handleAddStock = (item: WarehouseItem) => {
    setStockItem(item);
    setShowStockModal(true);
  };

  const handleEditWarehouseItem = (item: WarehouseItem) => {
    setEditingWarehouseItem(item);
    setShowAddWarehouseModal(true);
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderFarmsTab = () => {
    const renderFarm = ({ item }: { item: Farm }) => (
      <View className="px-4 mb-3">
        <FarmCard
          farm={item}
          onPress={() => handleFarmPress(item)}
          onEdit={() => handleEditFarm(item)}
          onDelete={() => handleDeleteFarm(item)}
        />
      </View>
    );

    const renderEmpty = () => {
      if (farmsLoading) {
        return (
          <View className="flex-1 items-center justify-center p-8">
            <ActivityIndicator size="large" color="#408059" />
            <Text className="text-base mt-4" style={{ color: '#8e8e93' }}>
              Loading farms...
            </Text>
          </View>
        );
      }

      if (searchQuery.trim()) {
        return (
          <View className="flex-1 items-center justify-center p-8">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: '#f2f2f7' }}
            >
              <Ionicons name="search-outline" size={36} color="#c7c7cc" />
            </View>
            <Text className="text-lg font-semibold text-center" style={{ color: '#000000' }}>
              No Results Found
            </Text>
            <Text className="text-base text-center mt-2" style={{ color: '#8e8e93' }}>
              Try a different search term
            </Text>
            <TouchableOpacity onPress={() => setSearchQuery('')} className="mt-4">
              <Text className="font-medium" style={{ color: '#408059' }}>
                Clear Search
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View className="flex-1 items-center justify-center p-8">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
          >
            <Ionicons name="leaf-outline" size={48} color="#408059" />
          </View>
          <Text className="text-xl font-semibold text-center" style={{ color: '#000000' }}>
            No Farms Yet
          </Text>
          <Text className="text-base text-center mt-2" style={{ color: '#8e8e93' }}>
            Add your first farm to start tracking irrigation, sprays, and harvests.
          </Text>
          <TouchableOpacity
            className="px-6 py-3 rounded-xl mt-6"
            style={{ backgroundColor: '#408059' }}
            onPress={handleAddFarm}
          >
            <Text className="text-white font-semibold">Add Farm</Text>
          </TouchableOpacity>
        </View>
      );
    };

    const StatsHeader = () => (
      <View className="px-4 pb-2">
        {/* Results Count */}
        {searchQuery.trim() && (
          <Text className="text-sm mt-2" style={{ color: '#8e8e93' }}>
            {filteredFarms.length} farm{filteredFarms.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && farms && farms.length > 0 && (
          <View className="flex-row mt-2 gap-3">
            <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#ffffff' }}>
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                >
                  <Ionicons name="leaf" size={16} color="#408059" />
                </View>
                <View className="ml-2">
                  <Text className="text-lg font-bold" style={{ color: '#000000' }}>
                    {farms.length}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    Total Farms
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: '#ffffff' }}>
              <View className="flex-row items-center">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
                >
                  <Ionicons name="resize" size={16} color="#408059" />
                </View>
                <View className="ml-2">
                  <Text className="text-lg font-bold" style={{ color: '#000000' }}>
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text className="text-xs" style={{ color: '#8e8e93' }}>
                    Total Acres
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );

    return (
      <>
        <Animated.FlatList
          data={filteredFarms}
          renderItem={renderFarm}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 100,
            flexGrow: 1,
          }}
          ListHeaderComponent={<StatsHeader />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={farmsLoading && !searchQuery}
              onRefresh={refetchFarms}
              tintColor="#408059"
            />
          }
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
        />

        {/* FAB */}
        {(farms?.length || 0) > 0 && (
          <TouchableOpacity
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center"
            activeOpacity={0.8}
            onPress={handleAddFarm}
            style={{
              backgroundColor: '#408059',
            }}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderWorkersTab = () => {
    const renderWorker = ({ item }: { item: Worker }) => (
      <TouchableOpacity
        className="bg-white mx-4 mb-3 rounded-2xl overflow-hidden"
        activeOpacity={0.7}
        onPress={() => handleEditWorker(item)}
      >
        <View className="flex-row items-center p-4">
          {/* Avatar */}
          <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
            <Text className="text-lg font-bold text-primary-600">
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Info */}
          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-surface-900">{item.name}</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="cash-outline" size={12} color="#6B7280" />
              <Text className="text-sm text-surface-500 ml-1">₹{item.daily_rate}/day</Text>
            </View>
          </View>

          {/* Advance Balance */}
          {item.advance_balance > 0 && (
            <View className="flex-row items-center bg-orange-100 px-2 py-1 rounded-full mr-2">
              <Ionicons name="arrow-up-circle" size={12} color="#F59E0B" />
              <Text className="text-xs font-semibold text-orange-600 ml-1">
                ₹{item.advance_balance}
              </Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity onPress={() => handleDeleteWorker(item)} className="p-2">
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );

    const renderWorkersSubTab = () => (
      <Animated.FlatList
        data={activeWorkers}
        renderItem={renderWorker}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          activeWorkers.length > 0 ? (
            <Text className="text-xs font-bold text-surface-500 tracking-wider mx-4 mb-2">
              ACTIVE WORKERS ({activeWorkers.length})
            </Text>
          ) : null
        }
        ListFooterComponent={
          inactiveWorkers.length > 0 ? (
            <View className="mt-4">
              <Text className="text-xs font-bold text-surface-500 tracking-wider mx-4 mb-2">
                INACTIVE WORKERS ({inactiveWorkers.length})
              </Text>
              {inactiveWorkers.map((worker) => (
                <View key={String(worker.id)} className="opacity-60">
                  {renderWorker({ item: worker })}
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !workersLoading ? (
            <View className="flex-1 items-center justify-center p-8">
              <View className="w-20 h-20 bg-primary-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="people-outline" size={40} color="#408059" />
              </View>
              <Text className="text-lg font-semibold text-surface-900 text-center">
                No Workers Yet
              </Text>
              <Text className="text-sm text-surface-500 text-center mt-2">
                Add workers to track attendance,{`\n`}payments, and settlements.
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddWorkerModal(true)}
                className="bg-primary-600 px-6 py-3 rounded-xl mt-4"
              >
                <Text className="text-white font-semibold">Add Worker</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={workersLoading}
            onRefresh={refetchWorkers}
            tintColor="#408059"
          />
        }
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
      />
    );

    const renderAttendanceSubTab = () => (
      <AttendanceView workers={activeWorkers} onSaveSuccess={refetchWorkers} />
    );

    const renderAnalyticsSubTab = () => (
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-20 h-20 bg-purple-100 rounded-full items-center justify-center mb-4">
          <Ionicons name="bar-chart-outline" size={40} color="#8B5CF6" />
        </View>
        <Text className="text-lg font-semibold text-surface-900 text-center">Labor Analytics</Text>
        <Text className="text-sm text-surface-500 text-center mt-2">
          View labor costs, productivity,{`\n`}and attendance patterns.
        </Text>
        <Text className="text-xs text-surface-400 mt-4">Coming soon in a future update</Text>
      </View>
    );

    return (
      <>
        {/* Workers Sub-Tabs */}
        <View className="bg-white px-4 pt-2 pb-3">
          {searchQuery.trim() && selectedWorkerSubTab === 'workers' && (
            <Text className="text-sm mb-2" style={{ color: '#8e8e93' }}>
              {filteredWorkers.length} worker{filteredWorkers.length !== 1 ? 's' : ''} found
            </Text>
          )}
          <View className="flex-row bg-surface-100 rounded-xl p-1">
            {WORKER_SUB_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedWorkerSubTab(tab.id)}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
                  selectedWorkerSubTab === tab.id ? 'bg-white' : ''
                }`}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={selectedWorkerSubTab === tab.id ? '#408059' : '#6B7280'}
                />
                <Text
                  className={`text-sm font-medium ml-1.5 ${
                    selectedWorkerSubTab === tab.id ? 'text-primary-600' : 'text-surface-500'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Workers Sub-Tab Content */}
        {selectedWorkerSubTab === 'workers' && renderWorkersSubTab()}
        {selectedWorkerSubTab === 'attendance' && renderAttendanceSubTab()}
        {selectedWorkerSubTab === 'analytics' && renderAnalyticsSubTab()}

        {/* FAB */}
        {selectedWorkerSubTab === 'workers' && (workers?.length || 0) > 0 && (
          <TouchableOpacity
            onPress={() => setShowAddWorkerModal(true)}
            className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderWarehouseTab = () => {
    if (warehouseLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text className="text-surface-600 mt-4">Loading inventory...</Text>
        </View>
      );
    }

    return (
      <>
        <Animated.ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={warehouseRefetching}
              onRefresh={refetchWarehouse}
              tintColor={COLORS.primary}
            />
          }
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
        >
          {/* Summary Cards */}
          <View className="flex-row mb-4 mt-4" style={{ gap: 12 }}>
            <View
              className="flex-1 rounded-2xl p-4"
              style={{
                backgroundColor: COLORS.glass,
              }}
            >
              <Ionicons
                name="warning"
                size={24}
                color={lowStockItems.length > 0 ? COLORS.lowStock : COLORS.primary}
              />
              <Text className="text-2xl font-bold text-surface-900 mt-2">
                {lowStockItems.length}
              </Text>
              <Text className="text-xs text-surface-500">Low Stock</Text>
            </View>
            <View
              className="flex-1 rounded-2xl p-4"
              style={{
                backgroundColor: COLORS.glass,
              }}
            >
              <Ionicons name="cash" size={24} color={COLORS.primary} />
              <Text className="text-2xl font-bold text-surface-900 mt-2">
                {currency === 'INR' ? '₹' : '$'}
                {warehouseTotals.value.toLocaleString()}
              </Text>
              <Text className="text-xs text-surface-500">Value</Text>
            </View>
          </View>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <View
              className="rounded-2xl p-4 mb-4"
              style={{ backgroundColor: `${COLORS.lowStock}15` }}
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="warning" size={20} color={COLORS.lowStock} />
                <Text className="text-base font-semibold ml-2" style={{ color: COLORS.lowStock }}>
                  Low Stock Alerts
                </Text>
                <View
                  className="px-2 py-0.5 rounded-full ml-auto"
                  style={{ backgroundColor: `${COLORS.lowStock}30` }}
                >
                  <Text className="text-xs font-medium" style={{ color: COLORS.lowStock }}>
                    {lowStockItems.length} items
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row" style={{ gap: 12 }}>
                  {lowStockItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleAddStock(item)}
                      style={{ width: 160 }}
                    >
                      <View
                        className="rounded-xl p-3"
                        style={{
                          backgroundColor: COLORS.glass,
                        }}
                      >
                        <View className="flex-row items-center">
                          <Ionicons
                            name={item.type === 'fertilizer' ? 'leaf' : 'water'}
                            size={16}
                            color={COLORS.lowStock}
                          />
                          <Text
                            className="text-sm font-semibold text-surface-900 ml-2"
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text className="text-xs text-surface-600 mt-1">
                          {item.quantity} {item.unit}
                        </Text>
                        {item.reorder_quantity && (
                          <Text className="text-xs text-surface-500 mt-0.5">
                            Reorder at: {item.reorder_quantity} {item.unit}
                          </Text>
                        )}
                        <View
                          className="mt-2 py-1.5 px-3 rounded-full items-center self-start"
                          style={{ backgroundColor: COLORS.primary }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: 'white',
                            }}
                          >
                            Add Stock
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search Results Count */}
          {searchQuery.trim() && (
            <Text className="text-sm mb-3" style={{ color: '#8e8e93' }}>
              {filteredWarehouseItems.length} item{filteredWarehouseItems.length !== 1 ? 's' : ''}{' '}
              found
            </Text>
          )}

          {/* Filter Tabs */}
          <View
            className="flex-row rounded-xl p-1 mb-4"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {(['all', 'fertilizer', 'spray'] as WarehouseFilter[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setWarehouseFilter(type)}
                className={`flex-1 py-2.5 rounded-lg ${warehouseFilter === type ? 'bg-white' : ''}`}
              >
                <Text
                  className={`text-center text-sm font-medium ${
                    warehouseFilter === type ? 'text-surface-900' : 'text-surface-600'
                  }`}
                >
                  {type === 'all'
                    ? `ALL (${warehouseTotals.count})`
                    : type === 'fertilizer'
                      ? `FERTILIZERS (${warehouseTotals.fertilizers})`
                      : `SPRAYS (${warehouseTotals.sprays})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inventory List */}
          {filteredWarehouseItems.length === 0 ? (
            <View
              className="rounded-2xl p-8 items-center"
              style={{
                backgroundColor: COLORS.glass,
              }}
            >
              <View
                className="w-16 h-16 rounded-full items-center justify-center"
                style={{ backgroundColor: `${COLORS.primary}33` }}
              >
                <Ionicons name="cube-outline" size={32} color={COLORS.primary} />
              </View>
              <Text className="text-surface-900 font-semibold mt-4 text-center">
                No items in warehouse
              </Text>
              <Text className="text-surface-500 text-sm mt-1 text-center">
                Tap the + button to add your first inventory item
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingWarehouseItem(null);
                  setShowAddWarehouseModal(true);
                }}
                className="mt-4 px-6 py-3 rounded-xl flex-row items-center"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Ionicons name="add-circle" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Add Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredWarehouseItems.map((item) => {
              const isLowStock = item.reorder_quantity && item.quantity <= item.reorder_quantity;
              const itemValue = item.quantity * item.unit_price;
              const itemColor =
                item.type === 'fertilizer' ? COLORS.warehouseFertilizer : COLORS.warehouseSpray;

              return (
                <View
                  key={item.id}
                  className="rounded-2xl p-4 mb-3"
                  style={{
                    backgroundColor: isLowStock ? `${COLORS.lowStock}0D` : COLORS.glass,
                    borderColor: isLowStock ? `${COLORS.lowStock}4D` : 'transparent',
                    borderWidth: isLowStock ? 1 : 0,
                  }}
                >
                  <View className="flex-row items-start">
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <View
                          className="px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor:
                              item.type === 'fertilizer'
                                ? `${COLORS.warehouseFertilizer}33`
                                : `${COLORS.warehouseSpray}33`,
                          }}
                        >
                          <View className="flex-row items-center">
                            <Ionicons
                              name={item.type === 'fertilizer' ? 'leaf' : 'water'}
                              size={12}
                              color={itemColor}
                            />
                            <Text className="text-xs font-medium ml-1" style={{ color: itemColor }}>
                              {item.type === 'fertilizer' ? 'FERTILIZER' : 'SPRAY'}
                            </Text>
                          </View>
                        </View>
                        {isLowStock && (
                          <View
                            className="ml-2 px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${COLORS.lowStock}33` }}
                          >
                            <Text
                              className="text-xs font-medium"
                              style={{ color: COLORS.lowStock }}
                            >
                              Low
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert('Actions', `${item.name}`, [
                              {
                                text: 'Add Stock',
                                onPress: () => handleAddStock(item),
                              },
                              {
                                text: 'Edit',
                                onPress: () => handleEditWarehouseItem(item),
                              },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => handleDeleteWarehouseItem(item),
                              },
                              { text: 'Cancel', style: 'cancel' },
                            ]);
                          }}
                        >
                          <Ionicons name="ellipsis-horizontal-circle" size={24} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      <Text className="text-base font-semibold text-surface-900 mt-2">
                        {item.name}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row mt-3">
                    <View className="flex-1">
                      <Text className="text-xs text-surface-500">Quantity</Text>
                      <Text className="text-sm font-semibold text-surface-900">
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="text-xs text-surface-500">Unit Price</Text>
                      <Text className="text-sm font-medium text-surface-900">
                        {currency === 'INR' ? '₹' : '$'}
                        {item.unit_price.toLocaleString()}/{item.unit}
                      </Text>
                    </View>
                    <View className="flex-1 items-end">
                      <Text className="text-xs text-surface-500">Total Value</Text>
                      <Text className="text-sm font-semibold" style={{ color: COLORS.primary }}>
                        {currency === 'INR' ? '₹' : '$'}
                        {itemValue.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {item.notes && (
                    <Text className="text-xs text-surface-600 mt-2" numberOfLines={2}>
                      {item.notes}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </Animated.ScrollView>

        {/* FAB */}
        <TouchableOpacity
          onPress={() => {
            setEditingWarehouseItem(null);
            setShowAddWarehouseModal(true);
          }}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center"
          style={{
            backgroundColor: COLORS.primary,
          }}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </>
    );
  };

  // Get dynamic search placeholder
  const searchPlaceholder = useMemo(() => {
    switch (selectedTab) {
      case 'farms':
        return 'Search farms...';
      case 'workers':
        return 'Search workers...';
      case 'warehouse':
        return 'Search inventory...';
      default:
        return 'Search...';
    }
  }, [selectedTab]);

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
      {/* Global Search Bar */}
      <View className="bg-white px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <View
          className={`
            flex-row items-center bg-surface-50 rounded-2xl px-4 py-2
            border ${isSearchFocused ? 'border-primary-500' : 'border-transparent'}
          `}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={isSearchFocused ? '#408059' : '#c7c7cc'}
          />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: '#000000' }}
            placeholder={searchPlaceholder}
            placeholderTextColor="#c7c7cc"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#c7c7cc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Animated Sticky Header with Tabs */}
      <Animated.View
        className="bg-white"
        style={{
          height: headerHeight,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        <View className="flex-1 flex-row px-4">
          {EXPLORE_TABS.map((tab) => {
            const isSelected = selectedTab === tab.id;
            return (
              <Animated.View
                key={tab.id}
                className="flex-1"
                style={{
                  transform: [{ scale: tabScaleAnims[tab.id] }],
                }}
              >
                <TouchableOpacity
                  onPress={() => handleTabChange(tab.id)}
                  className="flex-1 items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Animated.View
                    className="items-center overflow-hidden"
                    style={{
                      height: iconContainerHeight,
                      opacity: iconOpacity,
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? 'rgba(64, 128, 89, 0.1)' : 'transparent',
                      }}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={24}
                        color={isSelected ? '#408059' : '#9CA3AF'}
                      />
                    </View>
                  </Animated.View>

                  <Animated.Text
                    className={`text-sm font-semibold`}
                    style={{
                      color: isSelected ? '#408059' : '#6B7280',
                      marginTop: textMargin,
                    }}
                  >
                    {tab.label}
                  </Animated.Text>

                  {/* Active Indicator */}
                  {isSelected && (
                    <View
                      className="absolute bottom-0 h-0.5 rounded-full"
                      style={{
                        width: '60%',
                        backgroundColor: '#408059',
                      }}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>

      {/* Tab Content with Fade Animation */}
      <Animated.View
        className="flex-1"
        style={{
          opacity: tabSwitchAnim,
        }}
      >
        {selectedTab === 'farms' && renderFarmsTab()}
        {selectedTab === 'workers' && renderWorkersTab()}
        {selectedTab === 'warehouse' && renderWarehouseTab()}
      </Animated.View>

      {/* Modals */}
      <AddWorkerModal
        visible={showAddWorkerModal}
        onClose={handleAddWorkerModalClose}
        worker={workerToEdit}
        onSaveSuccess={refetchWorkers}
      />

      <AddWarehouseItemModal
        visible={showAddWarehouseModal}
        onClose={() => {
          setShowAddWarehouseModal(false);
          setEditingWarehouseItem(null);
        }}
        editingItem={editingWarehouseItem}
      />

      <AddStockModal
        visible={showStockModal}
        onClose={() => {
          setShowStockModal(false);
          setStockItem(null);
        }}
        item={stockItem}
      />
    </View>
  );
}
