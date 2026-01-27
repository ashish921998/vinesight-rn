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

import { Symbol } from '@/components/ui/Symbol';
import { useWarehouseItems, useProfile, useDeleteWarehouseItem } from '../src/hooks';
import { WarehouseItem } from '../src/types';
import { useModalStore } from '@/stores';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

type FilterType = 'all' | 'fertilizer' | 'spray';

const COLORS = {
  primary: '#408059',
  background: '#f2f2f7',
  glass: 'rgba(255, 255, 255, 0.8)',
  lowStock: '#D9731F',
  warehouseFertilizer: '#598C6B',
  warehouseSpray: '#408059',
};

export default function WarehouseScreen() {
  const router = useRouter();
  const { setAddWarehouseItem, setAddStock } = useModalStore();
  const { data: profile } = useProfile();
  const { data: items, isLoading, refetch, isRefetching } = useWarehouseItems();
  const deleteItemMutation = useDeleteWarehouseItem();

  const [filter, setFilter] = useState<FilterType>('all');

  const currency = profile?.preferred_currency || 'INR';

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
          backgroundColor: COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Stack.Screen options={{ title: 'Warehouse' }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          Loading inventory...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Stack.Screen
        options={{
          title: 'Warehouse',
          headerRight: () => (
            <Pressable
              onPress={() => {
                openAddItem(null);
              }}
              style={{ marginRight: spacing[4] }}
            >
              <Symbol name="plus.circle.fill" size={28} color="#408059" />
            </Pressable>
          ),
        }}
      />

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', marginBottom: spacing[4], gap: 12 }}>
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
                {totals.value.toLocaleString()}
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
                    <Pressable
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
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
                  backgroundColor: filter === type ? colors.surface[100] : 'transparent',
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
                    ? `ALL (${totals.count})`
                    : type === 'fertilizer'
                      ? `FERTILIZERS (${totals.fertilizers})`
                      : `SPRAYS (${totals.sprays})`}
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
              </Pressable>
            </View>
          ) : (
            filteredItems.map((item) => {
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
                            <Text style={{ color: COLORS.lowStock }}>Low</Text>
                          </View>
                        )}
                        <Pressable
                          onPress={() => {
                            Alert.alert('Actions', `${item.name}`, [
                              {
                                text: 'Add Stock',
                                onPress: () => handleAddStock(item),
                              },
                              {
                                text: 'Edit',
                                onPress: () => handleEditItem(item),
                              },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => handleDeleteItem(item),
                              },
                              { text: 'Cancel', style: 'cancel' },
                            ]);
                          }}
                        >
                          <Symbol name="ellipsis.circle.fill" size={24} color="#6B7280" />
                        </Pressable>
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
          backgroundColor: COLORS.primary,
        }}
      >
        <Symbol name="plus" size={28} color="white" />
      </Pressable>

      {/* Modals */}
      {/* Warehouse modals are now route-based */}
    </View>
  );
}
