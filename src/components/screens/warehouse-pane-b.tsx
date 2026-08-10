/**
 * WarehousePaneB — B v2 redesign of the warehouse pane inside Explore.
 *
 * List: dense rows with stock / reorder / price info.
 *
 * Receives data + handlers as props; owns no fetching state.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, Pressable, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingState } from '@/components/ui';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import type { WarehouseItem } from '@/types';

function isLowStock(item: WarehouseItem): boolean {
  return typeof item.reorder_quantity === 'number' && item.quantity <= item.reorder_quantity;
}

interface WarehousePaneBProps {
  items: WarehouseItem[] | undefined;
  isLoading: boolean;
  searchQuery: string;
  currency: string;
  onAddItem: () => void;
  onItemPress: (item: WarehouseItem) => void;
  onItemLongPress?: (item: WarehouseItem) => void;
  listBottomPadding?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function WarehousePaneB({
  items,
  isLoading,
  searchQuery,
  currency,
  onAddItem,
  onItemPress,
  onItemLongPress,
  listBottomPadding,
  refreshControl,
}: WarehousePaneBProps) {
  const m3 = useM3();
  const { t } = useTranslation();
  const domainColors = useDomainColors();

  // Subtle category accent — a small colored dot before the subtitle.
  // spray → olive-green, fertilizer → deeper green, equipment → no dot.
  const categoryDotColor = useCallback(
    (type: string | undefined): string | null => {
      if (type === 'spray') return domainColors.category.spray;
      if (type === 'fertilizer') return domainColors.category.fertigation;
      return null;
    },
    [domainColors],
  );

  // ── Search ──────────────────────────────────────────────────────────────
  const filteredItems = useMemo<WarehouseItem[]>(() => {
    if (!items) return [];
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.manufacturer?.toLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  // ── Empty + loading ─────────────────────────────────────────────────────
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return <LoadingState label={t('warehouse.loading.inventory')} />;
    }
    if (searchQuery.trim()) {
      return <EmptyState icon="magnifyingglass" title={t('common.noResultsFound')} />;
    }
    return (
      <EmptyState
        icon="cube.fill"
        title={t('warehouse.empty.title')}
        description={t('warehouse.empty.subtitle')}
        actionLabel={t('warehouse.actions.addProduct')}
        onAction={onAddItem}
      />
    );
  }, [isLoading, searchQuery, t, onAddItem]);

  // ── Row render ──────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: WarehouseItem }) => {
      const low = isLowStock(item);
      const dotColor = categoryDotColor(item.type);
      const reorder = item.reorder_quantity ?? 0;
      const stockNumber = formatNumber(item.quantity, { maximumFractionDigits: 1 });
      const formattedUnitPrice = formatCurrency(item.unit_price, currency, {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      });

      const categoryLabel = t(`warehouse.itemTypes.${item.type ?? 'equipment'}` as const, {
        defaultValue:
          item.type === 'spray' ? 'Spray' : item.type === 'fertilizer' ? 'Fertilizer' : 'Equipment',
      });

      const subtitleParts = [item.manufacturer, categoryLabel].filter(Boolean);

      const stockParts = [
        `${stockNumber} ${item.unit}`,
        reorder > 0
          ? t('explore.warehouse.reorderAt', {
              defaultValue: 'Reorder ≤ {{quantity}}',
              quantity: formatNumber(reorder, { maximumFractionDigits: 1 }),
            })
          : undefined,
        `${formattedUnitPrice} /${item.unit}`,
        item.expiry_date
          ? t('warehouse.labels.expires', { date: formatDate(item.expiry_date) })
          : undefined,
      ].filter(Boolean);

      return (
        <Pressable
          onPress={() => onItemPress(item)}
          onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}${low ? `, ${t('warehouse.labels.lowStock')}` : ''}`}
          android_ripple={{ color: colorWithOpacity(m3.colorScheme.primary, 0.08) }}
          style={{
            marginHorizontal: spacing[4],
            marginBottom: spacing[2],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: m3.colorScheme.outlineVariant,
            backgroundColor: m3.surface.surfaceContainerLow,
          }}
        >
          <View>
            {/* Name + inline low-stock flag. */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.bold,
                  color: m3.colorScheme.onSurface,
                  flexShrink: 1,
                }}
              >
                {item.name}
              </Text>
              {low ? (
                <Text
                  style={{
                    marginLeft: spacing[2],
                    fontSize: fontSize['2xs'],
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.error,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {t('explore.warehouse.stockLow', { defaultValue: 'Low' })}
                </Text>
              ) : null}
            </View>

            {/* Subtitle: [dot] manufacturer · category. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              {dotColor ? (
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: radius.full,
                    backgroundColor: dotColor,
                    marginRight: spacing[2],
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ) : null}
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  flexShrink: 1,
                }}
              >
                {subtitleParts.join(' · ')}
              </Text>
            </View>

            {/* Stock info as plain muted text. */}
            <Text
              style={{
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onSurfaceVariant,
                marginTop: spacing[1],
                fontVariant: ['tabular-nums'],
              }}
            >
              {stockParts.join(' · ')}
            </Text>
          </View>
        </Pressable>
      );
    },
    [onItemPress, onItemLongPress, currency, t, m3, categoryDotColor],
  );

  return (
    <FlatList
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{
        paddingTop: spacing[1] + 2,
        paddingBottom: listBottomPadding ?? spacing[16],
        paddingHorizontal: 0,
        flexGrow: 1,
      }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}
