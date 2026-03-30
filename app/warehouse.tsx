import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Symbol as Icon } from '@/components/ui/symbol';
import { useWarehouseItems, useDeleteWarehouseItem } from '../src/hooks';
import { WarehouseItem } from '../src/types';
import { useModalStore } from '@/stores';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors, useIsDark } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
// import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { useNotificationStore } from '@/stores';
import { notifyWarehouseReorder } from '@/services/notifications';

type FilterType = 'all' | 'fertilizer' | 'spray' | 'equipment';

// Category colors for warehouse items
const CATEGORY_COLORS = {
  spray: { light: '#355847', dark: '#4A8B6B' },
  fertilizer: { light: '#56704E', dark: '#6A8A5E' },
  equipment: { light: '#3F6E78', dark: '#5A8B96' },
};

export default function WarehouseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  const glassSurface = colorWithOpacity(colors.surface[100], 0.85);
  const _lowStockColor = colors.warning;
  const _fertilizerColor = m3.colorScheme.tertiary;
  const _sprayColor = m3.colorScheme.primary;

  const router = useRouter();
  const { setAddWarehouseItem, setAddStock } = useModalStore();
  const { data: items, isLoading, refetch, isRefetching } = useWarehouseItems();
  const deleteItemMutation = useDeleteWarehouseItem();

  const isDark = useIsDark();
  const [filter, setFilter] = useState<FilterType>('all');

  // Get category colors based on theme
  const getCategoryColors = (type: string) => {
    const colors = CATEGORY_COLORS[type as keyof typeof CATEGORY_COLORS];
    if (colors) {
      return isDark ? colors.dark : colors.light;
    }
    return m3.colorScheme.primary;
  };

  const currency = useCurrency();
  const warehouseReorderAlertsEnabled = useNotificationStore(
    (s) => s.warehouseReorderAlertsEnabled,
  );
  const addNotifiedWarehouseItemId = useNotificationStore((s) => s.addNotifiedWarehouseItemId);
  const removeNotifiedWarehouseItemId = useNotificationStore(
    (s) => s.removeNotifiedWarehouseItemId,
  );

  useEffect(() => {
    (async () => {
      if (!warehouseReorderAlertsEnabled || !items || items.length === 0) return;

      const lowStockToNotify = items.filter(
        (item) =>
          item.reorder_quantity &&
          item.quantity <= item.reorder_quantity &&
          item.id != null &&
          !useNotificationStore.getState().notifiedWarehouseItemIds.has(item.id),
      );

      for (const item of lowStockToNotify) {
        try {
          await notifyWarehouseReorder(item.name, item.quantity, item.unit, item.reorder_quantity!);
          addNotifiedWarehouseItemId(item.id!);
        } catch {
          // Notification failed, silently continue
        }
      }

      items.forEach((item) => {
        if (
          item.id != null &&
          item.reorder_quantity &&
          item.quantity > item.reorder_quantity &&
          useNotificationStore.getState().notifiedWarehouseItemIds.has(item.id)
        ) {
          removeNotifiedWarehouseItemId(item.id);
        }
      });
    })();
  }, [
    warehouseReorderAlertsEnabled,
    items,
    addNotifiedWarehouseItemId,
    removeNotifiedWarehouseItemId,
  ]);

  const openAddItem = (item?: WarehouseItem | null) => {
    setAddWarehouseItem({ editingItem: item ?? null });
    router.push('/add-warehouse-item');
  };

  const openAddStock = (item: WarehouseItem) => {
    setAddStock({ item });
    router.push('/add-stock');
  };

  // Filter items
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (filter === 'all') return items;
    if (filter === 'equipment') {
      return items.filter((item) => item.type === 'equipment');
    }
    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => item.reorder_quantity && item.quantity <= item.reorder_quantity);
  }, [items]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!items) return { count: 0, value: 0, fertilizers: 0, sprays: 0, equipment: 0 };
    return {
      count: items.length,
      value: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      fertilizers: items.filter((item) => item.type === 'fertilizer').length,
      sprays: items.filter((item) => item.type === 'spray').length,
      equipment: items.filter((item) => item.type === 'equipment').length,
    };
  }, [items]);

  const handleDeleteItem = (item: WarehouseItem) => {
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

  const _handleAddStock = (item: WarehouseItem) => {
    openAddStock(item);
  };

  const handleEditItem = (item: WarehouseItem) => {
    openAddItem(item);
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: m3.colorScheme.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Stack.Screen options={{ title: t('warehouse.title') }} />
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          {t('warehouse.loading.inventory')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <Stack.Screen
        options={{
          title: t('warehouse.title'),
          headerRight: () => (
            <Pressable
              onPress={() => {
                openAddItem(null);
              }}
              style={{
                marginRight: spacing[4],
                height: 40,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: m3.colorScheme.primary,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="plus" size={16} color={m3.colorScheme.onPrimary} />
              <Text
                style={{
                  color: m3.colorScheme.onPrimary,
                  fontSize: 14,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t('warehouse.actions.addItem')}
              </Text>
            </Pressable>
          ),
        }}
      />

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: spacing[4],
            paddingHorizontal: 16,
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={m3.colorScheme.primary}
            />
          }
        >
          {/* Filter Tabs - Horizontal pills */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginBottom: spacing[4],
            }}
          >
            {(['all', 'spray', 'fertilizer', 'equipment'] as FilterType[]).map((type) => {
              const isActive = filter === type;
              const count =
                type === 'all'
                  ? totals.count
                  : type === 'spray'
                    ? totals.sprays
                    : type === 'fertilizer'
                      ? totals.fertilizers
                      : totals.equipment;
              return (
                <Pressable
                  key={type}
                  onPress={() => setFilter(type)}
                  style={{
                    height: 34,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isActive ? m3.colorScheme.primary : colors.surface[300],
                    backgroundColor: isActive ? m3.colorScheme.primary : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: fontWeight.medium,
                      color: isActive ? m3.colorScheme.onPrimary : colors.surface[500],
                    }}
                  >
                    {type === 'all'
                      ? t('warehouse.filters.all', { count })
                      : type === 'spray'
                        ? t('warehouse.filters.spray', { count })
                        : type === 'fertilizer'
                          ? t('warehouse.filters.fertilizer', { count })
                          : t('warehouse.filters.equipment', { count })}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isActive
                        ? colorWithOpacity(m3.colorScheme.onPrimary, 0.7)
                        : colors.surface[400],
                    }}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Summary Strip */}
          <View
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: glassSurface,
              borderWidth: 1,
              borderColor: colors.surface[300],
              borderRadius: 12,
              marginBottom: spacing[4],
              flexDirection: 'row',
            }}
          >
            <Text
              style={{ fontSize: 13, color: colors.surface[500], fontWeight: fontWeight.medium }}
            >
              {t('warehouse.labels.itemsCount', { count: totals.count })}
            </Text>
            <View
              style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.surface[400] }}
            />
            <Text style={{ fontSize: 13, color: colors.warning, fontWeight: fontWeight.semibold }}>
              {t('warehouse.labels.lowStockCount', { count: lowStockItems.length })}
            </Text>
            <View
              style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.surface[400] }}
            />
            <Text
              style={{ fontSize: 13, color: colors.surface[500], fontWeight: fontWeight.medium }}
            >
              {t('warehouse.labels.totalValue', { value: formatCurrency(totals.value, currency) })}
            </Text>
          </View>

          {/* Inventory List */}
          {filteredItems.length === 0 ? (
            <View
              style={{
                borderRadius: borderRadius['2xl'],
                padding: spacing[8],
                alignItems: 'center',
                backgroundColor: glassSurface,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.2),
                }}
              >
                <Icon name="cube" size={32} color={m3.colorScheme.primary} />
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
                  openAddItem(null);
                }}
                style={{
                  marginTop: spacing[4],
                  paddingHorizontal: spacing[6],
                  paddingVertical: spacing[3],
                  borderRadius: borderRadius.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: m3.colorScheme.primary,
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
            filteredItems.map((item) => {
              const isLowStock = item.reorder_quantity && item.quantity <= item.reorder_quantity;
              const _itemValue = item.quantity * item.unit_price;
              const itemColor = getCategoryColors(item.type || 'spray');
              const itemAccessibilityName = item.name || item.id?.toString() || 'item';

              // Calculate stock percentage for the bar (reorder_quantity * 2 is full stock, reorder_quantity is 50%)
              const stockPercentage = item.reorder_quantity
                ? Math.min(100, Math.round((item.quantity / (item.reorder_quantity * 2)) * 100))
                : 100;

              // Determine stock bar color based on percentage
              const getStockBarColor = () => {
                if (stockPercentage <= 30) return colors.warning as string; // low - amber
                if (stockPercentage <= 60) return colors.accent[500]; // mid - gold
                return colors.success as string; // ok - green
              };

              const stockBarColor = getStockBarColor();

              return (
                <View
                  key={item.id}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: glassSurface,
                    borderWidth: 1,
                    borderColor: isLowStock ? colors.warning : colors.surface[300],
                  }}
                >
                  {/* Card Top: Name and Badge */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: fontWeight.semibold,
                        color: colors.surface[400],
                        lineHeight: 20,
                        flex: 1,
                      }}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={{
                        height: 24,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor:
                          item.type === 'spray'
                            ? colorWithOpacity(getCategoryColors('spray'), 0.08)
                            : item.type === 'fertilizer'
                              ? colorWithOpacity(getCategoryColors('fertilizer'), 0.1)
                              : colorWithOpacity(getCategoryColors('equipment'), 0.08),
                        borderWidth: 1,
                        borderColor:
                          item.type === 'spray'
                            ? colorWithOpacity(getCategoryColors('spray'), 0.18)
                            : item.type === 'fertilizer'
                              ? colorWithOpacity(getCategoryColors('fertilizer'), 0.2)
                              : colorWithOpacity(getCategoryColors('equipment'), 0.18),
                        flexShrink: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: fontWeight.semibold,
                          color: itemColor,
                        }}
                      >
                        {item.type === 'spray'
                          ? t('warehouse.itemTypes.spray')
                          : item.type === 'fertilizer'
                            ? t('warehouse.itemTypes.fertilizer')
                            : t('warehouse.itemTypes.equipment')}
                      </Text>
                    </View>
                  </View>

                  {/* Card Body: Quantity and Stock Bar */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: fontWeight.bold,
                          color: colors.surface[400],
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {item.quantity}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: fontWeight.medium,
                          color: colors.surface[500],
                        }}
                      >
                        {item.unit}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Stock Bar */}
                      <View
                        style={{
                          width: 56,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isDark ? '#242A24' : '#EEE7DD',
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(stockPercentage, 100)}%`,
                            height: '100%',
                            borderRadius: 3,
                            backgroundColor: stockBarColor,
                          }}
                        />
                      </View>
                      {/* Low Stock Badge */}
                      {isLowStock && (
                        <View
                          style={{
                            height: 22,
                            paddingHorizontal: 8,
                            borderRadius: 999,
                            backgroundColor: colorWithOpacity(colors.warning, 0.12),
                            borderWidth: 1,
                            borderColor: colorWithOpacity(colors.warning, 0.25),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: fontWeight.semibold,
                              color: colors.warning,
                            }}
                          >
                            {t('common.labels.lowStock')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Card Meta: Date and Price */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: isDark ? '#242A24' : '#EEE7DD',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.surface[400],
                        fontWeight: fontWeight.normal,
                      }}
                    >
                      {item.updated_at
                        ? t('warehouse.labels.updatedDate', {
                            date: new Date(item.updated_at).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            }),
                          })
                        : ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.surface[500],
                        fontWeight: fontWeight.medium,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatCurrency(item.unit_price, currency)}/{item.unit}
                    </Text>
                  </View>

                  {/* Edit and Delete Actions */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      gap: spacing[2],
                      marginTop: spacing[3],
                    }}
                  >
                    <Pressable
                      onPress={() => handleEditItem(item)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t('common.a11y.editWithName', {
                        name: itemAccessibilityName,
                      })}
                      accessibilityHint={t('common.a11y.opensEditForm')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                      }}
                    >
                      <Icon name="pencil" size={17} color={m3.colorScheme.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteItem(item)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={t('common.a11y.deleteWithName', {
                        name: itemAccessibilityName,
                      })}
                      accessibilityHint={t('common.a11y.deletesThisItem')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: borderRadius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colorWithOpacity(m3.colorScheme.error, 0.1),
                      }}
                    >
                      <Icon name="trash" size={17} color={m3.colorScheme.error} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Modals */}
      {/* Warehouse modals are now route-based */}
    </View>
  );
}
