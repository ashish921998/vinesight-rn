import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import { Spinner } from '@/components/ui/spinner';
import { useFarms, useRecentActivities } from '@/hooks';
import { useSelectedFarmStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { formatDate } from '@/i18n/format';
import { telemetry } from '@/services/telemetry';
import { QuickLogSheet, type QuickLogType } from '@/components/sheets/quick-log-sheet';
import type { LogTypeId } from '@/constants/calculator-models';

// Home screen for BOTH simplified and detailed mode. An action screen — not an
// analytics dashboard. Farm-as-title header → quick actions (log directly to
// the selected farm) → colored-dot recent activity timeline.

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

type ActivityPresentation = {
  icon: 'water' | 'spraycan' | 'basket' | 'receipt' | 'fertigation' | 'document';
  color: string;
};

export function SimplifiedHome() {
  const m3 = useM3();
  const domain = useDomainColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: farms, refetch: refetchFarms, isLoading: isLoadingFarms } = useFarms();
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

  const getActivityPresentation = (type: LogTypeId): ActivityPresentation => {
    switch (type) {
      case 'irrigation':
        return { icon: 'water', color: domain.category.irrigation };
      case 'spray':
        return { icon: 'spraycan', color: domain.category.spray };
      case 'harvest':
        return { icon: 'basket', color: domain.category.harvest };
      case 'expense':
        return { icon: 'receipt', color: domain.category.expense };
      case 'fertigation':
        return { icon: 'fertigation', color: domain.category.fertigation };
      case 'note':
        return { icon: 'document', color: domain.category.note };
      default:
        return { icon: 'document', color: m3.colorScheme.primary };
    }
  };

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
        <View style={{ paddingHorizontal: spacing[4] }}>
          {/* Header — the selected farm IS the screen title (Apple Home /
              SmartThings pattern): an "LOGGING TO" eyebrow, then the farm name as a
              big tappable title balanced on its row against a single settings gear.
              No time-of-day greeting, no green hero, no separate "Logging to" bar. */}
          <View style={{ paddingTop: insets.top + spacing[3], marginBottom: spacing[6] }}>
            {/* Eyebrow — the farm that quick logs save to. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[1],
                marginBottom: spacing[1],
              }}
            >
              <SymbolIcon name="mappin" size={13} color={m3.surface.s500} />
              <Text
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
            </View>

            {/* Title row — farm name (tap to switch/add) balanced against settings. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing[3],
              }}
            >
              <Pressable
                onPress={canSwitch ? handleSwitchFarm : goAddFarm}
                accessibilityRole="button"
                accessibilityLabel={
                  canSwitch ? t('simplifiedHome.switch') : t('simplifiedHome.addFirstFarm')
                }
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    fontSize: fontSize['3xl'],
                    fontWeight: fontWeight.bold,
                    color: m3.surface.s900,
                    letterSpacing: -0.5,
                  }}
                >
                  {selectedFarm?.name ?? t('simplifiedHome.loggingToNoFarm')}
                </Text>
                {canSwitch ? (
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.1),
                    }}
                  >
                    <SymbolIcon name="chevron.down" size={13} color={m3.colorScheme.primary} />
                  </View>
                ) : !hasFarms ? (
                  <SymbolIcon name="plus.circle.fill" size={22} color={m3.colorScheme.primary} />
                ) : null}
              </Pressable>

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
                  backgroundColor: m3.surface.s100,
                  borderWidth: 1,
                  borderColor: m3.surface.s300,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <SymbolIcon name="gearshape.fill" size={18} color={m3.surface.s700} />
              </Pressable>
            </View>
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
            {/* 2×2 grid — big targets for gloved/sunlit field use, room for a
                real label per tile (vs the old 4-across icon strip). */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              {quickActions.map((action) => (
                <Pressable
                  key={action.type}
                  onPress={() => handleQuickAction(action)}
                  accessibilityRole="button"
                  accessibilityLabel={t(action.labelKey)}
                  style={({ pressed }) => ({
                    flexBasis: '45%',
                    flexGrow: 1,
                    borderRadius: borderRadius.md,
                    padding: spacing[4],
                    backgroundColor: m3.surface.s100,
                    borderWidth: 1,
                    borderColor: m3.surface.s300,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.md,
                      backgroundColor: colorWithOpacity(action.color, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: spacing[2],
                    }}
                  >
                    <AppIcon name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: m3.surface.s900,
                    }}
                  >
                    {t(action.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Recent Activity — compact log cards, still secondary to capture actions. */}
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
              <View style={{ gap: spacing[1] }}>
                {recentActivities.map((activity) => {
                  const presentation = getActivityPresentation(activity.type);
                  const activityDate = formatDate(activity.date, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <Pressable
                      key={activity.id}
                      onPress={() => router.push(`/farm/${activity.farmId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        activity.farmName
                          ? t('dashboard.recentActivity.openFarm', { name: activity.farmName })
                          : t('dashboard.recentActivity.openFarmDetails')
                      }
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: spacing[2],
                        paddingHorizontal: spacing[2],
                        paddingVertical: spacing[2],
                        borderRadius: borderRadius.md,
                        backgroundColor: pressed ? m3.surface.s200 : m3.surface.s100,
                        borderWidth: 1,
                        borderColor: m3.surface.s200,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.md,
                          backgroundColor: colorWithOpacity(presentation.color, 0.12),
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <AppIcon name={presentation.icon} size={16} color={presentation.color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: spacing[2],
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: fontSize.sm,
                              fontWeight: fontWeight.semibold,
                              color: m3.surface.s900,
                              lineHeight: 18,
                            }}
                          >
                            {activity.description}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: fontSize.xs,
                              color: m3.surface.s500,
                              lineHeight: 17,
                              flexShrink: 0,
                            }}
                          >
                            {activityDate}
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: fontSize.xs,
                            color: m3.surface.s500,
                            lineHeight: 15,
                          }}
                        >
                          {activity.farmName}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
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
