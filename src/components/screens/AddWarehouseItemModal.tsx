import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateWarehouseItem, useUpdateWarehouseItem, useProfile } from '../../hooks';
import { WarehouseItem, WarehouseItemType, WarehouseUnit } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  editingItem: WarehouseItem | null;
}

const ITEM_TYPES: { value: WarehouseItemType; label: string; icon: string }[] = [
  { value: 'fertilizer', label: 'Fertilizer', icon: 'flask' },
  { value: 'spray', label: 'Spray', icon: 'water' },
];

const UNITS: { value: WarehouseUnit; label: string }[] = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'gram', label: 'Grams (g)' },
  { value: 'liter', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (ml)' },
];

export default function AddWarehouseItemModal({ visible, onClose, editingItem }: Props) {
  const { data: profile } = useProfile();
  const createMutation = useCreateWarehouseItem();
  const updateMutation = useUpdateWarehouseItem();

  const [name, setName] = useState('');
  const [type, setType] = useState<WarehouseItemType>('fertilizer');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<WarehouseUnit>('kg');
  const [unitPrice, setUnitPrice] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const currency = profile?.preferred_currency || 'INR';
  const isEditing = !!editingItem;

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(visible);
  const prevEditingItemIdRef = useRef(editingItem?.id);

  const resetForm = () => {
    setName('');
    setType('fertilizer');
    setQuantity('');
    setUnit('kg');
    setUnitPrice('');
    setReorderQuantity('');
    setNotes('');
    setShowTypePicker(false);
    setShowUnitPicker(false);
  };

  // Reset form when modal opens/closes or editing item changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update when modal becomes visible or editingItem changes
    if (visible) {
      const shouldUpdate =
        !prevVisibleRef.current || editingItem?.id !== prevEditingItemIdRef.current;

      if (shouldUpdate) {
        if (editingItem) {
          setName(editingItem.name);
          setType(editingItem.type as WarehouseItemType);
          setQuantity(editingItem.quantity.toString());
          setUnit(editingItem.unit as WarehouseUnit);
          setUnitPrice(editingItem.unit_price.toString());
          setReorderQuantity(editingItem.reorder_quantity?.toString() || '');
          setNotes(editingItem.notes || '');
        } else {
          resetForm();
        }
      }
    }
    prevVisibleRef.current = visible;
    prevEditingItemIdRef.current = editingItem?.id;
  }, [visible, editingItem]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }
    if (!quantity || parseFloat(quantity) < 0) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) < 0) {
      Alert.alert('Error', 'Please enter valid unit price');
      return;
    }

    const itemData = {
      name: name.trim(),
      type,
      quantity: parseFloat(quantity),
      unit,
      unit_price: parseFloat(unitPrice),
      reorder_quantity: reorderQuantity ? parseFloat(reorderQuantity) : null,
      notes: notes.trim() || null,
    };

    try {
      if (isEditing && editingItem?.id) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          updates: itemData,
        });
      } else {
        await createMutation.mutateAsync(itemData);
      }
      onClose();
    } catch (_error) {
      Alert.alert('Error', 'Failed to save item. Please try again.');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

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
          <Text className="text-lg font-semibold text-surface-900">
            {isEditing ? 'Edit Item' : 'Add Item'}
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${isLoading ? 'text-surface-400' : 'text-primary-600'}`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {/* Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">Item Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., NPK 19:19:19"
              className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Type Picker */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">Type *</Text>
            <TouchableOpacity
              onPress={() => setShowTypePicker(!showTypePicker)}
              className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={
                    ITEM_TYPES.find((t) => t.value === type)?.icon as keyof typeof Ionicons.glyphMap
                  }
                  size={20}
                  color={type === 'fertilizer' ? '#16A34A' : '#3B82F6'}
                />
                <Text className="text-base text-surface-900 ml-2">
                  {ITEM_TYPES.find((t) => t.value === type)?.label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {showTypePicker && (
              <View className="bg-white rounded-xl mt-2 border border-surface-200 overflow-hidden">
                {ITEM_TYPES.map((itemType) => (
                  <TouchableOpacity
                    key={itemType.value}
                    onPress={() => {
                      setType(itemType.value);
                      setShowTypePicker(false);
                    }}
                    className={`p-4 flex-row items-center border-b border-surface-100 ${
                      type === itemType.value ? 'bg-primary-50' : ''
                    }`}
                  >
                    <Ionicons
                      name={itemType.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={itemType.value === 'fertilizer' ? '#16A34A' : '#3B82F6'}
                    />
                    <Text
                      className={`ml-3 flex-1 ${
                        type === itemType.value
                          ? 'text-primary-700 font-medium'
                          : 'text-surface-700'
                      }`}
                    >
                      {itemType.label}
                    </Text>
                    {type === itemType.value && (
                      <Ionicons name="checkmark" size={20} color="#408059" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Quantity & Unit */}
          <View className="flex-row mb-4" style={{ gap: 12 }}>
            <View className="flex-1">
              <Text className="text-sm font-medium text-surface-700 mb-2">Quantity *</Text>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                keyboardType="decimal-pad"
                className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-surface-700 mb-2">Unit *</Text>
              <TouchableOpacity
                onPress={() => setShowUnitPicker(!showUnitPicker)}
                className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-surface-200"
              >
                <Text className="text-base text-surface-900">
                  {UNITS.find((u) => u.value === unit)?.label.split(' ')[0]}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Unit Picker Dropdown */}
          {showUnitPicker && (
            <View className="bg-white rounded-xl mb-4 border border-surface-200 overflow-hidden">
              {UNITS.map((unitOption) => (
                <TouchableOpacity
                  key={unitOption.value}
                  onPress={() => {
                    setUnit(unitOption.value);
                    setShowUnitPicker(false);
                  }}
                  className={`p-4 border-b border-surface-100 ${
                    unit === unitOption.value ? 'bg-primary-50' : ''
                  }`}
                >
                  <Text
                    className={
                      unit === unitOption.value
                        ? 'text-primary-700 font-medium'
                        : 'text-surface-700'
                    }
                  >
                    {unitOption.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Unit Price */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">
              Unit Price ({currency}) *
            </Text>
            <View className="flex-row items-center bg-white rounded-xl border border-surface-200">
              <Text className="text-base text-surface-500 pl-4">
                {currency === 'INR' ? '₹' : '$'}
              </Text>
              <TextInput
                value={unitPrice}
                onChangeText={setUnitPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
                className="flex-1 px-2 py-3 text-base text-surface-900"
                placeholderTextColor="#9CA3AF"
              />
              <Text className="text-base text-surface-500 pr-4">per {unit}</Text>
            </View>
          </View>

          {/* Reorder Quantity */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">
              Reorder Alert Quantity
            </Text>
            <TextInput
              value={reorderQuantity}
              onChangeText={setReorderQuantity}
              placeholder="Alert when stock falls below this"
              keyboardType="decimal-pad"
              className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-xs text-surface-500 mt-1">
              Leave empty to disable low stock alerts
            </Text>
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-surface-700 mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes about this item"
              multiline
              numberOfLines={3}
              className="bg-white rounded-xl px-4 py-3 text-base text-surface-900 border border-surface-200"
              placeholderTextColor="#9CA3AF"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>

          {/* Total Value Preview */}
          {quantity && unitPrice && (
            <View className="bg-primary-50 rounded-xl p-4">
              <Text className="text-sm text-primary-600">Total Value</Text>
              <Text className="text-2xl font-bold text-primary-700">
                {currency === 'INR' ? '₹' : '$'}
                {(parseFloat(quantity || '0') * parseFloat(unitPrice || '0')).toLocaleString()}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
