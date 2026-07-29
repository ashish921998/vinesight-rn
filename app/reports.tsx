/**
 * Reports Screen
 * Generate and export farm reports as PDF or CSV
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, Alert, Pressable, StyleSheet, Text, Platform } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { BottomSheet } from '@expo/ui/community/bottom-sheet';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner } from '@/components/ui/spinner';
import { Symbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useFarms, useProfile } from '@/hooks';
import {
  useReportComparison,
  useReportExport,
  useUnassignedRecordCount,
  getDefaultDateRange,
  clampDateRangeToSeasonBounds,
  formatReportSeasonLabel,
} from '@/hooks/use-reports';
import {
  DateRange,
  ReportFormat,
  ReportType,
  type FpcColumnOptions,
  FPC_LEAN_COLUMNS,
} from '@/types/report';
import { useAuthStore } from '@/stores';
import { useM3 } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { resolveAreaUnitPreference } from '@/utils/preferences';
import { telemetry } from '@/services/telemetry';
import {
  ReportFiltersPanel,
  type ReportSeasonOption,
} from '@/components/screens/reports/report-filters-panel';
import { ReportExecutiveSummary } from '@/components/screens/reports/report-executive-summary';
import { ReportDocumentBody } from '@/components/screens/reports/report-document-body';
import { ReportExportActions } from '@/components/screens/reports/report-export-actions';
import { getDefaultReportFormat } from '@/components/screens/reports/report-format';
import type { FarmSeason } from '@/types';

/**
 * The on-screen report is always the comprehensive document — everything
 * logged in the window. `ReportType` exists only for the export pipeline,
 * which switches between this and the buyer's `fpc-activity` register.
 */
const REPORT_TYPE: ReportType = 'comprehensive';

function resolveSeasonEndDate(season: FarmSeason, todayIso: string): string {
  if (!season.end_date) return todayIso;
  return season.end_date > todayIso ? todayIso : season.end_date;
}

function getSeasonBounds(
  season: FarmSeason | null,
  todayIso: string,
): { from: string; to: string } | null {
  if (!season) return null;
  return {
    from: season.start_date,
    to: resolveSeasonEndDate(season, todayIso),
  };
}

