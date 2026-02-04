import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Platform,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight, shadows } from '@/styles/theme';
import { formatCurrency } from '@/i18n/format';
import {
  useFarms,
  useDeleteFarm,
  useWarehouseItems,
  useProfile,
  useDeleteWarehouseItem,
  useFabBottomPosition,
} from '@/hooks';
import { FarmCard } from '@/components/cards';
import { useModalStore } from '@/stores';
import type { Farm, WarehouseItem } from '@/types';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type ExploreTab = 'farms' | 'warehouse';
type WarehouseFilter = 'all' | 'fertilizer' | 'spray';

export default function ExploreScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const isAndroid = Platform.OS === 'android';
  const exploreTabs = useMemo(
    () =>
      [
        { id: 'farms' as const, label: t('tabs.farms'), icon: 'leaf.fill' },
        { id: 'warehouse' as const, label: t('warehouse.title'), icon: 'cube.fill' },
      ] as const,
    [t],
  );
  const { setAddWarehouseItem, setAddStock } = useModalStore();
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottomPosition();
  const [selectedTab, setSelectedTab] = useState<ExploreTab>('farms');
  const { fontScale } = useWindowDimensions();

  // Scroll animation values
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const tabSwitchAnim = useMemo(() => new Animated.Value(1), []);
  const tabScaleAnims = useMemo(
    () => ({
      farms: new Animated.Value(1),
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

  const currency = profile?.preferred_currency || 'INR';

  const openWarehouseItem = (item?: WarehouseItem | null) => {
    setAddWarehouseItem({ editingItem: item ?? null });
    router.push('/add-warehouse-item');
  };

  const openAddStock = (item: WarehouseItem) => {
    setAddStock({ item });
    router.push('/add-stock');
  };

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
  const headerMinHeightBase = fontScale > 1.3 ? 70 : 50;
  const headerMaxHeightBase = fontScale > 1.3 ? 90 : 70;
  const headerMinHeight = headerMinHeightBase + (isAndroid ? (fontScale > 1.3 ? 16 : 14) : 0);
  const headerMaxHeight = headerMaxHeightBase + (isAndroid ? (fontScale > 1.3 ? 16 : 14) : 0);
  const iconMinHeight = fontScale > 1.3 ? 48 : 0;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [headerMaxHeight, headerMinHeight],
    extrapolate: 'clamp',
  });

  const iconContainerHeight = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [48, iconMinHeight],
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
      t('farmDetails.deleteFarmTitle'),
      t('farmDetails.deleteFarmBody', { name: farm.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFarm.mutateAsync(farmId);
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : t('farmDetails.errors.deleteFarmFailed');
              Alert.alert(t('common.error'), errorMessage);
            }
          },
        },
      ],
    );
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
    Alert.alert(
      t('warehouse.alerts.deleteItemTitle'),
      t('warehouse.alerts.deleteItemBody', { name: item.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (item.id) {
              deleteItemMutation.mutate(item.id, {
                onError: (error) => {
                  Alert.alert(
                    t('common.error'),
                    error.message || t('common.errors.failedToDeleteItem'),
                  );
                },
              });
            }
          },
        },
      ],
    );
  };

  const handleAddStock = (item: WarehouseItem) => {
    openAddStock(item);
  };

  const handleEditWarehouseItem = (item: WarehouseItem) => {
    openWarehouseItem(item);
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
            <ActivityIndicator size="large" color={m3.colorScheme.primary} />
            <Text
              style={{ color: colors.surface[500], fontSize: fontSize.base, marginTop: spacing[4] }}
            >
              {t('common.loading')}
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
              <Icon
                name="magnifyingglass"
                size={36}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              />
            </View>
            <Text
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                textAlign: 'center',
              }}
            >
              {t('common.noResultsFound')}
            </Text>
            <Text
              style={{
                color: colors.surface[500],
                fontSize: fontSize.base,
                textAlign: 'center',
                marginTop: spacing[2],
              }}
            >
              {t('common.tryDifferentSearchTerm')}
            </Text>
            <Pressable onPress={() => setSearchQuery('')} style={{ marginTop: spacing[4] }}>
              <Text style={{ color: colors.primary[500], fontWeight: fontWeight.medium }}>
                {t('common.clearSearch')}
              </Text>
            </Pressable>
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
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          >
            <Icon name="leaf.fill" size={48} color={m3.colorScheme.primary} />
          </View>
          <Text
            style={{
              color: m3.colorScheme.onSurface,
              fontSize: fontSize.xl,
              fontWeight: fontWeight.semibold,
              textAlign: 'center',
            }}
          >
            {t('farms.empty.title')}
          </Text>
          <Text
            style={{
              color: colors.surface[500],
              fontSize: fontSize.base,
              textAlign: 'center',
              marginTop: spacing[2],
            }}
          >
            {t('farms.empty.subtitle')}
          </Text>
          <Pressable
            style={{
              paddingHorizontal: spacing[6],
              paddingVertical: spacing[3],
              borderRadius: borderRadius.xl,
              marginTop: spacing[6],
              backgroundColor: colors.primary[500],
            }}
            onPress={handleAddFarm}
          >
            <Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold }}>
              {t('farms.addFarm')}
            </Text>
          </Pressable>
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
            {t('farms.search.found', { count: filteredFarms.length })}
          </Text>
        )}

        {/* Quick Stats */}
        {!searchQuery.trim() && farms && farms.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing[4],
              gap: spacing[3],
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                minHeight: 72,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                justifyContent: 'center',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.full,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  }}
                >
                  <Icon name="leaf.fill" size={16} color={m3.colorScheme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {farms.length}
                  </Text>
                  <Text
                    style={{
                      color: colors.surface[500],
                      fontSize: fontSize.xs,
                    }}
                  >
                    {t('farms.stats.totalFarms')}
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                minHeight: 72,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                justifyContent: 'center',
                backgroundColor: colors.surface[100],
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: borderRadius.full,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  }}
                >
                  <Icon
                    name="arrow.up.left.and.arrow.down.right"
                    size={16}
                    color={m3.colorScheme.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: m3.colorScheme.onSurface,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {farms.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      color: colors.surface[500],
                      fontSize: fontSize.xs,
                    }}
                  >
                    {t('farms.stats.totalArea')}
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
              tintColor={m3.colorScheme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
        />

        {/* FAB */}
        {(farms?.length || 0) > 0 && (
          <Pressable
            onPress={handleAddFarm}
            style={{
              position: 'absolute',
              bottom: fabBottom,
              right: spacing[6],
              width: 56,
              height: 56,
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary[500],
            }}
          >
            <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
          </Pressable>
        )}
      </>
    );
  };

  const renderWarehouseTab = () => {
    if (warehouseLoading) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
            {t('warehouse.loading.inventory')}
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
              tintColor={colors.primary[500]}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
              }}
            >
              <Icon
                name="exclamationmark.triangle.fill"
                size={24}
                color={lowStockItems.length > 0 ? colors.warning : m3.colorScheme.primary}
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
              <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                {t('warehouse.labels.lowStock')}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
              }}
            >
              <Icon name="dollarsign.circle.fill" size={24} color={m3.colorScheme.primary} />
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[2],
                }}
              >
                {formatCurrency(warehouseTotals.value, currency)}
              </Text>
              <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                {t('common.labels.value')}
              </Text>
            </View>
          </View>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[4],
                backgroundColor: colorWithOpacity(colors.warning, 0.12),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Icon name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                  }}
                >
                  {t('warehouse.labels.lowStockAlerts')}
                </Text>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderRadius: borderRadius.full,
                    marginLeft: 'auto',
                    backgroundColor: colorWithOpacity(colors.warning, 0.2),
                  }}
                >
                  <Text
                    style={{
                      color: colors.warning,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {t('warehouse.itemsCount', { count: lowStockItems.length })}
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {lowStockItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => handleAddStock(item)}
                      style={{ width: 160 }}
                    >
                      <View
                        style={{
                          borderRadius: borderRadius.xl,
                          padding: spacing[3],
                          backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon
                            name={item.type === 'fertilizer' ? 'leaf.fill' : 'drop.fill'}
                            size={16}
                            color={colors.warning}
                          />
                          <Text
                            style={{
                              color: colors.surface[900],
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              marginLeft: spacing[2],
                              flexShrink: 1,
                            }}
                            numberOfLines={2}
                            accessibilityLabel={item.name}
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
                            {t('warehouse.reorderAt', {
                              quantity: item.reorder_quantity,
                              unit: item.unit,
                            })}
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
                            backgroundColor: m3.colorScheme.primary,
                          }}
                        >
                          <Text
                            style={{
                              color: m3.colorScheme.onPrimary,
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.medium,
                            }}
                          >
                            {t('warehouse.stockForm.title')}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
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
              {t('warehouse.search.found', { count: filteredWarehouseItems.length })}
            </Text>
          )}

          {/* Filter Tabs */}
          <View
            style={{
              flexDirection: 'row',
              borderRadius: borderRadius.xl,
              padding: spacing[1],
              marginBottom: spacing[4],
              backgroundColor: colors.surface[200],
            }}
          >
            {(['all', 'fertilizer', 'spray'] as WarehouseFilter[]).map((type) => (
              <Pressable
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
                    ? t('warehouse.filters.all', { count: warehouseTotals.count })
                    : type === 'fertilizer'
                      ? t('warehouse.filters.fertilizer', { count: warehouseTotals.fertilizers })
                      : t('warehouse.filters.spray', { count: warehouseTotals.sprays })}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Inventory List */}
          {filteredWarehouseItems.length === 0 ? (
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[8],
                alignItems: 'center',
                backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${colors.primary[500]}33`,
                }}
              >
                <Icon name="cube" size={32} color={colors.primary[500]} />
              </View>
              <Text
                style={{
                  color: colors.surface[900],
                  fontWeight: fontWeight.semibold,
                  marginTop: spacing[4],
                  textAlign: 'center',
                }}
              >
                {t('warehouse.empty.title')}
              </Text>
              <Text
                style={{
                  color: colors.surface[500],
                  fontSize: fontSize.sm,
                  marginTop: spacing[1],
                  textAlign: 'center',
                }}
              >
                {t('warehouse.empty.subtitle')}
              </Text>
              <Pressable
                onPress={() => {
                  openWarehouseItem(null);
                }}
                style={{
                  marginTop: spacing[4],
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.primary[500],
                }}
              >
                <Icon name="plus.circle.fill" size={20} color={m3.colorScheme.onPrimary} />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontWeight: fontWeight.semibold,
                    marginLeft: spacing[2],
                  }}
                >
                  {t('warehouse.actions.addItem')}
                </Text>
              </Pressable>
            </View>
          ) : (
            filteredWarehouseItems.map((item) => {
              const isLowStock = item.reorder_quantity && item.quantity <= item.reorder_quantity;
              const itemValue = item.quantity * item.unit_price;
              const itemColor =
                item.type === 'fertilizer' ? colors.secondary[500] : colors.primary[500];

              return (
                <View
                  key={item.id}
                  style={{
                    borderRadius: borderRadius['2xl'],
                    padding: spacing[4],
                    marginBottom: spacing[3],
                    backgroundColor: isLowStock
                      ? colorWithOpacity(colors.warning, 0.08)
                      : colorWithOpacity(colors.surface[100], 0.85),
                    borderColor: isLowStock ? colorWithOpacity(colors.warning, 0.3) : 'transparent',
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
                                ? `${colors.secondary[500]}33`
                                : `${colors.primary[500]}33`,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon
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
                              {item.type === 'fertilizer'
                                ? t('warehouse.itemTypes.fertilizer')
                                : t('warehouse.itemTypes.spray')}
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
                              backgroundColor: colorWithOpacity(colors.warning, 0.2),
                            }}
                          >
                            <Text
                              style={{
                                color: colors.warning,
                                fontSize: fontSize.xs,
                                fontWeight: fontWeight.medium,
                              }}
                            >
                              {t('common.labels.low')}
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                          <Pressable
                            onPress={() => handleEditWarehouseItem(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.a11y.editWithName', { name: item.name })}
                          >
                            <Icon name="pencil" size={20} color={m3.colorScheme.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteWarehouseItem(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={t('common.a11y.deleteWithName', {
                              name: item.name,
                            })}
                          >
                            <Icon name="trash" size={20} color={m3.colorScheme.error} />
                          </Pressable>
                        </View>
                      </View>
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.base,
                          fontWeight: fontWeight.semibold,
                          marginTop: spacing[2],
                          flexShrink: 1,
                        }}
                        numberOfLines={2}
                        accessibilityLabel={item.name}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        {t('common.labels.quantity')}
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
                        {t('common.labels.unitPrice')}
                      </Text>
                      <Text
                        style={{
                          color: colors.surface[900],
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                        }}
                      >
                        {formatCurrency(item.unit_price, currency)}/{item.unit}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        {t('common.labels.totalValue')}
                      </Text>
                      <Text
                        style={{
                          color: colors.primary[500],
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.semibold,
                        }}
                      >
                        {formatCurrency(itemValue, currency)}
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
        <Pressable
          onPress={() => {
            openWarehouseItem(null);
          }}
          style={{
            position: 'absolute',
            bottom: fabBottom,
            right: spacing[6],
            width: 56,
            height: 56,
            borderRadius: borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary[500],
          }}
        >
          <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
        </Pressable>
      </>
    );
  };

  // Get dynamic search placeholder
  const searchPlaceholder = useMemo(() => {
    switch (selectedTab) {
      case 'farms':
        return t('farms.search.placeholder');
      case 'warehouse':
        return t('warehouse.search.placeholder');
      default:
        return t('common.search');
    }
  }, [selectedTab, t]);

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
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
          <Icon
            name="magnifyingglass"
            size={20}
            color={
              isSearchFocused
                ? m3.colorScheme.primary
                : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
            }
          />
          <TextInput
            style={{
              flex: 1,
              marginLeft: spacing[3],
              fontSize: fontSize.base,
              color: m3.colorScheme.onSurface,
            }}
            placeholder={searchPlaceholder}
            placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="xmark.circle.fill"
                size={20}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Animated Sticky Header with Tabs */}
      <Animated.View
        style={{
          height: headerHeight,
          backgroundColor: colors.surface[100],
          ...shadows.sm,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing[4] }}>
          {exploreTabs.map((tab) => {
            const isSelected = selectedTab === tab.id;
            return (
              <Animated.View
                key={tab.id}
                style={{
                  flex: 1,
                  minWidth: 0,
                  transform: [{ scale: tabScaleAnims[tab.id] }],
                }}
              >
                <Pressable
                  onPress={() => handleTabChange(tab.id)}
                  style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
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
                        borderRadius: borderRadius.full,
                        borderCurve: 'continuous',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected
                          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                          : 'transparent',
                      }}
                    >
                      <Icon
                        name={tab.icon}
                        size={24}
                        color={
                          isSelected
                            ? m3.colorScheme.primary
                            : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                        }
                      />
                    </View>
                  </Animated.View>

                  <Animated.Text
                    numberOfLines={isAndroid ? 2 : 1}
                    ellipsizeMode={isAndroid ? 'clip' : 'tail'}
                    style={{
                      width: '100%',
                      flexShrink: 1,
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: isSelected
                        ? m3.colorScheme.primary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.9),
                      marginTop: textMargin,
                      textAlign: 'center',
                      paddingHorizontal: spacing[2],
                      maxWidth: '100%',
                      ...(isAndroid
                        ? {
                            includeFontPadding: true,
                            // Prevent rare Devanagari glyph clipping at the bottom.
                            paddingBottom: 1,
                            // Prevent occasional right-edge glyph clipping due to pixel rounding.
                            paddingRight: spacing[2] + 1,
                          }
                        : null),
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
                        backgroundColor: m3.colorScheme.primary,
                      }}
                    />
                  )}
                </Pressable>
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
        {selectedTab === 'warehouse' && renderWarehouseTab()}
      </Animated.View>

      {/* Modals are now route-based */}
    </View>
  );
}
