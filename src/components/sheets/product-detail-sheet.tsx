import React from 'react';
import { Modal, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ChemicalMixComponent } from '@/types/phi';
import { borderRadius, fontWeight, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useM3 } from '@/styles/use-theme';

interface ProductDetailSheetProps {
  visible: boolean;
  component: ChemicalMixComponent | null;
  mixesUsingProductCount?: number;
  onClose: () => void;
}

export function ProductDetailSheet({
  visible,
  component,
  mixesUsingProductCount = 0,
  onClose,
}: ProductDetailSheetProps) {
  const { t } = useTranslation();
  const m3 = useM3();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: colorWithOpacity('#000000', 0.25),
          padding: spacing[3],
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            borderRadius: borderRadius.xl,
            backgroundColor: m3.colorScheme.surface,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            padding: spacing[4],
            gap: spacing[2],
          }}
        >
          <Text style={{ ...m3.typography.titleLarge, color: m3.colorScheme.onSurface }}>
            {component?.product_name ??
              t('productDetail.titleFallback', { defaultValue: 'Product details' })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('productDetail.activeIngredient', {
              defaultValue: 'Active ingredient: {{value}}',
              value: component?.active_ingredient ?? '—',
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('productDetail.phiDays', {
              defaultValue: 'PHI: {{days}} day(s)',
              days: component?.phi_days ?? 0,
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('productDetail.price', {
              defaultValue: 'Price: {{currency}} {{price}}',
              currency: component?.price_currency ?? 'INR',
              price: component?.price_per_package ?? '—',
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('productDetail.packaging', {
              defaultValue: 'Packaging: {{value}}',
              value: component?.packaging_size ?? '—',
            })}
          </Text>
          <Text style={{ color: m3.colorScheme.onSurfaceVariant }}>
            {t('productDetail.usageCount', {
              defaultValue: 'Used in {{count}} catalog mix(es)',
              count: mixesUsingProductCount,
            })}
          </Text>
          <Pressable
            onPress={onClose}
            style={{
              marginTop: spacing[2],
              alignSelf: 'flex-start',
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
            }}
          >
            <Text style={{ color: m3.colorScheme.primary, fontWeight: fontWeight.semibold }}>
              {t('common.close', { defaultValue: 'Close' })}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
