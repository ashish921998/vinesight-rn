import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { useCreateWarehouseItem, useUpdateWarehouseItem, useProfile } from '../../hooks';
import { WarehouseItem, WarehouseItemType, WarehouseUnit } from '../../types';
import i18n from '@/i18n';
import { formatCurrency } from '@/i18n/format';
import { getDefaultCurrency } from '@/i18n/currency';
import {
  FormModal,
  SectionHeader,
  PillSelector,
  CardSelector,
  FormInput,
  PreviewCard,
} from '../ui/form-components';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

interface Props {
  visible?: boolean;
  onClose: () => void;
  editingItem: WarehouseItem | null;
  presentation?: 'modal' | 'screen';
}

const ITEM_TYPES = [
  { value: 'fertilizer' as WarehouseItemType, label: 'Fertilizer', icon: 'flask' as const },
  { value: 'spray' as WarehouseItemType, label: 'Spray', icon: 'water' as const },
];

export default function WarehouseItemForm({
  visible,
  onClose,
  editingItem,
  presentation = 'modal',
}: Props) {
  const colors = useThemeColors();
  const m3 = useM3();
  const isVisible = visible ?? true;
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

  const currency = profile?.currency_preference ?? getDefaultCurrency();
  const isEditing = !!editingItem;

  const unitOptions = useMemo(
    () => [
      {
        value: 'kg' as WarehouseUnit,
        label: 'kg',
        sublabel: 'Kilograms',
        icon: 'scale-outline' as const,
        iconColor: colorWithOpacity(colors.warning, 0.25),
      },
      {
        value: 'gram' as WarehouseUnit,
        label: 'g',
        sublabel: 'Grams',
        icon: 'scale-outline' as const,
        iconColor: colorWithOpacity(colors.warning, 0.25),
      },
      {
        value: 'liter' as WarehouseUnit,
        label: 'L',
        sublabel: 'Liters',
        icon: 'water-outline' as const,
        iconColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
      },
      {
        value: 'ml' as WarehouseUnit,
        label: 'ml',
        sublabel: 'Milliliters',
        icon: 'water-outline' as const,
        iconColor: colorWithOpacity(m3.colorScheme.primary, 0.18),
      },
    ],
    [colors.warning, m3.colorScheme.primary],
  );

  // Track previous state to prevent unnecessary updates
  const prevVisibleRef = useRef(isVisible);
  const prevEditingItemIdRef = useRef(editingItem?.id);

  const resetForm = () => {
    setName('');
    setType('fertilizer');
    setQuantity('');
    setUnit('kg');
    setUnitPrice('');
    setReorderQuantity('');
    setNotes('');
  };

  const handleReset = () => {
    resetForm();
  };

  // Reset form when modal opens/closes or editing item changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Only update when modal becomes visible or editingItem changes
    if (isVisible) {
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
    prevVisibleRef.current = isVisible;
    prevEditingItemIdRef.current = editingItem?.id;
  }, [isVisible, editingItem]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterItemName'));
      return;
    }
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterValidQuantity'));
      return;
    }
    const unitPriceValue = Number(unitPrice);
    if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.enterValidUnitPrice'));
      return;
    }

    const itemData = {
      name: name.trim(),
      type,
      quantity: quantityValue,
      unit,
      unit_price: unitPriceValue,
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
      Alert.alert(i18n.t('common.error'), i18n.t('common.errors.failedToSaveItem'));
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const isValid =
    name.trim() &&
    quantity &&
    Number.isFinite(Number(quantity)) &&
    Number(quantity) > 0 &&
    unitPrice &&
    Number.isFinite(Number(unitPrice)) &&
    Number(unitPrice) > 0;

  const totalValue =
    quantity && unitPrice ? (parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2) : '0.00';

  return (
    <FormModal
      visible={isVisible}
      onClose={onClose}
      title={isEditing ? 'Edit Item' : 'Add Item'}
      onSave={handleSubmit}
      saveLabel={isEditing ? 'Save Changes' : 'Add Item'}
      isLoading={isLoading}
      isSaveDisabled={!isValid}
      showResetButton={!isEditing}
      onReset={handleReset}
      presentation={presentation}
    >
      {/* Item Details */}
      <SectionHeader title="Item Details" style={{ marginBottom: 16 }} />

      <FormInput
        label="Item Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g., NPK 19:19:19"
        required
        autoFocus
        style={{ marginBottom: 12 }}
      />

      <PillSelector
        options={ITEM_TYPES}
        selectedValue={type}
        onSelect={(value) => setType(value as WarehouseItemType)}
        style={{ marginBottom: 20 }}
      />

      {/* Quantity & Unit */}
      <SectionHeader title="Quantity & Unit" style={{ marginBottom: 16 }} />

      <FormInput
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="0"
        keyboardType="decimal-pad"
        required
        style={{ marginBottom: 12 }}
      />

      <CardSelector
        options={unitOptions}
        selectedValue={unit}
        onSelect={(value) => setUnit(value as WarehouseUnit)}
        columns={2}
        style={{ marginBottom: 20 }}
      />

      {/* Pricing & Alert */}
      <SectionHeader title="Pricing & Alerts" style={{ marginBottom: 16 }} />

      <FormInput
        label={`Unit Price (${currency})`}
        value={unitPrice}
        onChangeText={setUnitPrice}
        placeholder="0.00"
        keyboardType="decimal-pad"
        prefix={currency === 'INR' ? '₹' : '$'}
        suffix={`per ${unit}`}
        required
        style={{ marginBottom: 12 }}
      />

      <FormInput
        label="Low Stock Alert (Optional)"
        value={reorderQuantity}
        onChangeText={setReorderQuantity}
        placeholder="Leave empty to disable"
        keyboardType="decimal-pad"
        suffix={unit}
        style={{ marginBottom: 12 }}
      />

      <FormInput
        label="Notes (Optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Any additional details..."
        multiline
        numberOfLines={2}
        style={{ marginBottom: 16 }}
      />

      {/* Total Value Preview */}
      {quantity && unitPrice && (
        <PreviewCard
          title="TOTAL VALUE"
          items={[
            {
              label: `${quantity} ${unit} × ${currency === 'INR' ? '₹' : '$'}${unitPrice}`,
              value: formatCurrency(parseFloat(totalValue), currency),
            },
          ]}
          backgroundColor={colorWithOpacity(colors.success, 0.12)}
        />
      )}
    </FormModal>
  );
}
