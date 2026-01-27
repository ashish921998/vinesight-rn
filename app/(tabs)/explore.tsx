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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol } from '@/components/ui/Symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
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

const EXPLORE_TABS: { id: ExploreTab; label: string; icon: string }[] = [
  { id: 'farms', label: 'Farms', icon: 'leaf.fill' },
  { id: 'workers', label: 'Workers', icon: 'person.2.fill' },
  { id: 'warehouse', label: 'Warehouse', icon: 'cube.fill' },
];

const WORKER_SUB_TABS: {
  id: WorkersSubTab;
  label: string;
  icon: string;
}[] = [
  { id: 'workers', label: 'Workers', icon: 'person.2.fill' },
  { id: 'attendance', label: 'Attendance', icon: 'calendar' },
  { id: 'analytics', label: 'Analytics', icon: 'chart.bar.fill' },
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
      <View style={{ paddingHorizontal: spacing[4], marginBottom: spacing[3] }}>
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
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing[8],
            }}
          >
            <ActivityIndicator size="large" color="#408059" />
            <Text
              style={{ color: colors.surface[500], fontSize: fontSize.base, marginTop: spacing[4] }}
            >
              Loading farms...
            </Text>
          </View>
        );
      }

      if (searchQuery.trim()) {
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
                borderRadius: borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[4],
                backgroundColor: colors.surface[50],
              }}
            >
              <Symbol name="magnifyingglass" size={36} color="#c7c7cc" />
            </View>
            <Text
              style={{
                color: colors.black,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                textAlign: 'center',
              }}
            >
              No Results Found
            </Text>
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.base,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              Try a different search term
            </Text>
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginTop: spacing[4] }}>
              <Text style={{ color: colors.primary[500], fontWeight: fontWeight.medium }}>
                Clear Search
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

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
              width: 96,
              height: 96,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[6],
              backgroundColor: 'rgba(64, 128, 89, 0.1)',
            }}
          >
            <Symbol name="leaf.fill" size={48} color="#408059" />
          </View>
          <Text
            style={{
              color: colors.black,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.semibold,
              textAlign: 'center',
            }}
          >
            No Farms Yet
          </Text>
          <Text
            style={{
              color: colors.surface[500],
              fontSize: fontSize.base,
              textAlign: 'center',
              marginTop: spacing[2],
            }}
          >
            Add your first farm to start tracking irrigation, sprays, and harvests.
          </Text>
          <TouchableOpacity
            style={{
              paddingHorizontal: spacing[6],
              paddingVertical: spacing[3],
              borderRadius: borderRadius.xl,
              marginTop: spacing[6],
              backgroundColor: colors.primary[500],
            }}
            onPress={handleAddFarm}
          >
            <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>Add Farm</Text>
          </TouchableOpacity>
        </View>
      );
    };

    const StatsHeader = () => (
      <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[2] }}>
        {/* Results Count */}
        {searchQuery.trim() && (
          <Text
            style={{ color: colors.surface[500], fontSize: fontSize.sm, marginTop: spacing[2] }}
          >
            {filteredFarms.length} farm{filteredFarms.length !== 1 ? 's' : ''} found
          </Text>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && farms && farms.length > 0 && (
          <View style={{ flexDirection: 'row', marginTop: spacing[2], gap: spacing[3] }}>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                padding: spacing[3],
                backgroundColor: colors.surface[100],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(64, 128, 89, 0.1)',
                  }}
                >
                  <Symbol name="leaf.fill" size={16} color="#408059" />
                </View>
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      color: colors.black,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {farms.length}
                  </Text>
                  <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                    Total Farms
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                padding: spacing[3],
                backgroundColor: colors.surface[100],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(64, 128, 89, 0.1)',
                  }}
                >
                  <Symbol name="arrow.up.left.and.arrow.down.right" size={16} color="#408059" />
                </View>
                <View style={{ marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      color: colors.black,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
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
            activeOpacity={0.8}
            onPress={handleAddFarm}
            style={{
              position: 'absolute',
              bottom: spacing[6],
              right: spacing[6],
              width: 56,
              height: 56,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary[500],
            }}
          >
            <Symbol name="plus" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderWorkersTab = () => {
    const renderWorker = ({ item }: { item: Worker }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleEditWorker(item)}
        style={{
          backgroundColor: colors.surface[100],
          marginHorizontal: spacing[4],
          marginBottom: spacing[3],
          borderRadius: borderRadius['2xl'],
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing[4] }}>
          {/* Avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              backgroundColor: colors.primary[100],
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: colors.primary[600],
              }}
            >
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
              }}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}>
              <Symbol name="dollarsign.circle" size={12} color="#6B7280" />
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: colors.surface[500],
                  marginLeft: spacing[1],
                }}
              >
                ₹{item.daily_rate}/day
              </Text>
            </View>
          </View>

          {/* Advance Balance */}
          {item.advance_balance > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FEF3C7',
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                borderRadius: borderRadius.full,
                marginRight: spacing[2],
              }}
            >
              <Symbol name="arrow.up.circle.fill" size={12} color="#F59E0B" />
              <Text
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  color: '#F59E0B',
                  marginLeft: spacing[1],
                }}
              >
                ₹{item.advance_balance}
              </Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            onPress={() => handleDeleteWorker(item)}
            style={{ padding: spacing[2] }}
          >
            <Symbol name="trash" size={18} color="#EF4444" />
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
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                letterSpacing: 1,
                marginHorizontal: spacing[4],
                marginBottom: spacing[2],
              }}
            >
              ACTIVE WORKERS ({activeWorkers.length})
            </Text>
          ) : null
        }
        ListFooterComponent={
          inactiveWorkers.length > 0 ? (
            <View style={{ marginTop: spacing[4] }}>
              <Text
                style={{
                  color: colors.surface[500],
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                  letterSpacing: 1,
                  marginHorizontal: spacing[4],
                  marginBottom: spacing[2],
                }}
              >
                INACTIVE WORKERS ({inactiveWorkers.length})
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
          !workersLoading ? (
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
                  backgroundColor: colors.primary[100],
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing[4],
                }}
              >
                <Symbol name="person.2" size={40} color="#408059" />
              </View>
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize.lg,
                  fontWeight: fontWeight.semibold,
                  textAlign: 'center',
                }}
              >
                No Workers Yet
              </Text>
              <Text
                style={{
                  color: colors.surface[500],
                  fontSize: fontSize.sm,
                  textAlign: 'center',
                  marginTop: spacing[2],
                }}
              >
                Add workers to track attendance,{`\n`}payments, and settlements.
              </Text>
              <TouchableOpacity
                onPress={() => setShowAddWorkerModal(true)}
                style={{
                  backgroundColor: colors.primary[600],
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[4],
                }}
              >
                <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>
                  Add Worker
                </Text>
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
            backgroundColor: '#EDE9FE',
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing[4],
          }}
        >
          <Symbol name="chart.bar" size={40} color="#8B5CF6" />
        </View>
        <Text
          style={{
            color: colors.surface[900],
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            textAlign: 'center',
          }}
        >
          Labor Analytics
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            textAlign: 'center',
            marginTop: spacing[2],
          }}
        >
          View labor costs, productivity,{`\n`}and attendance patterns.
        </Text>
        <Text style={{ color: colors.surface[400], fontSize: fontSize.xs, marginTop: spacing[4] }}>
          Coming soon in a future update
        </Text>
      </View>
    );

    return (
      <>
        {/* Workers Sub-Tabs */}
        <View
          style={{
            backgroundColor: colors.surface[100],
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            paddingBottom: spacing[3],
          }}
        >
          {searchQuery.trim() && selectedWorkerSubTab === 'workers' && (
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.sm,
                marginBottom: spacing[2],
              }}
            >
              {filteredWorkers.length} worker{filteredWorkers.length !== 1 ? 's' : ''} found
            </Text>
          )}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface[50],
              borderRadius: borderRadius.xl,
              padding: spacing[1],
            }}
          >
            {WORKER_SUB_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedWorkerSubTab(tab.id)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  borderRadius: borderRadius.lg,
                  backgroundColor:
                    selectedWorkerSubTab === tab.id ? colors.surface[100] : 'transparent',
                }}
              >
                <Symbol
                  name={tab.icon}
                  size={16}
                  color={selectedWorkerSubTab === tab.id ? '#408059' : '#6B7280'}
                />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    marginLeft: spacing[1],
                    color:
                      selectedWorkerSubTab === tab.id ? colors.primary[600] : colors.surface[500],
                  }}
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
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              bottom: spacing[6],
              right: spacing[6],
              width: 56,
              height: 56,
              backgroundColor: colors.primary[600],
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Symbol name="plus" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderWarehouseTab = () => {
    if (warehouseLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
            Loading inventory...
          </Text>
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
          <View
            style={{
              flexDirection: 'row',
              marginBottom: spacing[4],
              marginTop: spacing[4],
              gap: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                backgroundColor: COLORS.glass,
              }}
            >
              <Symbol
                name="exclamationmark.triangle.fill"
                size={24}
                color={lowStockItems.length > 0 ? COLORS.lowStock : COLORS.primary}
              />
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[2],
                }}
              >
                {lowStockItems.length}
              </Text>
              <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>Low Stock</Text>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                backgroundColor: COLORS.glass,
              }}
            >
              <Symbol name="dollarsign.circle.fill" size={24} color={COLORS.primary} />
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[2],
                }}
              >
                {currency === 'INR' ? '₹' : '$'}
                {warehouseTotals.value.toLocaleString()}
              </Text>
              <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>Value</Text>
            </View>
          </View>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
                backgroundColor: `${COLORS.lowStock}15`,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Symbol name="exclamationmark.triangle.fill" size={20} color={COLORS.lowStock} />
                <Text
                  style={{
                    color: COLORS.lowStock,
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                  }}
                >
                  Low Stock Alerts
                </Text>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.full,
                    marginLeft: 'auto',
                    backgroundColor: `${COLORS.lowStock}30`,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.lowStock,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {lowStockItems.length} items
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {lowStockItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleAddStock(item)}
                      style={{ width: 160 }}
                    >
                      <View
                        style={{
                          borderRadius: borderRadius.xl,
                          padding: spacing[3],
                          backgroundColor: COLORS.glass,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Symbol
                            name={item.type === 'fertilizer' ? 'leaf.fill' : 'drop.fill'}
                            size={16}
                            color={COLORS.lowStock}
                          />
                          <Text
                            style={{
                              color: colors.surface[900],
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              marginLeft: spacing[2],
                            }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: colors.surface[600],
                            fontSize: fontSize.xs,
                            marginTop: spacing[1],
                          }}
                        >
                          {item.quantity} {item.unit}
                        </Text>
                        {item.reorder_quantity && (
                          <Text
                            style={{
                              color: colors.surface[500],
                              fontSize: fontSize.xs,
                              marginTop: 2,
                            }}
                          >
                            Reorder at: {item.reorder_quantity} {item.unit}
                          </Text>
                        )}
                        <View
                          style={{
                            marginTop: spacing[2],
                            paddingVertical: 6,
                            paddingHorizontal: spacing[3],
                            borderRadius: borderRadius.full,
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            backgroundColor: COLORS.primary,
                          }}
                        >
                          <Text
                            style={{
                              color: 'white',
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.medium,
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
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.sm,
                marginBottom: spacing[3],
              }}
            >
              {filteredWarehouseItems.length} item{filteredWarehouseItems.length !== 1 ? 's' : ''}{' '}
              found
            </Text>
          )}

          {/* Filter Tabs */}
          <View
            style={{
              flexDirection: 'row',
              borderRadius: borderRadius.xl,
              padding: spacing[1],
              marginBottom: spacing[4],
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {(['all', 'fertilizer', 'spray'] as WarehouseFilter[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setWarehouseFilter(type)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: borderRadius.lg,
                  backgroundColor: warehouseFilter === type ? colors.surface[100] : 'transparent',
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: warehouseFilter === type ? colors.surface[900] : colors.surface[600],
                  }}
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
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[8],
                alignItems: 'center',
                backgroundColor: COLORS.glass,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${COLORS.primary}33`,
                }}
              >
                <Symbol name="cube" size={32} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  color: colors.surface[900],
                  fontWeight: fontWeight.semibold,
                  marginTop: spacing[4],
                  textAlign: 'center',
                }}
              >
                No items in warehouse
              </Text>
              <Text
                style={{
                  color: colors.surface[500],
                  fontSize: fontSize.sm,
                  marginTop: spacing[1],
                  textAlign: 'center',
                }}
              >
                Tap the + button to add your first inventory item
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingWarehouseItem(null);
                  setShowAddWarehouseModal(true);
                }}
                style={{
                  marginTop: spacing[4],
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: COLORS.primary,
                }}
              >
                <Symbol name="plus.circle.fill" size={20} color="white" />
                <Text
                  style={{
                    color: colors.white,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                  }}
                >
                  Add Item
                </Text>
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
                  style={{
                    borderRadius: borderRadius['2xl'],
                    padding: spacing[4],
                    marginBottom: spacing[3],
                    backgroundColor: isLowStock ? `${COLORS.lowStock}0D` : COLORS.glass,
                    borderColor: isLowStock ? `${COLORS.lowStock}4D` : 'transparent',
                    borderWidth: isLowStock ? 1 : 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: spacing[1],
                            borderRadius: borderRadius.full,
                            backgroundColor:
                              item.type === 'fertilizer'
                                ? `${COLORS.warehouseFertilizer}33`
                                : `${COLORS.warehouseSpray}33`,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Symbol
                              name={item.type === 'fertilizer' ? 'leaf.fill' : 'drop.fill'}
                              size={12}
                              color={itemColor}
                            />
                            <Text
                              style={{
                                color: itemColor,
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.medium,
                                marginLeft: spacing[1],
                              }}
                            >
                              {item.type === 'fertilizer' ? 'FERTILIZER' : 'SPRAY'}
                            </Text>
                          </View>
                        </View>
                        {isLowStock && (
                          <View
                            style={{
                              marginLeft: spacing[2],
                              paddingHorizontal: spacing[2],
                              paddingVertical: 2,
                              borderRadius: borderRadius.full,
                              backgroundColor: `${COLORS.lowStock}33`,
                            }}
                          >
                            <Text
                              style={{
                                color: COLORS.lowStock,
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.medium,
                              }}
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
                          <Symbol name="ellipsis.circle" size={24} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          marginTop: spacing[2],
                        }}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        Quantity
                      </Text>
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        Unit Price
                      </Text>
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        {currency === 'INR' ? '₹' : '$'}
                        {item.unit_price.toLocaleString()}/{item.unit}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        Total Value
                      </Text>
                      <Text
                        style={{
                          color: COLORS.primary,
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {currency === 'INR' ? '₹' : '$'}
                        {itemValue.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {item.notes && (
                    <Text
                      style={{
                        color: colors.surface[600],
                        fontSize: fontSize.xs,
                        marginTop: spacing[2],
                      }}
                      numberOfLines={2}
                    >
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
          style={{
            position: 'absolute',
            bottom: spacing[6],
            right: spacing[6],
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.primary,
          }}
        >
          <Symbol name="plus" size={28} color="white" />
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
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Global Search Bar */}
      <View
        style={{
          backgroundColor: colors.surface[100],
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[3],
          paddingTop: insets.top + spacing[3],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface[50],
            borderRadius: borderRadius['2xl'],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderWidth: 1,
            borderColor: isSearchFocused ? colors.primary[500] : 'transparent',
          }}
        >
          <Symbol
            name="magnifyingglass"
            size={20}
            color={isSearchFocused ? '#408059' : '#c7c7cc'}
          />
          <TextInput
            style={{
              flex: 1,
              marginLeft: spacing[3],
              fontSize: fontSize.base,
              color: colors.black,
            }}
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
              <Symbol name="xmark.circle.fill" size={20} color="#c7c7cc" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Animated Sticky Header with Tabs */}
      <Animated.View
        style={{
          height: headerHeight,
          backgroundColor: colors.surface[100],
          boxShadow: '0 2px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing[4] }}>
          {EXPLORE_TABS.map((tab) => {
            const isSelected = selectedTab === tab.id;
            return (
              <Animated.View
                key={tab.id}
                style={{
                  flex: 1,
                  transform: [{ scale: tabScaleAnims[tab.id] }],
                }}
              >
                <TouchableOpacity
                  onPress={() => handleTabChange(tab.id)}
                  activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Animated.View
                    style={{
                      alignItems: 'center',
                      overflow: 'hidden',
                      height: iconContainerHeight,
                      opacity: iconOpacity,
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: borderRadius['2xl'],
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected ? 'rgba(64, 128, 89, 0.1)' : 'transparent',
                      }}
                    >
                      <Symbol
                        name={tab.icon}
                        size={24}
                        color={isSelected ? '#408059' : '#9CA3AF'}
                      />
                    </View>
                  </Animated.View>

                  <Animated.Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: isSelected ? '#408059' : '#6B7280',
                      marginTop: textMargin,
                    }}
                  >
                    {tab.label}
                  </Animated.Text>

                  {/* Active Indicator */}
                  {isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        height: 2,
                        borderRadius: borderRadius.full,
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
        style={{
          flex: 1,
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
