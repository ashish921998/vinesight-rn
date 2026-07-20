import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
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
    <BottomSheet
      index={visible ? 0 : -1}
      snapPoints={['35%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: m3.colorScheme.surface }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing[4],
          paddingTop: spacing[2],
          paddingBottom: spacing[4],
        }}
      >
        <View style={{ gap: spacing[2] }}>
          <Text style={{ ...m3.typography.headlineSmall, color: m3.colorScheme.onSurface }}>
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
              days: component?.phi_days ?? '—',
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
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            accessibilityHint={t('productDetail.closeHint', {
              defaultValue: 'Closes the product details.',
            })}
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
        </View>
      </View>
    </BottomSheet>
  );
}
