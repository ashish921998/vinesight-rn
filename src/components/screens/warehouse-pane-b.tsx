/**
 * WarehousePaneB — B v2 redesign of the warehouse pane inside Explore.
 *
 * Hero: stock-health stacked category bar with ⚠ REORDER flag.
 * List: dense rows with stock/reorder/cost stats + stock gauge.
 *
 * Receives data + handlers as props; owns no fetching state.
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, type RefreshControlProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingState } from '@/components/ui';
import {
  HeroPanel,
  StatStrip,
  ChipRow,
  ListRowB,
  MetaColumn,
  AttentionDot,
  type ChipDef,
  type StatItem,
} from '@/components/ui/explore-primitives';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency } from '@/i18n/format';
import { useM3, useThemeColors } from '@/styles/use-theme';
import type { WarehouseItem } from '@/types';

export type WarehouseFilter = 'all' | 'spray' | 'fertilizer' | 'equipment';
type WarehouseCategory = 'spray' | 'fertilizer' | 'equipment';

function classifyType(rawType: string | undefined): WarehouseCategory {
  if (rawType === 'spray') return 'spray';
  if (rawType === 'fertilizer') return 'fertilizer';
  return 'equipment';
}

function isLowStock(item: WarehouseItem): boolean {
  return typeof item.reorder_quantity === 'number' && item.quantity <= item.reorder_quantity;
}

interface WarehousePaneBProps {
  items: WarehouseItem[] | undefined;
  isLoading: boolean;
  searchQuery: string;
  activeFilter: WarehouseFilter;
  currency: string;
  onFilterChange: (filter: WarehouseFilter) => void;
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
  activeFilter,
  currency,
  onFilterChange,
  onAddItem,
  onItemPress,
  onItemLongPress,
  listBottomPadding,
  refreshControl,
}: WarehousePaneBProps) {
  const m3 = useM3();
  const colors = useThemeColors();
  const { t } = useTranslation();

  // ── Category color helpers ─────────────────────────────────────────────
  const accentFor = useCallback(
    (category: WarehouseCategory): string => {
      if (category === 'spray') return colors.accent[500];
      if (category === 'fertilizer') return m3.colorScheme.primary;
      return colors.secondary[500];
    },
    [colors.accent, colors.secondary, m3.colorScheme.primary],
  );

  // ── Filter + search ────────────────────────────────────────────────────
  const filteredItems = useMemo<WarehouseItem[]>(() => {
    if (!items) return [];
    let result = items;
    if (activeFilter !== 'all') {
      result = result.filter((item) => classifyType(item.type) === activeFilter);
    }
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query) ||
          item.manufacturer?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [items, activeFilter, searchQuery]);

  const buckets = useMemo(() => {
    const all = items?.length ?? 0;
    const groups = { spray: 0, fertilizer: 0, equipment: 0 };
    const lowGroups = { spray: 0, fertilizer: 0, equipment: 0 };
    let value = 0;
    let lowTotal = 0;
    for (const item of items ?? []) {
      const cat = classifyType(item.type);
      groups[cat] += 1;
      value += item.quantity * item.unit_price;
      if (isLowStock(item)) {
        lowGroups[cat] += 1;
        lowTotal += 1;
      }
    }
    return { all, groups, lowGroups, value, lowTotal };
  }, [items]);

  const formattedValue = useMemo(
    () =>
      formatCurrency(buckets.value, currency, {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }),
    [buckets.value, currency],
  );

  // ── Hero label + value ─────────────────────────────────────────────────
  const heroLabel = useMemo(
    () =>
      t('explore.warehouse.heroLabel', {
        defaultValue: 'Inventory · {{count}} items · {{value}}',
        count: buckets.all,
        value: formattedValue,
      }),
    [t, buckets.all, formattedValue],
  );
  const heroValue = useMemo(
    () =>
      buckets.lowTotal > 0
        ? t('explore.warehouse.heroValueLow', {
            defaultValue: '{{count}} LOW',
            count: buckets.lowTotal,
          })
        : t('explore.warehouse.heroValueOk', { defaultValue: 'All OK' }),
    [t, buckets.lowTotal],
  );

  // ── Filter chips ───────────────────────────────────────────────────────
  const chips = useMemo<ChipDef<WarehouseFilter>[]>(() => {
    const base: ChipDef<WarehouseFilter>[] = [
      {
        key: 'all',
        label: t('explore.warehouse.filter.all', { defaultValue: 'All' }),
        count: buckets.all,
      },
      {
        key: 'spray',
        label: t('explore.warehouse.filter.spray', { defaultValue: 'Spray' }),
        count: buckets.groups.spray,
      },
      {
        key: 'fertilizer',
        label: t('explore.warehouse.filter.fertilizer', { defaultValue: 'Fert' }),
        count: buckets.groups.fertilizer,
      },
    ];
    if (buckets.groups.equipment > 0 || activeFilter === 'equipment') {
      base.push({
        key: 'equipment',
        label: t('explore.warehouse.filter.equipment', { defaultValue: 'Equip' }),
        count: buckets.groups.equipment,
      });
    }
    return base;
  }, [
    t,
    buckets.all,
    buckets.groups.spray,
    buckets.groups.fertilizer,
    buckets.groups.equipment,
    activeFilter,
  ]);

  // ── Empty + loading ────────────────────────────────────────────────────
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
        actionLabel={t('warehouse.actions.addItem')}
        onAction={onAddItem}
      />
    );
  }, [isLoading, searchQuery, t, onAddItem]);

  // ── Row render ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: WarehouseItem }) => {
      const cat = classifyType(item.type);
      const accent = accentFor(cat);
      const reorder = item.reorder_quantity ?? 0;
      const low = isLowStock(item);
      // Gauge fills relative to "comfortable" stock = reorder * 3 floor, so the
      // threshold tick lands at ~33% and there is visible room above it.
      const denom = Math.max(1, reorder * 3, item.quantity);
      const ratio = Math.min(1, item.quantity / denom);
      const thresholdRatio = reorder > 0 ? Math.min(1, reorder / denom) : undefined;

      const formattedUnitPrice = formatCurrency(item.unit_price, currency, {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      });

      const stockNumber = Math.round(item.quantity * 10) / 10;

      const stats: StatItem[] = [
        {
          icon: '📦',
          number: stockNumber,
          suffix: ` ${item.unit}`,
          tone: low ? 'low' : 'ok',
        },
      ];

      if (reorder > 0) {
        stats.push({
          icon: '⚠',
          label: t('explore.warehouse.reorderAt', { defaultValue: 'Reorder ≤ ' }),
          number: reorder,
        });
      }

      stats.push({
        label: `${formattedUnitPrice} /${item.unit}`,
      });

      const subtitleParts = [
        item.manufacturer,
        t(`warehouse.itemTypes.${cat}` as const, {
          defaultValue:
            cat === 'spray' ? 'Spray' : cat === 'fertilizer' ? 'Fertilizer' : 'Equipment',
        }),
        item.composition && item.composition.length > 0
          ? item.composition
              .slice(0, 3)
              .map((c) => `${c.nutrient_code}${c.percent}`)
              .join(' ')
          : undefined,
      ].filter(Boolean);

      const stageLabel = low
        ? t('explore.warehouse.stockLow', { defaultValue: 'Low' })
        : t('explore.warehouse.stockOk', { defaultValue: 'OK' });

      return (
        <ListRowB
          accentColor={accent}
          accessibilityLabel={`${item.name}, ${stageLabel}`}
          onPress={() => onItemPress(item)}
          onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
          body={
            <View>
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
                {low ? <AttentionDot /> : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.xs,
                  color: m3.colorScheme.onSurfaceVariant,
                  marginTop: 2,
                }}
              >
                {subtitleParts.join(' · ')}
              </Text>
              <StatStrip stats={stats} />
            </View>
          }
          meta={
            <MetaColumn
              label={stageLabel}
              tone={low ? 'low' : 'default'}
              gauge={{
                value: ratio,
                fill: low ? m3.colorScheme.error : accent,
                threshold: thresholdRatio,
              }}
            />
          }
        />
      );
    },
    [onItemPress, onItemLongPress, currency, t, m3, accentFor],
  );

  // ── Header ─────────────────────────────────────────────────────────────
  const header = useMemo(
    () => (
      <View>
        <HeroPanel label={heroLabel} value={heroValue}>
          <StockHealthBar buckets={buckets} accentFor={accentFor} t={t} />
        </HeroPanel>
        <ChipRow chips={chips} active={activeFilter} onChange={onFilterChange} />
      </View>
    ),
    [heroLabel, heroValue, buckets, accentFor, t, chips, activeFilter, onFilterChange],
  );

  return (
    <FlatList
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{
        paddingTop: spacing[1] + 2,
        paddingBottom: listBottomPadding ?? spacing[16],
        flexGrow: 1,
      }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stock health bar
// ──────────────────────────────────────────────────────────────────────────

interface StockHealthBarProps {
  buckets: {
    all: number;
    groups: { spray: number; fertilizer: number; equipment: number };
    lowGroups: { spray: number; fertilizer: number; equipment: number };
    lowTotal: number;
  };
  accentFor: (cat: WarehouseCategory) => string;
  t: ReturnType<typeof useTranslation>['t'];
}

function StockHealthBar({ buckets, accentFor, t }: StockHealthBarProps) {
  const m3 = useM3();
  const { groups, lowGroups, lowTotal, all } = buckets;
  const [barWidth, setBarWidth] = React.useState(0);

  if (all === 0) {
    return (
      <View style={{ height: 22, marginTop: spacing[2] }}>
        <View
          style={{
            flex: 1,
            borderRadius: radius.sm,
            backgroundColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.12),
          }}
        />
      </View>
    );
  }

  // Determine which category gets the REORDER flag — pick the one with the
  // most low-stock items, ties broken by category order (spray > fert > equip).
  const orderedCategories: WarehouseCategory[] = ['spray', 'fertilizer', 'equipment'];
  const flagCategory =
    lowTotal > 0
      ? orderedCategories.reduce<WarehouseCategory>(
          (best, cat) => (lowGroups[cat] > lowGroups[best] ? cat : best),
          orderedCategories[0],
        )
      : null;

  // Pre-compute segment x positions (centers) for placing the flag.
  let cumulative = 0;
  const segCenters: Record<WarehouseCategory, number> = { spray: 0, fertilizer: 0, equipment: 0 };
  for (const cat of orderedCategories) {
    const segWidth = (groups[cat] / all) * barWidth;
    segCenters[cat] = cumulative + segWidth / 2;
    cumulative += segWidth;
  }
  const flagX = flagCategory ? segCenters[flagCategory] : 0;

  return (
    <View style={{ marginTop: spacing[2], position: 'relative' }}>
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        style={{
          flexDirection: 'row',
          height: 22,
          borderRadius: radius.sm,
          overflow: 'hidden',
        }}
      >
        {orderedCategories.map((cat) => {
          const count = groups[cat];
          if (count === 0) return null;
          return (
            <View
              key={cat}
              style={{
                flex: count,
                backgroundColor: accentFor(cat),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: fontSize['2xs'],
                  fontWeight: fontWeight.bold,
                  color: '#fff',
                  letterSpacing: 0.3,
                }}
                numberOfLines={1}
              >
                {count}{' '}
                {cat === 'spray'
                  ? t('explore.warehouse.cat.spray', { defaultValue: 'Spray' })
                  : cat === 'fertilizer'
                    ? t('explore.warehouse.cat.fertilizer', { defaultValue: 'Fert' })
                    : t('explore.warehouse.cat.equipment', { defaultValue: 'Equip' })}
              </Text>
            </View>
          );
        })}
      </View>

      {flagCategory && barWidth > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -10,
            left: Math.max(0, Math.min(barWidth - 80, flagX - 40)),
            width: 80,
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <View
            style={{
              backgroundColor: m3.colorScheme.error,
              paddingHorizontal: spacing[1] + 2,
              paddingVertical: 2,
              borderRadius: borderRadius.xs / 2,
            }}
          >
            <Text
              style={{
                fontSize: fontSize['2xs'],
                fontWeight: fontWeight.bold,
                color: '#fff',
                letterSpacing: 0.4,
              }}
              numberOfLines={1}
            >
              {t('explore.warehouse.reorderFlag', {
                defaultValue: '⚠ REORDER · {{count}}',
                count: lowTotal,
              })}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Legend */}
      <View
        style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[2], flexWrap: 'wrap' }}
      >
        {orderedCategories.map((cat) => {
          if (groups[cat] === 0) return null;
          return (
            <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.xs,
                  backgroundColor: accentFor(cat),
                }}
              />
              <Text
                style={{
                  fontSize: fontSize['2xs'],
                  color: m3.colorScheme.onSurfaceVariant,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {cat === 'spray'
                  ? t('explore.warehouse.cat.spray', { defaultValue: 'Spray' })
                  : cat === 'fertilizer'
                    ? t('explore.warehouse.cat.fertilizer', { defaultValue: 'Fert' })
                    : t('explore.warehouse.cat.equipment', { defaultValue: 'Equip' })}{' '}
                <Text
                  style={{
                    color: m3.colorScheme.onSurface,
                    fontWeight: fontWeight.bold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {groups[cat]}
                </Text>
                {lowGroups[cat] > 0 ? (
                  <Text
                    style={{
                      color: m3.colorScheme.error,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {' · '}
                    {t('explore.warehouse.legendLow', {
                      defaultValue: '{{count}} low',
                      count: lowGroups[cat],
                    })}
                  </Text>
                ) : null}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
