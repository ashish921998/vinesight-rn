import React, { useState, useEffect, useRef } from 'react';
import { Alert, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateWarehouseItem, useProfile } from '../../hooks';
import { WarehouseItem } from '../../types';
import { FormModal, SectionHeader, FormInput, PreviewCard } from '../ui/FormComponents';

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
      Alert.alert('Missing Information', 'Please enter the quantity you want to add');
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

  const handleReset = () => {
    setQuantityToAdd('');
    if (item) {
      setNewUnitPrice(item.unit_price.toString());
    }
  };

  if (!item) return null;

  const isLoading = updateMutation.isPending;
  const isValid = quantityToAdd && parseFloat(quantityToAdd) > 0;

  return (
    <FormModal
      visible={visible}
      onClose={onClose}
      title="Add Stock"
      onSave={handleSubmit}
      saveLabel="Add Stock"
      isLoading={isLoading}
      isSaveDisabled={!isValid}
      showResetButton
      onReset={handleReset}
    >
      {/* Item Info Card */}
      <View className="bg-surface-50 rounded-2xl p-5 mb-5">
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
            <Text className="text-lg font-bold text-surface-900">{item.name}</Text>
            <Text className="text-sm text-surface-500 mt-0.5">
              Current: {item.quantity} {item.unit}
            </Text>
          </View>
        </View>
      </View>

      {/* Stock Details */}
      <SectionHeader title="Stock Details" style={{ marginBottom: 16 }} />

      <FormInput
        label="Quantity to Add"
        value={quantityToAdd}
        onChangeText={setQuantityToAdd}
        placeholder="0"
        keyboardType="decimal-pad"
        suffix={item.unit}
        required
        autoFocus
        style={{ marginBottom: 12 }}
      />

      <FormInput
        label={`Unit Price (${currency}) - Optional`}
        value={newUnitPrice}
        onChangeText={setNewUnitPrice}
        placeholder="0.00"
        keyboardType="decimal-pad"
        prefix={currency === 'INR' ? '₹' : '$'}
        suffix={`per ${item.unit}`}
        style={{ marginBottom: 16 }}
      />

      {/* Preview */}
      {quantityToAdd && parseFloat(quantityToAdd) > 0 && (
        <PreviewCard
          title="AFTER UPDATE"
          items={[
            {
              label: 'New Stock',
              value: `${newQuantity.toFixed(1)} ${item.unit}`,
            },
            {
              label: 'Total Value',
              value: `${currency === 'INR' ? '₹' : '$'}${newValue.toLocaleString()}`,
            },
          ]}
          backgroundColor="#DBEAFE"
        />
      )}
    </FormModal>
  );
}
