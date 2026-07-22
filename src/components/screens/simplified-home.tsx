import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import { Spinner } from '@/components/ui/spinner';
import { useFarms, useProfile, useRecentActivities } from '@/hooks';
import { useSelectedFarmStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { getGreetingKey } from '@/utils/greeting';
import { telemetry } from '@/services/telemetry';
import { QuickLogSheet, type QuickLogType } from '@/components/sheets/quick-log-sheet';
import type { LogTypeId } from '@/constants/calculator-models';

// Simplified-mode Home. An action screen — not an analytics dashboard.
// Green hero → "Logging to" context bar → quick actions (log directly to the
// selected farm) → colored-dot recent activity timeline. Detailed mode keeps
// its own dashboard (see app/(tabs)/index.tsx).

const ANALYTICS_BASE = { app_mode: 'simplified', surface: 'home' } as const;
const RECENT_LIMIT = 6;

type QuickAction = {
  type: Extract<LogTypeId, 'irrigation' | 'spray' | 'harvest' | 'expense'>;
  icon: 'water' | 'spraycan' | 'basket' | 'receipt';
  color: string;
  labelKey:
    | 'dashboard.quickActions.irrigation'
    | 'dashboard.quickActions.spray'
    | 'dashboard.quickActions.harvest'
    | 'dashboard.quickActions.expense';
};

export function SimplifiedHome() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: farms, refetch: refetchFarms, isLoading: isLoadingFarms } = useFarms();
  const { data: profile } = useProfile();
  const {
    data: recentActivities,
    refetch: refetchActivities,
    isLoading: isLoadingActivities,
  } = useRecentActivities(RECENT_LIMIT);

  const selectedFarmId = useSelectedFarmStore((s) => s.farmId);
  const selectedFarmHydrated = useSelectedFarmStore((s) => s.hydrated);
  const setFarmId = useSelectedFarmStore((s) => s.setFarmId);

  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quickLogType, setQuickLogType] = useState<QuickLogType | null>(null);

  // Resolve the selected farm against the live list — a persisted id may be
  // stale (deleted farm). Falls back to the first farm, then null.
  const selectedFarm = useMemo(() => {
    if (!selectedFarmHydrated) return null;
    if (!farms || farms.length === 0) return null;
    return farms.find((f) => f.id === selectedFarmId) ?? farms[0];
  }, [farms, selectedFarmHydrated, selectedFarmId]);

  const hasFarms = selectedFarmHydrated && Boolean(farms && farms.length > 0);
  const canSwitch = selectedFarmHydrated && Boolean(farms && farms.length > 1);
  const greetingKey = getGreetingKey();

  useEffect(() => {
    telemetry.capture('simplified_home_viewed', ANALYTICS_BASE);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchFarms(), refetchActivities()]);
    } finally {
      // Always clear the spinner — a rejected refetch must not leave it stuck.
      setIsRefreshing(false);
    }
  };

  const goAddFarm = () => {
    telemetry.capture('add_farm_tapped', ANALYTICS_BASE);
    router.push('/farm/add');
  };

  const handleSwitchFarm = () => {
    telemetry.capture('farm_switch_tapped', ANALYTICS_BASE);
    setShowFarmPicker(true);
  };

  const handleFarmSelected = (key: string) => {
    const id = Number(key);
    setFarmId(id);
    telemetry.capture('farm_switched', { ...ANALYTICS_BASE, farm_id: id });
  };

  // Quick actions log DIRECTLY to the selected farm — no per-action picker.
  // Each action opens a focused single-log sheet. Notes remain available in the
  // full add-entry flow; the four prime dashboard slots are operational logs.
  const handleQuickAction = (action: QuickAction) => {
    if (!hasFarms || !selectedFarm?.id) {
      goAddFarm();
      return;
    }
    telemetry.capture('quick_action_tapped', { ...ANALYTICS_BASE, action: action.type });
    setQuickLogType(action.type);
  };

  const farmOptions = useMemo(
    () =>
      (farms ?? [])
        .filter((farm) => farm.id != null)
        .map((farm) => ({ key: String(farm.id), label: farm.name })),
    [farms],
  );

  const quickActions: QuickAction[] = [
    {
      type: 'irrigation',
      icon: 'water',
      color: domain.category.irrigation,
      labelKey: 'dashboard.quickActions.irrigation',
    },
    {
      type: 'spray',
      icon: 'spraycan',
      color: domain.category.spray,
      labelKey: 'dashboard.quickActions.spray',
    },
    {
      type: 'harvest',
      icon: 'basket',
      color: domain.category.harvest,
      labelKey: 'dashboard.quickActions.harvest',
    },
    {
      type: 'expense',
      icon: 'receipt',
      color: domain.category.expense,
      labelKey: 'dashboard.quickActions.expense',
    },
  ];

  const bottomPadding = Math.max(insets.bottom + spacing[12], spacing[16]);

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.surface }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={m3.colorScheme.primary}
          />
        }
      >
        {/* Hero — green header with brand, greeting, and settings. */}
        <View
          style={{
            backgroundColor: m3.colorScheme.primary,
            paddingTop: insets.top + spacing[3],
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[5],
            borderBottomLeftRadius: borderRadius.lg,
            borderBottomRightRadius: borderRadius.lg,
            marginBottom: spacing[5],
          }}
        >
          {/* Top bar: avatar + brand (left), settings gear (right) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[3],
              marginBottom: spacing[4],
            }}
          >
            <Pressable
              onPress={() => router.push('/app-settings')}
              accessibilityRole="button"
              accessibilityLabel={t('assistant.settingsButtonA11y')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                minWidth: 0,
                gap: spacing[3],
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: radius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colorWithOpacity('#ffffff', 0.2),
                  borderWidth: 1,
                  borderColor: colorWithOpacity('#ffffff', 0.28),
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: '#ffffff',
                    letterSpacing: 0.2,
                  }}
                >
                  {(profile?.full_name?.trim()?.charAt(0) || 'V').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.xl,
                    color: '#ffffff',
                    fontWeight: fontWeight.semibold,
                    letterSpacing: -0.3,
                    lineHeight: 25,
                  }}
                >
                  {t('app.name', { defaultValue: 'VineSight' })}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/app-settings')}
              accessibilityRole="button"
              accessibilityLabel={t('assistant.settingsGearA11y')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colorWithOpacity('#ffffff', pressed ? 0.28 : 0.16),
                borderWidth: 1,
                borderColor: colorWithOpacity('#ffffff', 0.2),
              })}
            >
              <SymbolIcon name="gearshape.fill" size={17} color="#ffffff" />
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.normal,
              color: '#ffffff',
              lineHeight: 30,
            }}
          >
            {profile?.full_name
              ? t(`dashboard.greetingWithName.${greetingKey}`, { name: profile.full_name })
              : t(`dashboard.greeting.${greetingKey}`)}
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing[4] }}>
          {/* "Logging to" context bar — surfaces the selected farm and a Switch
              affordance. Quick actions below log to this farm without a picker. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing[3],
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              borderRadius: borderRadius.md,
              backgroundColor: m3.surface.s100,
              borderWidth: 1,
              borderColor: m3.surface.s300,
              marginBottom: spacing[5],
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[2],
              }}
            >
              <SymbolIcon name="mappin" size={16} color={m3.surface.s500} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s500,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('simplifiedHome.loggingTo')}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: m3.surface.s900,
                  }}
                >
                  {selectedFarm?.name ?? t('simplifiedHome.loggingToNoFarm')}
                </Text>
              </View>
            </View>
            {canSwitch ? (
              <Pressable
                onPress={handleSwitchFarm}
                accessibilityRole="button"
                accessibilityLabel={t('simplifiedHome.switch')}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radius.md,
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, pressed ? 0.16 : 0.1),
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <SymbolIcon
                  name="arrow.left.arrow.right"
                  size={14}
                  color={m3.colorScheme.primary}
                />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.primary,
                  }}
                >
                  {t('simplifiedHome.switch')}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={goAddFarm}
                accessibilityRole="button"
                accessibilityLabel={t('simplifiedHome.addFirstFarm')}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radius.md,
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, pressed ? 0.16 : 0.1),
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <SymbolIcon name="plus" size={14} color={m3.colorScheme.primary} />
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: m3.colorScheme.primary,
                  }}
                >
                  {t('dashboard.cta.addFirstFarm')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Quick Actions — four domain-colored buttons. Log direct to farm. */}
          <View style={{ marginBottom: spacing[6] }}>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.semibold,
                marginBottom: spacing[3],
                color: m3.surface.s900,
              }}
            >
              {t('dashboard.quickActions.title')}
            </Text>
            <View
              style={{
                borderRadius: borderRadius.md,
                padding: spacing[4],
                paddingHorizontal: spacing[3],
                backgroundColor: m3.surface.s100,
                borderWidth: 1,
                borderColor: m3.surface.s300,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {quickActions.map((action) => (
                  <Pressable
                    key={action.type}
                    onPress={() => handleQuickAction(action)}
                    style={{ alignItems: 'center', minWidth: 68 }}
                    accessibilityRole="button"
                    accessibilityLabel={t(action.labelKey)}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        backgroundColor: colorWithOpacity(action.color, 0.12),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <AppIcon name={action.icon} size={20} color={action.color} />
                    </View>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color: m3.surface.s500,
                        marginTop: spacing[1] + 2,
                      }}
                    >
                      {t(action.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Recent Activity — colored-dot timeline (logs only). */}
          <View style={{ marginBottom: spacing[6] }}>
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
                {t('dashboard.recentActivity.title')}
              </Text>
              {recentActivities && recentActivities.length > 0 ? (
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

            {isLoadingActivities || isLoadingFarms ? (
              <View
                style={{
                  borderRadius: borderRadius.md,
                  padding: spacing[8],
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                }}
              >
                <Spinner color={m3.colorScheme.primary} />
              </View>
            ) : recentActivities && recentActivities.length > 0 ? (
              <View style={{ borderTopWidth: 1, borderTopColor: m3.surface.s200 }}>
                {recentActivities.map((activity, index) => (
                  <Pressable
                    key={activity.id}
                    onPress={() => router.push(`/farm/${activity.farmId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      activity.farmName
                        ? t('dashboard.recentActivity.openFarm', { name: activity.farmName })
                        : t('dashboard.recentActivity.openFarmDetails')
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[3],
                      paddingVertical: spacing[3],
                      borderBottomWidth: index < recentActivities.length - 1 ? 1 : 0,
                      borderBottomColor: m3.surface.s200,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: radius.xs,
                        backgroundColor:
                          activity.type === 'irrigation'
                            ? domain.category.irrigation
                            : activity.type === 'expense'
                              ? domain.category.expense
                              : activity.type === 'spray'
                                ? domain.category.spray
                                : activity.type === 'harvest'
                                  ? domain.category.harvest
                                  : activity.type === 'note'
                                    ? domain.category.labour
                                    : m3.colorScheme.primary,
                        flexShrink: 0,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: m3.surface.s900,
                          lineHeight: 20,
                        }}
                      >
                        {activity.description}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.surface.s500,
                          lineHeight: 16,
                        }}
                      >
                        {activity.farmName}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fontSize.xs, color: m3.surface.s400, flexShrink: 0 }}>
                      {formatDate(activity.date, { month: 'short', day: 'numeric' })}
                    </Text>
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
                <SymbolIcon name="clock" size={48} color={m3.surface.s400} />
                <Text
                  style={{
                    textAlign: 'center',
                    marginTop: spacing[3],
                    fontSize: fontSize.sm,
                    color: m3.surface.s500,
                  }}
                >
                  {hasFarms ? t('dashboard.empty.recentActivity') : t('dashboard.empty.noFarms')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Farm picker — only reached with 2+ farms. Persists the selection. */}
      <OptionPickerSheet
        visible={showFarmPicker}
        onClose={() => setShowFarmPicker(false)}
        onSelect={handleFarmSelected}
        selectedKey={selectedFarm?.id != null ? String(selectedFarm.id) : null}
        title={t('dashboard.farmPicker.title')}
        options={farmOptions}
      />

      {/* Single-log quick sheet — one bottom sheet per log type. */}
      <QuickLogSheet
        type={quickLogType}
        farm={selectedFarm}
        onClose={() => setQuickLogType(null)}
      />
    </View>
  );
}