export default function ReportsScreen() {
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const { data: profile } = useProfile();
  const user = useAuthStore((s) => s.user);

  const areaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );

  // A `farmId` param (e.g. opened from a farm's screen) preselects that farm so
  // reports open on the farm the user was just looking at, not an arbitrary default.
  const { farmId: farmIdParam } = useLocalSearchParams<{ farmId?: string }>();
  const initialFarmId = useMemo(() => {
    const parsed = Number(farmIdParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [farmIdParam]);

  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(initialFarmId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [fpcColumns, setFpcColumns] = useState<FpcColumnOptions>(FPC_LEAN_COLUMNS);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ReportFormat>('pdf');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const todayIso = useMemo(() => formatLocalDate(new Date()), []);

  const reportFilters = useMemo(
    () => ({
      farmId: selectedFarmId,
      dateRange,
      seasonId: selectedSeasonId ?? undefined,
      includeUnassigned: selectedSeasonId == null,
    }),
    [dateRange, selectedFarmId, selectedSeasonId],
  );

  const {
    preview,
    isLoading: dataLoading,
    seasons,
    comparison,
  } = useReportComparison(reportFilters);
  const { isExporting, exportReport, downloadReport } = useReportExport();
  // Only counted while a season filter is active — that's the only mode where
  // unassigned rows silently drop out of the totals (All seasons includes them).
  const { data: unassignedRecordCount = 0 } = useUnassignedRecordCount(
    selectedSeasonId != null ? selectedFarmId : null,
  );

  // `initialFarmId` seeds useState only on first render. If the farmId param
  // later changes while this screen stays mounted (deep link / notification
  // routing to another farm's report), re-sync so we never show stale data.
  // On mount this fires with the value useState already holds — a no-op.
  React.useEffect(() => {
    if (initialFarmId != null) {
      setSelectedFarmId(initialFarmId);
    }
  }, [initialFarmId]);

  React.useEffect(() => {
    if (!farms || farms.length === 0) return;
    // Nothing valid selected yet, or the current selection isn't among the loaded
    // farms (e.g. a stale/invalid param) → fall back to the first farm.
    const hasValidSelection = selectedFarmId != null && farms.some((f) => f.id === selectedFarmId);
    if (!hasValidSelection) {
      setSelectedFarmId(farms[0].id ?? null);
    }
  }, [farms, selectedFarmId]);

  const selectedFarm = useMemo(() => {
    if (!farms || selectedFarmId == null) return null;
    return farms.find((f) => f.id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  const sortedSeasons = useMemo(
    () =>
      [...(seasons ?? [])].sort((a, b) => {
        if (a.start_date === b.start_date) {
          return (b.id ?? 0) - (a.id ?? 0);
        }
        return b.start_date.localeCompare(a.start_date);
      }),
    [seasons],
  );

  const activeSeason = useMemo(
    () => sortedSeasons.find((season) => season.end_date == null) ?? null,
    [sortedSeasons],
  );

  const selectedSeason = useMemo(() => {
    if (selectedSeasonId == null) return null;
    return sortedSeasons.find((season) => season.id === selectedSeasonId) ?? null;
  }, [selectedSeasonId, sortedSeasons]);

  const selectedSeasonBounds = useMemo(
    () => getSeasonBounds(selectedSeason, todayIso),
    [selectedSeason, todayIso],
  );

  React.useEffect(() => {
    if (!selectedSeasonBounds) return;
    setDateRange((prev) => clampDateRangeToSeasonBounds(prev, selectedSeasonBounds));
  }, [selectedSeasonBounds]);

  React.useEffect(() => {
    if (selectedSeasonId == null) return;
    if (!selectedSeason) {
      setSelectedSeasonId(null);
    }
  }, [selectedSeason, selectedSeasonId]);

  const seasonOptions = useMemo<ReportSeasonOption[]>(
    () =>
      sortedSeasons
        .filter((season): season is FarmSeason & { id: number } => season.id != null)
        .map((season) => ({
          id: season.id,
          label: formatReportSeasonLabel(season),
          isActive: season.end_date == null,
        })),
    [sortedSeasons],
  );

  const selectedSeasonLabel = useMemo(() => {
    if (!selectedSeason) {
      return t('reports.season.allSeasons');
    }
    return formatReportSeasonLabel(selectedSeason);
  }, [selectedSeason, t]);

  const selectedSeasonWindowLabel = useMemo(() => {
    if (!selectedSeasonBounds) return null;
    return t('reports.season.window', {
      from: selectedSeasonBounds.from,
      to: selectedSeasonBounds.to,
    });
  }, [selectedSeasonBounds, t]);

  /**
   * Selecting a season also moves the window to that season's bounds — which is
   * all the former "Active / Most recent / Previous season" preset buttons did,
   * so they went away once seasons became directly selectable. Only the
   * calendar-year range survives, as `applyThisYear` below.
   */
  const applySeasonSelection = React.useCallback(
    (seasonId: number | null) => {
      setSelectedSeasonId(seasonId);
      if (seasonId == null) return;

      const season = sortedSeasons.find((item) => item.id === seasonId);
      if (!season) return;

      const bounds = getSeasonBounds(season, todayIso);
      if (bounds) setDateRange(bounds);
    },
    [sortedSeasons, todayIso],
  );

  const applyThisYear = React.useCallback(() => {
    setSelectedSeasonId(null);
    setDateRange({ from: `${new Date().getFullYear()}-01-01`, to: todayIso });
  }, [todayIso]);

  /**
   * Single export path for both destinations and both documents (the report and
   * the buyer's register). `export_type` carries the format and `destination`
   * the share/download split — previously the two were concatenated into
   * `pdf_download`, which made PostHog breakdowns unusable.
   */
  const runExport = async (
    mode: 'share' | 'download',
    format: ReportFormat,
    type: ReportType = REPORT_TYPE,
  ) => {
    if (!preview) {
      Alert.alert(t('common.error'), t('common.errors.noReportDataAvailable'));
      return;
    }

    const eventProps = {
      export_type: format,
      destination: mode,
      report_type: type,
      scope: 'farm',
      farm_id: selectedFarmId,
    };

    try {
      if (mode === 'download') {
        const fileUri = await downloadReport(preview, format, type, areaUnit, fpcColumns);
        telemetry.capture('data_exported', eventProps);
        Alert.alert(
          t('reports.alerts.downloadCompleteTitle'),
          t('reports.alerts.downloadCompleteBody', { fileUri }),
        );
        return;
      }

      await exportReport(preview, format, type, areaUnit, fpcColumns);
      telemetry.capture('data_exported', eventProps);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('reports.errors.unableToExport');
      // Name only, never the message — it can interpolate farm names and file paths.
      telemetry.capture('report_export_failed', {
        ...eventProps,
        error_name: e instanceof Error ? e.name : 'unknown',
      });
      Alert.alert(t('reports.alerts.exportFailedTitle'), errorMessage);
    }
  };

  const handleDateChange = (type: 'from' | 'to', date: Date | undefined) => {
    if (date) {
      const dateStr = formatLocalDate(date);
      setDateRange((prev) => {
        const next = {
          ...prev,
          [type]: dateStr,
        };
        return clampDateRangeToSeasonBounds(next, selectedSeasonBounds);
      });
    }

    if (Platform.OS !== 'ios') {
      if (type === 'from') setShowFromPicker(false);
      if (type === 'to') setShowToPicker(false);
    }
  };

  const fromMinimumDate = selectedSeasonBounds?.from
    ? (parseDbDateToLocalDate(selectedSeasonBounds.from) ?? undefined)
    : undefined;
  const fromMaximumIso = selectedSeasonBounds
    ? dateRange.to < selectedSeasonBounds.to
      ? dateRange.to
      : selectedSeasonBounds.to
    : dateRange.to;
  const fromMaximumDate = parseDbDateToLocalDate(fromMaximumIso) ?? undefined;

  const toMinimumIso = selectedSeasonBounds
    ? dateRange.from > selectedSeasonBounds.from
      ? dateRange.from
      : selectedSeasonBounds.from
    : dateRange.from;
  const toMinimumDate = parseDbDateToLocalDate(toMinimumIso) ?? undefined;
  const toMaximumIso = selectedSeasonBounds?.to ?? todayIso;
  const toMaximumDate = parseDbDateToLocalDate(toMaximumIso) ?? new Date();

  const panelStyle = {
    backgroundColor: m3.surface.s100,
    borderRadius: radius.lg,
    borderCurve: 'continuous' as const,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colorWithOpacity(m3.colorScheme.outlineVariant, 0.7),
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: m3.colorScheme.background }}
      edges={['left', 'right']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.goBack')}
          >
            {({ pressed }) => (
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Symbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: radius.xl,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {t('reports.title')}
            </Text>
          </View>

          <View style={{ width: 44, height: 44 }} />
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[2],
          paddingBottom: spacing[10] + insets.bottom,
          gap: spacing[5],
        }}
      >
        {farmsLoading ? (
          <Animated.View
            entering={FadeInUp.duration(320)}
            layout={Layout.springify().dampingRatio(1)}
            style={[
              panelStyle,
              { alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
            ]}
          >
            <Spinner size="large" color={m3.colorScheme.primary} />
          </Animated.View>
        ) : !farms || farms.length === 0 ? (
          <Animated.View
            entering={FadeInUp.duration(320)}
            layout={Layout.springify().dampingRatio(1)}
            style={[panelStyle, { padding: spacing[6] }]}
          >
            <Text selectable style={{ color: m3.colorScheme.onSurfaceVariant }}>
              {t('reports.noFarms.subtitle')}
            </Text>
          </Animated.View>
        ) : (
          <>
            <ReportFiltersPanel
              farms={farms}
              selectedFarmId={selectedFarmId}
              selectedFarm={selectedFarm}
              allowFarmSwitching={initialFarmId == null}
              areaUnit={areaUnit}
              onSelectFarm={(farmId) => {
                setSelectedFarmId(farmId);
                setSelectedSeasonId(null);
                setDateRange(getDefaultDateRange());
              }}
              seasonOptions={seasonOptions}
              selectedSeasonId={selectedSeasonId}
              selectedSeasonLabel={selectedSeasonLabel}
              seasonWindowLabel={selectedSeasonWindowLabel}
              onSelectSeason={applySeasonSelection}
              onApplyThisYear={applyThisYear}
              showNoActiveSeasonInfo={sortedSeasons.length > 0 && activeSeason == null}
              unassignedRecordCount={unassignedRecordCount}
              dateFrom={dateRange.from}
              dateTo={dateRange.to}
              onOpenFromDate={() => {
                setShowToPicker(false);
                setShowFromPicker(true);
              }}
              onOpenToDate={() => {
                setShowFromPicker(false);
                setShowToPicker(true);
              }}
            />

            {dataLoading ? (
              <Animated.View
                entering={FadeInUp.duration(320).delay(100)}
                layout={Layout.springify().dampingRatio(1)}
                style={[panelStyle, { alignItems: 'center', gap: spacing[2], padding: spacing[6] }]}
              >
                <Spinner size="small" color={m3.colorScheme.primary} />
                <Text selectable style={{ color: m3.colorScheme.onSurfaceVariant }}>
                  {t('reports.loading.preview')}
                </Text>
              </Animated.View>
            ) : preview ? (
              <>
                <ReportExecutiveSummary
                  preview={preview}
                  preferredCurrency={user?.user_metadata?.currency_preference ?? 'INR'}
                  comparison={comparison}
                />

                <ReportExportActions
                  canExport={Boolean(preview)}
                  isExporting={isExporting}
                  exportFormat={selectedExportFormat}
                  onSelectFormat={setSelectedExportFormat}
                  onShare={() => runExport('share', selectedExportFormat)}
                  onDownload={() => runExport('download', selectedExportFormat)}
                  panelStyle={panelStyle}
                />

                <ReportDocumentBody
                  preview={preview}
                  reportType={REPORT_TYPE}
                  preferredCurrency={user?.user_metadata?.currency_preference ?? 'INR'}
                  fpcColumns={fpcColumns}
                  onFpcColumnsChange={setFpcColumns}
                  // The register is a separate document for a separate reader, so
                  // it exports from its own section rather than the report's bar,
                  // in the format buyers actually consume.
                  onExportRegister={() =>
                    runExport('share', getDefaultReportFormat('fpc-activity'), 'fpc-activity')
                  }
                  panelStyle={panelStyle}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {Platform.OS !== 'ios' && showFromPicker && (
        <DateTimePicker
          value={parseDbDateToLocalDate(dateRange.from) ?? new Date()}
          mode="date"
          display="default"
          onValueChange={(_, date) => handleDateChange('from', date)}
          minimumDate={fromMinimumDate}
          maximumDate={fromMaximumDate}
        />
      )}

      {Platform.OS !== 'ios' && showToPicker && (
        <DateTimePicker
          value={parseDbDateToLocalDate(dateRange.to) ?? new Date()}
          mode="date"
          display="default"
          onValueChange={(_, date) => handleDateChange('to', date)}
          minimumDate={toMinimumDate}
          maximumDate={toMaximumDate}
        />
      )}

      {Platform.OS === 'ios' && (showFromPicker || showToPicker) && (
        <BottomSheet
          index={0}
          enableDynamicSizing
          enablePanDownToClose
          onClose={() => {
            setShowFromPicker(false);
            setShowToPicker(false);
          }}
          backgroundStyle={{ backgroundColor: m3.surface.s100 }}
        >
          <View
            style={{
              padding: spacing[4],
              paddingTop: spacing[2],
              paddingBottom: spacing[4] + insets.bottom,
              gap: spacing[3],
            }}
          >
            <Text
              selectable
              style={{
                color: m3.colorScheme.onSurface,
                fontWeight: '600',
                fontSize: fontSize.lg,
              }}
            >
              {showFromPicker ? t('reports.selectFromDate') : t('reports.selectToDate')}
            </Text>

            {showFromPicker && (
              <DateTimePicker
                value={parseDbDateToLocalDate(dateRange.from) ?? new Date()}
                mode="date"
                display="spinner"
                onValueChange={(_, date) => handleDateChange('from', date)}
                minimumDate={fromMinimumDate}
                maximumDate={fromMaximumDate}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={parseDbDateToLocalDate(dateRange.to) ?? new Date()}
                mode="date"
                display="spinner"
                onValueChange={(_, date) => handleDateChange('to', date)}
                minimumDate={toMinimumDate}
                maximumDate={toMaximumDate}
              />
            )}

            <Pressable
              onPress={() => {
                setShowFromPicker(false);
                setShowToPicker(false);
              }}
              style={{
                paddingVertical: spacing[3],
                borderRadius: borderRadius.xl,
                borderCurve: 'continuous',
                alignItems: 'center',
                backgroundColor: m3.colorScheme.primary,
              }}
            >
              <Text selectable style={{ fontWeight: '600', color: m3.colorScheme.onPrimary }}>
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}
