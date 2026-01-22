import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWarehouseItems, useProfile } from '../src/hooks';
import { WarehouseItem } from '../src/types';
import AddWarehouseItemModal from '../src/components/screens/AddWarehouseItemModal';
import AddStockModal from '../src/components/screens/AddStockModal';

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
  const { data: profile } = useProfile();
  const { data: items, isLoading, refetch, isRefetching } = useWarehouseItems();

  const [filter, setFilter] = useState<FilterType>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [stockItem, setStockItem] = useState<WarehouseItem | null>(null);

  const currency = profile?.preferred_currency || 'INR';

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
            deleteItemMutation.mutate(item.id);
          }
        },
      },
    ]);
  };

  const handleAddStock = (item: WarehouseItem) => {
    setStockItem(item);
    setShowStockModal(true);
  };

  const handleEditItem = (item: WarehouseItem) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        edges={['top']}
      >
        <Stack.Screen options={{ title: 'Warehouse' }} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="text-surface-600 mt-4">Loading inventory...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.background }}>
      <Stack.Screen
        options={{
          title: 'Warehouse',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="mr-4"
            >
              <Ionicons name="add-circle" size={28} color="#408059" />
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
          <View className="flex-row mb-4" style={{ gap: 12 }}>
            <View
              className="flex-1 rounded-2xl p-4"
              style={{
                backgroundColor: COLORS.glass,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
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
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
              }}
            >
              <Ionicons name="cash" size={24} color={COLORS.primary} />
              <Text className="text-2xl font-bold text-surface-900 mt-2">
                {currency === 'INR' ? '₹' : '$'}
                {totals.value.toLocaleString()}
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
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
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
                        <View className="mt-2 py-1.5 px-3 rounded-full items-center self-start">
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: 'white',
                              backgroundColor: COLORS.primary,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 999,
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

          {/* Filter Tabs - Segmented style */}
          <View
            className="flex-row rounded-xl p-1 mb-4"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
            }}
          >
            {(['all', 'fertilizer', 'spray'] as FilterType[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilter(type)}
                className={`flex-1 py-2.5 rounded-lg ${filter === type ? 'bg-white' : ''}`}
                style={
                  filter === type
                    ? {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                      }
                    : {}
                }
              >
                <Text
                  className={`text-center text-sm font-medium ${
                    filter === type ? 'text-surface-900' : 'text-surface-600'
                  }`}
                >
                  {type === 'all'
                    ? `ALL (${totals.count})`
                    : type === 'fertilizer'
                      ? `FERTILIZERS (${totals.fertilizers})`
                      : `SPRAYS (${totals.sprays})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inventory List */}
          {filteredItems.length === 0 ? (
            <View
              className="rounded-2xl p-8 items-center"
              style={{
                backgroundColor: COLORS.glass,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
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
                  setEditingItem(null);
                  setShowAddModal(true);
                }}
                className="mt-4 px-6 py-3 rounded-xl flex-row items-center"
                style={{ backgroundColor: COLORS.primary }}
              >
                <Ionicons name="add-circle" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Add Item</Text>
              </TouchableOpacity>
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
                  className="rounded-2xl p-4 mb-3"
                  style={{
                    backgroundColor: isLowStock ? `${COLORS.lowStock}0D` : COLORS.glass,
                    borderColor: isLowStock ? `${COLORS.lowStock}4D` : 'transparent',
                    borderWidth: isLowStock ? 1 : 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
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
        </ScrollView>
      </SafeAreaView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => {
          setEditingItem(null);
          setShowAddModal(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center"
        style={{
          backgroundColor: COLORS.primary,
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modals */}
      <AddWarehouseItemModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        editingItem={editingItem}
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
