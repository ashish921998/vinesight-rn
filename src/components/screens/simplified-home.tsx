import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import { useFarms, useRecentActivities, useWarehouseItems, useCurrency } from '@/hooks';
import { useModalStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatCurrency, formatDate, formatNumber } from '@/i18n/format';
import { createAddLogHref } from '@/utils/add-log-navigation';
import { telemetry } from '@/services/telemetry';
import type { WarehouseItem } from '@/types';

// Simplified-mode Home. An action screen — not an analytics dashboard.
// Two dominant actions (Record Purchase, Add Farm Log) over a compact combined
// timeline of recent purchases and farm logs. Detailed mode keeps its own
// dashboard (see app/(tabs)/index.tsx).

const ANALYTICS_BASE = { app_mode: 'simplified', surface: 'home' } as const;
const RECENT_LIMIT = 8;

type RecentRow = {
  key: string;
  kind: 'purchase' | 'log';
  title: string;
  subtitle: string | null;
  trailing: string | null;
  date: string;
  color: string;
  onPress: () => void;
};

export function SimplifiedHome() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currency = useCurrency();
  const { setAddWarehouseItem } = useModalStore();

  const { data: farms, refetch: refetchFarms } = useFarms();
  const { data: recentActivities, refetch: refetchActivities } = useRecentActivities(RECENT_LIMIT);
  const { data: warehouseItems, refetch: refetchWarehouse } = useWarehouseItems();

  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasFarms = Boolean(farms && farms.length > 0);

  useEffect(() => {
    telemetry.capture('simplified_home_viewed', ANALYTICS_BASE);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchFarms(), refetchActivities(), refetchWarehouse()]);
    } finally {
      // Always clear the spinner — a rejected refetch must not leave it stuck.
      setIsRefreshing(false);
    }
  };

  const openPurchaseForm = (item: WarehouseItem | null) => {
    setAddWarehouseItem({ editingItem: item });
    router.push('/add-warehouse-item');
  };

  const handleRecordPurchase = () => {
    telemetry.capture('record_purchase_tapped', ANALYTICS_BASE);
    openPurchaseForm(null);
  };

  const startLogForFarm = (farmId: number) => {
    router.push(createAddLogHref({ farmId }));
  };

  const handleAddFarmLog = () => {
    if (!hasFarms) {
      // No farm yet — the log flow needs one. Route straight to add-farm.
      telemetry.capture('add_farm_tapped', ANALYTICS_BASE);
      router.push('/farm/add');
      return;
    }
    telemetry.capture('add_farm_log_tapped', ANALYTICS_BASE);
    if (farms && farms.length === 1 && farms[0].id != null) {
      startLogForFarm(farms[0].id);
      return;
    }
    setShowFarmPicker(true);
  };

  const handleFarmSelected = (farmId: number) => {
    setShowFarmPicker(false);
    startLogForFarm(farmId);
  };

  const farmOptions = useMemo(
    () =>
      (farms ?? [])
        .filter((farm) => farm.id != null)
        .map((farm) => ({ key: String(farm.id), label: farm.name })),
    [farms],
  );

  // Combined recent timeline: farm logs (already sorted) merged with recent
  // purchases by date. Lazy path per handoff — no new unified backend model.
  const recentRows = useMemo<RecentRow[]>(() => {
    const logRows: RecentRow[] = (recentActivities ?? []).map((a) => ({
      key: `log_${a.id}`,
      kind: 'log',
      title: a.description,
      subtitle: a.farmName,
      trailing: null,
      date: a.date,
      color:
        a.type === 'irrigation'
          ? domain.category.irrigation
          : a.type === 'expense'
            ? domain.category.expense
            : a.type === 'spray'
              ? domain.category.spray
              : a.type === 'note'
                ? domain.category.labour
                : m3.colorScheme.primary,
      onPress: () => router.push(`/farm/${a.farmId}`),
    }));

    const purchaseRows: RecentRow[] = [...(warehouseItems ?? [])]
      .filter((item) => Boolean(item.created_at))
      .sort(
        (x, y) =>
          new Date(y.created_at as string).getTime() - new Date(x.created_at as string).getTime(),
      )
      .slice(0, RECENT_LIMIT)
      .map((item) => ({
        key: `purchase_${item.id}`,
        kind: 'purchase',
        title: item.name,
        subtitle: `${formatNumber(item.quantity, { maximumFractionDigits: 2 })} ${item.unit}`,
        trailing:
          item.unit_price > 0
            ? formatCurrency(item.quantity * item.unit_price, currency, {
                minimumFractionDigits: 0,
              })
            : null,
        date: item.created_at as string,
        color: domain.category.expense,
        onPress: () => openPurchaseForm(item),
      }));

    return [...logRows, ...purchaseRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, RECENT_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentActivities, warehouseItems, currency, domain, m3.colorScheme.primary]);

  const actionButtonStyle = (bg: string): ViewStyle => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: 72,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: bg,
  });

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
      {/* Compact header with settings access */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[3],
          paddingHorizontal: spacing[4],
          backgroundColor: m3.colorScheme.surface,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: m3.surface.s900,
            letterSpacing: -0.3,
          }}
        >
          {t('app.name', { defaultValue: 'VineSight' })}
        </Text>
        <Pressable
          onPress={() => router.push('/app-settings')}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.settingsGearA11y')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? m3.surface.s200 : m3.surface.s100,
            borderWidth: 1,
            borderColor: m3.surface.s300,
          })}
        >
          <SymbolIcon name="gearshape.fill" size={18} color={m3.surface.s700} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: Math.max(insets.bottom + spacing[12], spacing[16]),
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={m3.colorScheme.primary}
          />
        }
      >
        {/* Primary actions */}
        <View style={{ gap: spacing[3], marginBottom: spacing[7] }}>
          <Pressable
            onPress={handleRecordPurchase}
            accessibilityRole="button"
            accessibilityLabel={t('simplifiedHome.recordPurchase')}
            style={({ pressed }) => [
              actionButtonStyle(m3.colorScheme.primary),
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity('#ffffff', 0.2),
              }}
            >
              <SymbolIcon name="cart.fill" size={22} color="#ffffff" />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: m3.colorScheme.onPrimary,
              }}
            >
              {t('simplifiedHome.recordPurchase')}
            </Text>
            <SymbolIcon name="chevron.right" size={18} color={colorWithOpacity('#ffffff', 0.8)} />
          </Pressable>

          <Pressable
            onPress={handleAddFarmLog}
            accessibilityRole="button"
            accessibilityLabel={
              hasFarms ? t('simplifiedHome.addFarmLog') : t('simplifiedHome.addFirstFarm')
            }
            style={({ pressed }) => [
              actionButtonStyle(m3.surface.s100),
              {
                opacity: pressed ? 0.9 : 1,
                borderWidth: 1,
                borderColor: m3.surface.s300,
              },
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              }}
            >
              <SymbolIcon
                name={hasFarms ? 'square.and.pencil' : 'plus'}
                size={22}
                color={m3.colorScheme.primary}
              />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: m3.surface.s900,
              }}
            >
              {hasFarms ? t('simplifiedHome.addFarmLog') : t('simplifiedHome.addFirstFarm')}
            </Text>
            <SymbolIcon name="chevron.right" size={18} color={m3.surface.s400} />
          </Pressable>
        </View>

        {/* Recent records */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[2],
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.surface.s900,
            }}
          >
            {t('simplifiedHome.recentRecords')}
          </Text>
          {recentRows.length > 0 ? (
            <Pressable
              onPress={() => router.push('/logs')}
              accessibilityRole="button"
              accessibilityLabel={t('simplifiedHome.viewAll')}
              hitSlop={8}
            >
              <Text
                style={{
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.primary,
                }}
              >
                {t('simplifiedHome.viewAll')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {recentRows.length > 0 ? (
          <View style={{ borderTopWidth: 1, borderTopColor: m3.surface.s200 }}>
            {recentRows.map((row, index) => (
              <Pressable
                key={row.key}
                onPress={row.onPress}
                accessibilityRole="button"
                accessibilityLabel={row.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                  paddingVertical: spacing[3],
                  minHeight: 48,
                  borderBottomWidth: index < recentRows.length - 1 ? 1 : 0,
                  borderBottomColor: m3.surface.s200,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colorWithOpacity(row.color, 0.14),
                    flexShrink: 0,
                  }}
                >
                  <SymbolIcon
                    name={row.kind === 'purchase' ? 'cart.fill' : 'leaf.fill'}
                    size={16}
                    color={row.color}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: m3.surface.s900,
                      lineHeight: 20,
                    }}
                  >
                    {row.title}
                  </Text>
                  {row.subtitle ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: fontSize.xs, color: m3.surface.s500, lineHeight: 16 }}
                    >
                      {row.subtitle}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                  {row.trailing ? (
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                        color: m3.surface.s900,
                      }}
                    >
                      {row.trailing}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: fontSize.xs, color: m3.surface.s400 }}>
                    {formatDate(row.date, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View
            style={{
              borderRadius: borderRadius.md,
              padding: spacing[6],
              alignItems: 'center',
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: m3.surface.s300,
            }}
          >
            <SymbolIcon name="clock" size={40} color={m3.surface.s400} />
            <Text
              style={{
                textAlign: 'center',
                marginTop: spacing[3],
                fontSize: fontSize.sm,
                color: m3.surface.s500,
              }}
            >
              {t('simplifiedHome.noRecords')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Farm picker — only reached with 2+ farms. Expo UI bottom sheet. */}
      <OptionPickerSheet
        visible={showFarmPicker}
        onClose={() => setShowFarmPicker(false)}
        onSelect={(key) => handleFarmSelected(Number(key))}
        title={t('dashboard.farmPicker.title')}
        options={farmOptions}
      />
    </View>
  );
}
