import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { AppIcon } from '@/components/ui/app-icon';
import { OptionPickerSheet } from '@/components/ui/option-picker-sheet';
import { useFarms, useRecentActivities, useLogPresentation } from '@/hooks';
import type { RecentActivity } from '@/hooks';
import { getDataAccess } from '@/data-access';
import type { Farm } from '@/types';
import { useSelectedFarmStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { telemetry } from '@/services/telemetry';
import { toast } from '@/components/ui/toast';
import {
  QuickLogSheet,
  isQuickLogType,
  type QuickLogEditTarget,
  type QuickLogType,
} from '@/components/sheets/quick-log-sheet';
import { RecentActivityList } from './recent-activity';

// Home screen for BOTH simplified and detailed mode. An action screen — not an
// analytics dashboard. Farm-as-title header → quick actions (log directly to
// the selected farm) → colored-dot recent activity timeline.

const ANALYTICS_BASE = { app_mode: 'simplified', surface: 'home' } as const;
const RECENT_LIMIT = 6;

// The four prime quick-log slots. Icon, color and label are NOT duplicated here
// — all three are derived from the canonical log-type presentation
// (useLogPresentation) at render time, so the grid and the recent-activity list
// can never disagree.
const QUICK_ACTIONS: readonly QuickLogType[] = ['irrigation', 'spray', 'harvest', 'expense'];

export function SimplifiedHome() {
  const m3 = useM3();
  const presentation = useLogPresentation();
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
  const [editTarget, setEditTarget] = useState<QuickLogEditTarget | null>(null);
  // Farm resolved for the edit target — kept separate from the global
  // selected-farm store so editing a log from another farm doesn't switch
  // the dashboard's default quick-log target.
  const [editFarm, setEditFarm] = useState<Farm | null>(null);

  // Sheet-intent guard: bumped on every action that changes what the sheet
  // should show (edit fetch, quick-add, close). An async edit captures the
  // value and bails if it changed by the time the fetch resolves — so a stale
  // fetch can no longer clobber a newer tap.
  const sheetIntentId = useRef(0);

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
    sheetIntentId.current += 1;
    telemetry.capture('add_farm_tapped', ANALYTICS_BASE);
    router.push('/farm/add');
  };

  const handleSwitchFarm = () => {
    sheetIntentId.current += 1;
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
  const handleQuickAction = (type: QuickLogType) => {
    if (!hasFarms || !selectedFarm?.id) {
      goAddFarm();
      return;
    }
    telemetry.capture('quick_action_tapped', { ...ANALYTICS_BASE, action: type });
    // Clear any in-flight edit target so a quick-add can't reopen on the edit path.
    sheetIntentId.current += 1;
    setEditTarget(null);
    setQuickLogType(type);
  };

  // Tapping a recent-activity row fetches the full record by ID and opens the
  // edit QuickLogSheet inline for the four quick types. Fertigation/note fall
  // back to the farm details page.
  const handleEditActivity = async (activity: RecentActivity) => {
    const numericId = Number(activity.id.split('_')[1]);
    if (!numericId || !isQuickLogType(activity.type)) {
      sheetIntentId.current += 1;
      router.push(`/farm/${activity.farmId}`);
      return;
    }

    const table =
      activity.type === 'irrigation'
        ? 'irrigation_records'
        : activity.type === 'spray'
          ? 'spray_records'
          : activity.type === 'harvest'
            ? 'harvest_records'
            : 'expense_records';

    // Claim the sheet for this edit; if any newer tap bumps the counter
    // before the fetch resolves, drop this stale result.
    const myIntentId = (sheetIntentId.current += 1);

    const { data, error } = await getDataAccess()
      .from(table)
      .select('*')
      .eq('id', numericId)
      .maybeSingle();

    // A newer tap (quick-add, another edit, or close) wins — don't reopen.
    if (myIntentId !== sheetIntentId.current) return;

    if (error || !data) {
      router.push(`/farm/${activity.farmId}`);
      return;
    }

    // Farm must still be in the current list. A stale recent-activity or lost
    // access means per-acre/PHI derivations and linked-fertigation create would
    // silently fall back to the selected farm — refuse rather than corrupt.
    const farm = farms?.find((f) => f.id === activity.farmId) ?? null;
    if (!farm) {
      toast.error(t('simplifiedHome.editFarmUnavailable'));
      return;
    }

    setEditTarget({ type: activity.type, record: data } as QuickLogEditTarget);
    setQuickLogType(activity.type);
    setEditFarm(farm);
  };

  const farmOptions = useMemo(
    () =>
      (farms ?? [])
        .filter((farm) => farm.id != null)
        .map((farm) => ({ key: String(farm.id), label: farm.name })),
    [farms],
  );

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
                onPress={() => {
                  sheetIntentId.current += 1;
                  router.push('/app-settings');
                }}
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

          {/* Quick actions — four domain-colored tiles that log direct to the
              farm named above. No section heading: the tiles read as the
              screen's purpose, and one less line of chrome is one less thing to
              parse in the field. 2×2 grid keeps targets big for gloved/sunlit
              use, with the icon and label side by side so the label gets the
              full tile width in Marathi/Hindi. */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing[3],
              marginBottom: spacing[6],
            }}
          >
            {QUICK_ACTIONS.map((type) => {
              const p = presentation[type];
              return (
                <Pressable
                  key={type}
                  onPress={() => handleQuickAction(type)}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  style={({ pressed }) => ({
                    flexBasis: '45%',
                    flexGrow: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[4],
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
                      backgroundColor: colorWithOpacity(p.color, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AppIcon name={p.icon} size={24} color={p.color} />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.semibold,
                      color: m3.surface.s900,
                    }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Recent Activity — compact log cards, still secondary to capture actions. */}
          <RecentActivityList
            activities={recentActivities}
            isLoading={isLoadingActivities || isLoadingFarms}
            hasFarms={hasFarms}
            showFarmName={canSwitch}
            onEditActivity={handleEditActivity}
            onViewAll={() => {
              sheetIntentId.current += 1;
              router.push('/logs');
            }}
          />
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

      {/* Single-log quick sheet — one bottom sheet per log type.
          Add mode: quickLogType only. Edit mode: editTarget set. */}
      <QuickLogSheet
        type={quickLogType}
        // editFarm is non-null in edit mode — handleEditActivity guards against
        // a missing farm and bails before opening. The ?? selectedFarm fallback
        // is defensive only (keeps the farm: Farm | null type satisfied).
        farm={editTarget ? (editFarm ?? selectedFarm) : selectedFarm}
        editTarget={editTarget}
        onClose={() => {
          // Bump so any in-flight edit fetch can't reopen the sheet after close.
          sheetIntentId.current += 1;
          setQuickLogType(null);
          setEditTarget(null);
          setEditFarm(null);
        }}
      />
    </View>
  );
}
