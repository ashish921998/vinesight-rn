import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateWarehouseItem, useProfile } from '../../hooks';
import { WarehouseItem } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  item: WarehouseItem | null;
}

export default function AddStockModal({ visible, onClose, item }: Props) {
  const { data: profile } = useProfile();
  const updateMutation = useUpdateWarehouseItem();

  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');

  const currency = profile?.preferred_currency || 'INR';

  // Track previous visible/item state to prevent unnecessary updates
  const prevVisibleRef = useRef(visible);
  const prevItemIdRef = useRef(item?.id);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update when modal becomes visible or item changes
    if (visible && item) {
      const shouldUpdate = !prevVisibleRef.current || item.id !== prevItemIdRef.current;
      if (shouldUpdate) {
        setQuantityToAdd('');
        setNewUnitPrice(item.unit_price.toString());
      }
    }
    prevVisibleRef.current = visible;
    prevItemIdRef.current = item?.id;
  }, [visible, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const newQuantity = (item?.quantity || 0) + parseFloat(quantityToAdd || '0');
  const newValue = newQuantity * parseFloat(newUnitPrice || '0');

  const handleSubmit = async () => {
    if (!item?.id) return;

    if (!quantityToAdd || parseFloat(quantityToAdd) <= 0) {
      Alert.alert('Error', 'Please enter quantity to add');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: item.id,
        updates: {
          quantity: newQuantity,
          unit_price: parseFloat(newUnitPrice) || item.unit_price,
        },
      });
      onClose();
    } catch (_error) {
      Alert.alert('Error', 'Failed to update stock. Please try again.');
    }
  };

  if (!item) return null;

  const isLoading = updateMutation.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-surface-50"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-surface-200">
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Text className="text-primary-600 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-surface-900">Add Stock</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${
                isLoading ? 'text-surface-400' : 'text-primary-600'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="p-4">
          {/* Current Item Info */}
          <View className="bg-white rounded-2xl p-4 mb-4">
            <View className="flex-row items-center">
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
                <Text className="text-lg font-semibold text-surface-900">{item.name}</Text>
                <Text className="text-sm text-surface-500">
                  Current stock: {item.quantity} {item.unit}
                </Text>
              </View>
            </View>
          </View>

          {/* Quantity to Add */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">Quantity to Add *</Text>
            <View className="flex-row items-center bg-white rounded-xl border border-surface-200">
              <TextInput
                value={quantityToAdd}
                onChangeText={setQuantityToAdd}
                placeholder="0"
                keyboardType="decimal-pad"
                className="flex-1 px-4 py-3 text-base text-surface-900"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <Text className="text-base text-surface-500 pr-4">{item.unit}</Text>
            </View>
          </View>

          {/* Update Unit Price */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">
              Update Unit Price ({currency})
            </Text>
            <View className="flex-row items-center bg-white rounded-xl border border-surface-200">
              <Text className="text-base text-surface-500 pl-4">
                {currency === 'INR' ? '₹' : '$'}
              </Text>
              <TextInput
                value={newUnitPrice}
                onChangeText={setNewUnitPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
                className="flex-1 px-2 py-3 text-base text-surface-900"
                placeholderTextColor="#9CA3AF"
              />
              <Text className="text-base text-surface-500 pr-4">per {item.unit}</Text>
            </View>
            <Text className="text-xs text-surface-500 mt-1">Leave as is to keep current price</Text>
          </View>

          {/* Preview */}
          <View className="bg-primary-50 rounded-2xl p-4">
            <Text className="text-xs font-bold text-primary-600 tracking-wider mb-3">
              AFTER UPDATE
            </Text>
            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-xs text-primary-500">New Quantity</Text>
                <Text className="text-xl font-bold text-primary-700">
                  {newQuantity.toFixed(1)} {item.unit}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-primary-500">New Total Value</Text>
                <Text className="text-xl font-bold text-primary-700">
                  {currency === 'INR' ? '₹' : '$'}
                  {newValue.toLocaleString()}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center mt-3 pt-3 border-t border-primary-200">
              <Ionicons name="add-circle" size={16} color="#408059" />
              <Text className="text-sm text-primary-600 ml-2">
                Adding {quantityToAdd || 0} {item.unit} to current stock
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
