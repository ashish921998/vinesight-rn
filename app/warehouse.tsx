import React, { useState, useMemo } from 'react';
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
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';

type FilterType = 'all' | 'fertilizer' | 'spray';

export default function WarehouseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  const glassSurface = colorWithOpacity(colors.surface[100], 0.85);
  const lowStockColor = colors.warning;
  const fertilizerColor = m3.colorScheme.tertiary;
  const sprayColor = m3.colorScheme.primary;

  const router = useRouter();
  const { setAddWarehouseItem, setAddStock } = useModalStore();
  const { data: items, isLoading, refetch, isRefetching } = useWarehouseItems();
  const deleteItemMutation = useDeleteWarehouseItem();

  const [filter, setFilter] = useState<FilterType>('all');

  const currency = useCurrency();

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
    return items.filter((item) => item.type === filter);
  }, [items, filter]);

  // Low stock items
  const lowStockItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => item.reorder_quantity && item.quantity <= item.reorder_quantity);
  }, [items]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!items) return { count: 0, value: 0, fertilizers: 0, sprays: 0 };
    return {
      count: items.length,
      value: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      fertilizers: items.filter((item) => item.type === 'fertilizer').length,
      sprays: items.filter((item) => item.type === 'spray').length,
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

  const handleAddStock = (item: WarehouseItem) => {
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
              style={{ marginRight: spacing[4] }}
            >
              <Icon name="plus.circle.fill" size={28} color={m3.colorScheme.primary} />
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
          {/* Summary Cards */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing[4],
              marginBottom: spacing[4],
              gap: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                backgroundColor: glassSurface,
              }}
            >
              <Icon
                name="exclamationmark.triangle.fill"
                size={24}
                color={lowStockItems.length > 0 ? lowStockColor : m3.colorScheme.primary}
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
                backgroundColor: glassSurface,
              }}
            >
              <Icon
                name={resolveSymbolIconName(ICON_REGISTRY.expense)}
                size={24}
                color={m3.colorScheme.primary}
              />
              <Text
                style={{
                  color: colors.surface[900],
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  marginTop: spacing[2],
                }}
              >
                {formatCurrency(totals.value, currency)}
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
                backgroundColor: colorWithOpacity(lowStockColor, 0.08),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: spacing[3],
                }}
              >
                <Icon name="exclamationmark.triangle.fill" size={20} color={lowStockColor} />
                <Text
                  style={{
                    color: lowStockColor,
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
                    backgroundColor: colorWithOpacity(lowStockColor, 0.18),
                  }}
                >
                  <Text
                    style={{
                      color: lowStockColor,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {t('warehouse.labels.itemCount', { count: lowStockItems.length })}
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
                          backgroundColor: glassSurface,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Icon
                            name={resolveSymbolIconName(
                              item.type === 'fertilizer'
                                ? ICON_REGISTRY.fertigation
                                : ICON_REGISTRY.spray,
                            )}
                            size={16}
                            color={lowStockColor}
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

          {/* Filter Tabs - Segmented style */}
          <View
            style={{
              flexDirection: 'row',
              borderRadius: borderRadius.xl,
              padding: spacing[1],
              marginBottom: spacing[4],
              backgroundColor: colorWithOpacity(m3.colorScheme.onSurface, 0.08),
            }}
          >
            {(['all', 'fertilizer', 'spray'] as FilterType[]).map((type) => (
              <Pressable
                key={type}
                onPress={() => setFilter(type)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: borderRadius.lg,
                  backgroundColor:
                    filter === type ? colorWithOpacity(colors.surface[100], 0.9) : 'transparent',
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: filter === type ? colors.surface[900] : colors.surface[600],
                  }}
                >
                  {type === 'all'
                    ? t('warehouse.filters.all', { count: totals.count })
                    : type === 'fertilizer'
                      ? t('warehouse.filters.fertilizer', { count: totals.fertilizers })
                      : t('warehouse.filters.spray', { count: totals.sprays })}
                </Text>
              </Pressable>
            ))}
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
              const itemValue = item.quantity * item.unit_price;
              const itemColor = item.type === 'fertilizer' ? fertilizerColor : sprayColor;

              return (
                <View
                  key={item.id}
                  style={{
                    borderRadius: borderRadius['2xl'],
                    padding: spacing[4],
                    marginBottom: spacing[3],
                    backgroundColor: isLowStock
                      ? colorWithOpacity(lowStockColor, 0.08)
                      : glassSurface,
                    borderColor: isLowStock ? colorWithOpacity(lowStockColor, 0.3) : 'transparent',
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
                                ? colorWithOpacity(fertilizerColor, 0.2)
                                : colorWithOpacity(sprayColor, 0.2),
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Icon
                              name={resolveSymbolIconName(
                                item.type === 'fertilizer'
                                  ? ICON_REGISTRY.fertigation
                                  : ICON_REGISTRY.spray,
                              )}
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
                              backgroundColor: colorWithOpacity(lowStockColor, 0.2),
                            }}
                          >
                            <Text style={{ color: lowStockColor }}>{t('common.labels.low')}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: spacing[2], marginLeft: 'auto' }}>
                          <Pressable
                            onPress={() => handleEditItem(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon name="pencil" size={20} color={m3.colorScheme.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDeleteItem(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                        }}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing[3] }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.surface[500], fontSize: fontSize.xs }}>
                        {t('warehouse.labels.quantity')}
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
                        {t('warehouse.labels.unitPrice')}
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
                        {t('warehouse.labels.totalValue')}
                      </Text>
                      <Text
                        style={{
                          color: m3.colorScheme.primary,
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
        </ScrollView>
      </View>

      {/* FAB */}
      <Pressable
        onPress={() => {
          openAddItem(null);
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
          backgroundColor: m3.colorScheme.primary,
        }}
      >
        <Icon name="plus" size={28} color={m3.colorScheme.onPrimary} />
      </Pressable>

      {/* Modals */}
      {/* Warehouse modals are now route-based */}
    </View>
  );
}
