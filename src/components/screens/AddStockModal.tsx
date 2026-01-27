import React, { useState, useEffect, useRef } from 'react';
import { Alert, View, Text } from 'react-native';
import { Symbol } from '@/components/ui/Symbol';
import { useUpdateWarehouseItem, useProfile } from '../../hooks';
import { WarehouseItem } from '../../types';
import { FormModal, SectionHeader, FormInput, PreviewCard } from '../ui/FormComponents';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

interface Props {
  visible?: boolean;
  onClose: () => void;
  item: WarehouseItem | null;
  presentation?: 'modal' | 'screen';
}

export default function AddStockModal({ visible, onClose, item, presentation = 'modal' }: Props) {
  const isVisible = visible ?? true;
  const { data: profile } = useProfile();
  const updateMutation = useUpdateWarehouseItem();

  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');

  const currency = profile?.preferred_currency || 'INR';

  // Track previous visible/item state to prevent unnecessary updates
  const prevVisibleRef = useRef(isVisible);
  const prevItemIdRef = useRef(item?.id);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update when modal becomes visible or item changes
    if (isVisible && item) {
      const shouldUpdate = !prevVisibleRef.current || item.id !== prevItemIdRef.current;
      if (shouldUpdate) {
        setQuantityToAdd('');
        setNewUnitPrice(item.unit_price.toString());
      }
    }
    prevVisibleRef.current = isVisible;
    prevItemIdRef.current = item?.id;
  }, [isVisible, item]);
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
      visible={isVisible}
      onClose={onClose}
      title="Add Stock"
      onSave={handleSubmit}
      saveLabel="Add Stock"
      isLoading={isLoading}
      isSaveDisabled={!isValid}
      showResetButton
      onReset={handleReset}
      presentation={presentation}
    >
      {/* Item Info Card */}
      <View
        style={{
          backgroundColor: colors.surface[50],
          borderRadius: borderRadius['2xl'],
          padding: spacing[5],
          marginBottom: spacing[5],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: borderRadius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: item.type === 'fertilizer' ? '#DCFCE7' : '#DBEAFE',
            }}
          >
            <Symbol
              name={item.type === 'fertilizer' ? 'flask.fill' : 'drop.fill'}
              size={24}
              color={item.type === 'fertilizer' ? '#16A34A' : '#3B82F6'}
            />
          </View>
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: colors.surface[900],
              }}
            >
              {item.name}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.surface[500], marginTop: 2 }}>
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
