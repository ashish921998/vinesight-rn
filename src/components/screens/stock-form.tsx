import React, { useState, useEffect, useRef } from 'react';
import { Alert, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useUpdateWarehouseItem } from '../../hooks';
import { WarehouseItem } from '../../types';
import { FormModal, SectionHeader, FormInput, PreviewCard } from '../ui/form-components';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { useCurrency } from '@/hooks/use-currency';

interface Props {
  visible?: boolean;
  onClose: () => void;
  item: WarehouseItem | null;
  presentation?: 'modal' | 'screen';
}

export default function StockForm({ visible, onClose, item, presentation = 'modal' }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();

  const isVisible = visible ?? true;
  const updateMutation = useUpdateWarehouseItem();

  const [quantityToAdd, setQuantityToAdd] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');

  const currency = useCurrency();

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
      Alert.alert(
        t('common.alerts.missingInformationTitle'),
        t('common.alerts.enterQuantityToAdd'),
      );
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
      Alert.alert(t('common.error'), t('common.errors.failedToUpdateStock'));
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
      title={t('warehouse.stockForm.title')}
      onSave={handleSubmit}
      saveLabel={t('warehouse.stockForm.saveLabel')}
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
              backgroundColor:
                item.type === 'fertilizer'
                  ? colorWithOpacity(colors.success, 0.12)
                  : colorWithOpacity(m3.colorScheme.primary, 0.12),
            }}
          >
            <SymbolIcon
              name={
                item.type === 'fertilizer'
                  ? 'flask.fill'
                  : item.type === 'spray'
                    ? 'spraycan.fill'
                    : 'drop.fill'
              }
              size={24}
              color={item.type === 'fertilizer' ? colors.success : m3.colorScheme.primary}
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
              {t('warehouse.stockForm.currentLabel', {
                quantity: formatNumber(item.quantity),
                unit: item.unit,
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Stock Details */}
      <SectionHeader title={t('warehouse.stockForm.sectionTitle')} style={{ marginBottom: 16 }} />

      <FormInput
        label={t('warehouse.stockForm.fields.quantityToAdd')}
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
        label={t('warehouse.stockForm.fields.unitPriceOptional', { currency })}
        value={newUnitPrice}
        onChangeText={setNewUnitPrice}
        placeholder="0.00"
        keyboardType="decimal-pad"
        prefix={currency === 'INR' ? '₹' : '$'}
        suffix={t('warehouse.stockForm.perUnitSuffix', { unit: item.unit })}
        style={{ marginBottom: 16 }}
      />

      {/* Preview */}
      {quantityToAdd && parseFloat(quantityToAdd) > 0 && (
        <PreviewCard
          title={t('warehouse.stockForm.preview.title')}
          items={[
            {
              label: t('warehouse.stockForm.preview.newStock'),
              value: `${formatNumber(newQuantity, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })} ${item.unit}`,
            },
            {
              label: t('warehouse.stockForm.preview.totalValue'),
              value: formatCurrency(newValue, currency),
            },
          ]}
          backgroundColor={colorWithOpacity(m3.colorScheme.primary, 0.12)}
        />
      )}
    </FormModal>
  );
}
