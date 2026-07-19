import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, RefreshControl, TextInput, Alert, Animated } from 'react-native';
import { useRouter, useFocusEffect, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, radius, shadows, spacing } from '@/styles/theme';
import {
  useFarms,
  useWarehouseItems,
  useDeleteWarehouseItem,
  useFabBottomPosition,
  useCurrency,
} from '@/hooks';
import { useModalStore, useAppModeStore } from '@/stores';
import { telemetry } from '@/services/telemetry';
import type { Farm, WarehouseItem } from '@/types';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { GUIDED_TOUR_TARGET_IDS, GuidedTourTarget } from '@/features/guided-tour';
import { useGuidedTourStore } from '@/features/guided-tour/store';
import { FarmsPaneB, type FarmFilter } from '@/components/screens/farms-pane-b';
import { WarehousePaneB, type WarehouseFilter } from '@/components/screens/warehouse-pane-b';

type ExploreTab = 'farms' | 'warehouse';

export default function ExploreScreen() {
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const isScreenFocused = useIsFocused();
  // Simplified mode labels the Warehouse pane "Purchases"; Detailed keeps "Warehouse".
  const detailedMode = useAppModeStore((s) => s.detailedMode);
  const exploreTabs = useMemo(
    () =>
      [
        { id: 'farms' as const, label: t('tabs.farms'), icon: 'leaf.fill' },
        {
          id: 'warehouse' as const,
          label: detailedMode ? t('warehouse.title') : t('tabs.purchases'),
          icon: 'cube.fill',
        },
      ] as const,
    [t, detailedMode],
  );
  const { setAddWarehouseItem } = useModalStore();
  const insets = useSafeAreaInsets();
  const fabBottom = useFabBottomPosition();
  const [selectedTab, setSelectedTab] = useState<ExploreTab>('farms');
  const guidedTourStatus = useGuidedTourStore((s) => s.status);
  const guidedTourStep = useGuidedTourStore((s) => s.currentStep);
  const isAddFarmTargetEnabled = isScreenFocused && selectedTab === 'farms';

  const tabSwitchAnim = useMemo(() => new Animated.Value(1), []);
  const tabScaleAnims = useMemo(
    () => ({
      farms: new Animated.Value(1),
      warehouse: new Animated.Value(1),
    }),
    [],
  );

  // Global search state — collapsed by default; tap the search icon to expand.
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    if (
      guidedTourStatus === 'in_progress' &&
      guidedTourStep === 'add_farm' &&
      selectedTab !== 'farms'
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedTab('farms');
      setSearchQuery('');
      setIsSearchExpanded(false);
    }
  }, [guidedTourStatus, guidedTourStep, selectedTab]);

  // Farms state & hooks
  const {
    data: farms,
    isLoading: farmsLoading,
    refetch: refetchFarms,
    isRefetching: farmsRefetching,
  } = useFarms();

  // Warehouse state & hooks
  const {
    data: warehouseItems,
    isLoading: warehouseLoading,
    refetch: refetchWarehouse,
    isRefetching: warehouseRefetching,
  } = useWarehouseItems();
  const deleteItemMutation = useDeleteWarehouseItem();
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseFilter>('all');
  const [farmFilter, setFarmFilter] = useState<FarmFilter>('all');

  const currency = useCurrency();

  const openWarehouseItem = (item?: WarehouseItem | null) => {
    setAddWarehouseItem({ editingItem: item ?? null });
    router.push('/add-warehouse-item');
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
        // Reset search on tab switch
        setSearchQuery('');
        setIsSearchExpanded(false);
        // Fade in new content
        Animated.timing(tabSwitchAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    },
    [selectedTab, tabSwitchAnim, tabScaleAnims],
  );

  // ============================================================
  // FARMS TAB LOGIC
  // ============================================================

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setIsSearchExpanded((prev) => {
      // Collapsing: clear any active query so we don't filter invisibly.
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
      telemetry.capture('farms_tab_opened', {
        app_mode: detailedMode ? 'detailed' : 'simplified',
        surface: 'farms',
      });
      return () => {
        setSearchQuery('');
        setIsSearchExpanded(false);
      };
    }, [detailedMode]),
  );

  const handleFarmPress = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}`);
  };

  const handleAddFarm = () => {
    telemetry.capture('add_farm_tapped', {
      app_mode: detailedMode ? 'detailed' : 'simplified',
      surface: 'farms',
    });
    router.push('/farm/add');
  };

  const handleEditFarm = (farm: Farm) => {
    if (typeof farm.id !== 'number') return;
    router.push(`/farm/${farm.id}/edit`);
  };

  // ============================================================
  // WAREHOUSE TAB LOGIC
  // ============================================================

  // Low-stock count drives the amber badge on the inactive Warehouse tab.
  const lowStockCount = useMemo(() => {
    if (!warehouseItems) return 0;
    return warehouseItems.filter(
      (item) => typeof item.reorder_quantity === 'number' && item.quantity <= item.reorder_quantity,
    ).length;
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

  const handleEditWarehouseItem = (item: WarehouseItem) => {
    openWarehouseItem(item);
  };

  // ============================================================
  // RENDER FUNCTIONS
  // ============================================================

  const renderFarmsTab = () => (
    <View style={{ flex: 1 }}>
      <FarmsPaneB
        farms={farms}
        isLoading={farmsLoading}
        today={today}
        searchQuery={searchQuery}
        activeFilter={farmFilter}
        onFilterChange={setFarmFilter}
        onAddFarm={handleAddFarm}
        onFarmPress={handleFarmPress}
        onEditFarm={handleEditFarm}
        addFarmTargetEnabled={isAddFarmTargetEnabled}
        listBottomPadding={Math.max(spacing[16], fabBottom + 56 + spacing[8])}
        refreshControl={
          <RefreshControl
            refreshing={farmsRefetching && !searchQuery}
            onRefresh={refetchFarms}
            tintColor={m3.colorScheme.primary}
          />
        }
      />
      {(farms?.length || 0) > 0 && (
        <GuidedTourTarget
          targetId={GUIDED_TOUR_TARGET_IDS.ADD_FARM_PRIMARY}
          enabled={isAddFarmTargetEnabled}
          style={{
            position: 'absolute',
            bottom: fabBottom,
            right: spacing[6],
            width: 56,
            height: 56,
          }}
        >
          <Pressable
            onPress={handleAddFarm}
            accessibilityRole="button"
            accessibilityLabel={t('farms.addFarm')}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: m3.primary.p500,
            }}
          >
            <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
          </Pressable>
        </GuidedTourTarget>
      )}
    </View>
  );

  const renderWarehouseTab = () => (
    <View style={{ flex: 1 }}>
      <WarehousePaneB
        items={warehouseItems}
        isLoading={warehouseLoading}
        searchQuery={searchQuery}
        activeFilter={warehouseFilter}
        currency={currency}
        onFilterChange={setWarehouseFilter}
        onAddItem={() => openWarehouseItem(null)}
        onItemPress={handleEditWarehouseItem}
        onItemLongPress={handleDeleteWarehouseItem}
        listBottomPadding={Math.max(spacing[16], fabBottom + 56 + spacing[8])}
        refreshControl={
          <RefreshControl
            refreshing={warehouseRefetching}
            onRefresh={refetchWarehouse}
            tintColor={m3.colorScheme.primary}
          />
        }
      />
      <Pressable
        onPress={() => openWarehouseItem(null)}
        accessibilityRole="button"
        accessibilityLabel={t('warehouse.actions.addProduct')}
        style={{
          position: 'absolute',
          bottom: fabBottom,
          right: spacing[6],
          minWidth: 148,
          height: 56,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing[5],
          flexDirection: 'row',
          gap: spacing[2],
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: m3.primary.p500,
        }}
      >
        <Icon name="plus" size={20} color={m3.colorScheme.onPrimary} />
        <Text
          style={{
            color: m3.colorScheme.onPrimary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
          }}
        >
          {t('warehouse.actions.addProduct')}
        </Text>
      </Pressable>
    </View>
  );

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
      {/* Compact header — segmented toggle + search icon on a single row.
          Toggle ~32px tall, search icon button 32px. Search field expands inline
          below the row only when the icon is tapped. Spec: explore-toggle-B-v2-compact. */}
      <View
        style={{
          backgroundColor: m3.surface.s100,
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
          ...shadows.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          {/* Segmented pill toggle — Farms | Purchases in both modes. */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: m3.surface.s50,
              borderRadius: radius.lg,
              padding: 2,
              height: 36,
            }}
          >
            {exploreTabs.map((tab) => {
              const isSelected = selectedTab === tab.id;
              return (
                <Animated.View
                  key={tab.id}
                  style={{
                    flex: 1,
                    transform: [{ scale: tabScaleAnims[tab.id] }],
                  }}
                >
                  <Pressable
                    onPress={() => handleTabChange(tab.id)}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected: isSelected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: radius.lg,
                      height: 32,
                      paddingHorizontal: spacing[2],
                      backgroundColor: isSelected ? m3.colorScheme.primary : 'transparent',
                    }}
                  >
                    <Icon
                      name={tab.icon}
                      size={14}
                      color={
                        isSelected
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.85)
                      }
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: isSelected
                          ? m3.colorScheme.onPrimary
                          : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.95),
                      }}
                    >
                      {tab.label}
                    </Text>
                    {tab.id === 'warehouse' && lowStockCount > 0 && !isSelected ? (
                      <View
                        style={{
                          minWidth: 16,
                          height: 16,
                          paddingHorizontal: 4,
                          borderRadius: radius.sm,
                          backgroundColor: '#D97706',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: fontSize['2xs'],
                            fontWeight: fontWeight.bold,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {lowStockCount > 99 ? '99+' : lowStockCount}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* Search icon button */}
          <Pressable
            onPress={handleSearchToggle}
            accessibilityRole="button"
            accessibilityLabel={searchPlaceholder}
            accessibilityState={{ expanded: isSearchExpanded }}
            hitSlop={6}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSearchExpanded
                ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                : m3.surface.s50,
            }}
          >
            <Icon
              name={isSearchExpanded ? 'xmark' : 'magnifyingglass'}
              size={16}
              color={
                isSearchExpanded
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.85)
              }
            />
          </Pressable>
        </View>

        {/* Expandable search field (only mounted when expanded so the closed
            state stays at one row). */}
        {isSearchExpanded ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: m3.surface.s50,
              borderRadius: borderRadius.xl,
              paddingHorizontal: spacing[3],
              height: 36,
              marginTop: spacing[2],
            }}
          >
            <Icon
              name="magnifyingglass"
              size={16}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
            <TextInput
              autoFocus
              style={{
                flex: 1,
                marginLeft: spacing[2],
                fontSize: fontSize.sm,
                color: m3.colorScheme.onSurface,
                paddingVertical: 0,
              }}
              placeholder={searchPlaceholder}
              placeholderTextColor={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              accessibilityRole="search"
              accessibilityLabel={searchPlaceholder}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => handleSearchChange('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.clearSearch')}
              >
                <Icon
                  name="xmark.circle.fill"
                  size={16}
                  color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

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
