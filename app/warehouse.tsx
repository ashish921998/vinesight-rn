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
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useWarehouseItems,
  useDeleteWarehouseItem,
  useProfile,
} from '../src/hooks';
import { WarehouseItem } from '../src/types';
import AddWarehouseItemModal from '../src/components/screens/AddWarehouseItemModal';
import AddStockModal from '../src/components/screens/AddStockModal';

type FilterType = 'all' | 'fertilizer' | 'spray';

export default function WarehouseScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: items, isLoading, refetch, isRefetching } = useWarehouseItems();
  const deleteItemMutation = useDeleteWarehouseItem();

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
    return items.filter(
      (item) => item.reorder_quantity && item.quantity <= item.reorder_quantity
    );
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
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
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
      ]
    );
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
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Warehouse' }} />
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-600 mt-4">Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-50">
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#408059" />
        }
      >
        {/* Summary Cards */}
        <View className="flex-row mb-4" style={{ gap: 12 }}>
          <View className="flex-1 bg-white rounded-2xl p-4">
            <View className="w-10 h-10 rounded-xl bg-primary-100 items-center justify-center mb-2">
              <Ionicons name="cube" size={20} color="#408059" />
            </View>
            <Text className="text-2xl font-bold text-surface-900">{totals.count}</Text>
            <Text className="text-xs text-surface-500">Total Items</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4">
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mb-2">
              <Ionicons name="cash" size={20} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold text-surface-900">
              {currency === 'INR' ? '₹' : '$'}
              {totals.value.toLocaleString()}
            </Text>
            <Text className="text-xs text-surface-500">Total Value</Text>
          </View>
        </View>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <View className="bg-amber-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-lg bg-amber-100 items-center justify-center">
                <Ionicons name="warning" size={16} color="#F59E0B" />
              </View>
              <Text className="text-sm font-semibold text-amber-800 ml-2">
                Low Stock Alert
              </Text>
              <View className="bg-amber-200 px-2 py-0.5 rounded-full ml-auto">
                <Text className="text-xs font-medium text-amber-800">
                  {lowStockItems.length} items
                </Text>
              </View>
            </View>
            {lowStockItems.slice(0, 3).map((item) => (
              <View key={item.id} className="flex-row items-center mt-2">
                <Ionicons name="alert-circle" size={14} color="#D97706" />
                <Text className="text-sm text-amber-700 ml-2 flex-1" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-amber-600">
                  {item.quantity} {item.unit} left
                </Text>
              </View>
            ))}
            {lowStockItems.length > 3 && (
              <Text className="text-xs text-amber-600 mt-2">
                +{lowStockItems.length - 3} more items need restocking
              </Text>
            )}
          </View>
        )}

        {/* Filter Tabs */}
        <View className="flex-row bg-white rounded-xl p-1 mb-4">
          {(['all', 'fertilizer', 'spray'] as FilterType[]).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setFilter(type)}
              className={`flex-1 py-2 rounded-lg ${
                filter === type ? 'bg-primary-600' : ''
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  filter === type ? 'text-white' : 'text-surface-600'
                }`}
              >
                {type === 'all'
                  ? `All (${totals.count})`
                  : type === 'fertilizer'
                  ? `Fertilizers (${totals.fertilizers})`
                  : `Sprays (${totals.sprays})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inventory List */}
        {filteredItems.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center">
            <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
            <Text className="text-surface-600 mt-4 text-center">No items found</Text>
            <Text className="text-surface-500 text-sm mt-1 text-center">
              Add inventory items to track your stock
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="mt-4 bg-primary-600 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Add Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredItems.map((item) => {
            const isLowStock = item.reorder_quantity && item.quantity <= item.reorder_quantity;
            const itemValue = item.quantity * item.unit_price;

            return (
              <View
                key={item.id}
                className={`bg-white rounded-2xl p-4 mb-3 ${
                  isLowStock ? 'border-2 border-amber-300' : ''
                }`}
              >
                <View className="flex-row items-start">
                  <View
                    className={`w-12 h-12 rounded-xl items-center justify-center ${
                      item.type === 'fertilizer' ? 'bg-green-100' : 'bg-blue-100'
                    }`}
                  >
                    <Ionicons
                      name={item.type === 'fertilizer' ? 'flask' : 'water'}
                      size={24}
                      color={item.type === 'fertilizer' ? '#16A34A' : '#3B82F6'}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-base font-semibold text-surface-900 flex-1">
                        {item.name}
                      </Text>
                      {isLowStock && (
                        <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                          <Text className="text-xs font-medium text-amber-700">Low</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center mt-1">
                      <View
                        className={`px-2 py-0.5 rounded ${
                          item.type === 'fertilizer' ? 'bg-green-50' : 'bg-blue-50'
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            item.type === 'fertilizer' ? 'text-green-700' : 'text-blue-700'
                          }`}
                        >
                          {item.type}
                        </Text>
                      </View>
                      {item.notes && (
                        <Text className="text-xs text-surface-500 ml-2" numberOfLines={1}>
                          {item.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <View className="flex-row mt-3 pt-3 border-t border-surface-100">
                  <View className="flex-1">
                    <Text className="text-xs text-surface-500">Quantity</Text>
                    <Text className="text-sm font-semibold text-surface-900">
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-surface-500">Unit Price</Text>
                    <Text className="text-sm font-semibold text-surface-900">
                      {currency === 'INR' ? '₹' : '$'}
                      {item.unit_price.toLocaleString()}/{item.unit}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-surface-500">Value</Text>
                    <Text className="text-sm font-semibold text-primary-700">
                      {currency === 'INR' ? '₹' : '$'}
                      {itemValue.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-3 pt-3 border-t border-surface-100" style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleAddStock(item)}
                    className="flex-1 flex-row items-center justify-center bg-primary-50 py-2 rounded-xl"
                  >
                    <Ionicons name="add-circle" size={16} color="#408059" />
                    <Text className="text-sm font-medium text-primary-700 ml-1">Add Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEditItem(item)}
                    className="flex-1 flex-row items-center justify-center bg-surface-100 py-2 rounded-xl"
                  >
                    <Ionicons name="pencil" size={16} color="#6B7280" />
                    <Text className="text-sm font-medium text-surface-700 ml-1">Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item)}
                    className="flex-row items-center justify-center bg-red-50 py-2 px-4 rounded-xl"
                  >
                    <Ionicons name="trash" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => {
          setEditingItem(null);
          setShowAddModal(true);
        }}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary-600 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 5 }}
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
