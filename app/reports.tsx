/**
 * Reports Screen
 * Generate and export farm reports as PDF or CSV
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Symbol } from '@/components/ui/symbol';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useFarms, useProfile } from '@/hooks';
import {
  useReportComparison,
  useReportExport,
  getDefaultDateRange,
  clampDateRangeToSeasonBounds,
  formatReportSeasonLabel,
} from '@/hooks/use-reports';
import { DateRange, ReportFormat, ReportType } from '@/types/report';
import { useAuthStore } from '@/stores';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { resolveAreaUnitPreference } from '@/utils/preferences';
import { telemetry } from '@/services/telemetry';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import {
  ReportFiltersPanel,
  type ReportSeasonOption,
  type ReportSeasonPresetOption,
} from '@/components/screens/reports/report-filters-panel';
import { ReportExecutiveSummary } from '@/components/screens/reports/report-executive-summary';
import { ReportDocumentBody } from '@/components/screens/reports/report-document-body';
import { ReportExportActions } from '@/components/screens/reports/report-export-actions';
import type { FarmSeason } from '@/types';

const REPORT_TYPES: { value: ReportType; labelKey: string; icon: string }[] = [
  {
    value: 'comprehensive',
    labelKey: 'reports.types.comprehensive',
    icon: resolveSymbolIconName(ICON_REGISTRY.note),
  },
  {
    value: 'operations',
    labelKey: 'reports.types.operations',
    icon: resolveSymbolIconName(ICON_REGISTRY.irrigation),
  },
  {
    value: 'financial',
    labelKey: 'reports.types.financial',
    icon: resolveSymbolIconName(ICON_REGISTRY.expense),
  },
  {
    value: 'stock-usage',
    labelKey: 'reports.types.stockUsage',
    icon: resolveSymbolIconName(ICON_REGISTRY.stock),
  },
];

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
  const colors = useThemeColors();
  const m3 = useM3();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const { data: profile } = useProfile();
  const { user } = useAuthStore();

  const areaUnit = resolveAreaUnitPreference(
    profile?.area_unit_preference ?? user?.user_metadata?.area_unit,
  );

  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [reportType, setReportType] = useState<ReportType>('comprehensive');
  const [selectedExportFormat, setSelectedExportFormat] = useState<ReportFormat>('pdf');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);

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

  React.useEffect(() => {
    if (farms && farms.length > 0 && selectedFarmId == null) {
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

  const mostRecentSeason = useMemo(() => sortedSeasons[0] ?? null, [sortedSeasons]);

  const previousSeason = useMemo(() => {
    if (sortedSeasons.length < 2) return null;
    if (activeSeason) {
      return sortedSeasons.find((season) => season.end_date != null) ?? null;
    }
    return sortedSeasons[1] ?? null;
  }, [activeSeason, sortedSeasons]);

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
          startDate: season.start_date,
          endDate: season.end_date,
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

  const seasonPresetOptions = useMemo<ReportSeasonPresetOption[]>(
    () => [
      {
        key: 'active',
        labelKey: 'reports.season.presets.active',
        disabled: activeSeason == null,
      },
      {
        key: 'most-recent',
        labelKey: 'reports.season.presets.mostRecent',
        disabled: mostRecentSeason == null,
      },
      {
        key: 'previous',
        labelKey: 'reports.season.presets.previous',
        disabled: previousSeason == null,
      },
      {
        key: 'this-year',
        labelKey: 'reports.season.presets.thisYear',
      },
    ],
    [activeSeason, mostRecentSeason, previousSeason],
  );

  const applySeasonSelection = React.useCallback(
    (seasonId: number | null, setWindowRange: boolean) => {
      setSelectedSeasonId(seasonId);
      setShowSeasonPicker(false);

      if (seasonId == null) {
        if (setWindowRange) {
          const currentYear = new Date().getFullYear();
          setDateRange({
            from: `${currentYear}-01-01`,
            to: todayIso,
          });
        }
        return;
      }

      const season = sortedSeasons.find((item) => item.id === seasonId);
      if (!season || !setWindowRange) return;

      const bounds = getSeasonBounds(season, todayIso);
      if (!bounds) return;
      setDateRange(bounds);
    },
    [sortedSeasons, todayIso],
  );

  const handleApplyPreset = (preset: ReportSeasonPresetOption['key']) => {
    if (preset === 'active') {
      if (activeSeason?.id != null) {
        applySeasonSelection(activeSeason.id, true);
      }
      return;
    }

    if (preset === 'most-recent') {
      if (mostRecentSeason?.id != null) {
        applySeasonSelection(mostRecentSeason.id, true);
      }
      return;
    }

    if (preset === 'previous') {
      if (previousSeason?.id != null) {
        applySeasonSelection(previousSeason.id, true);
      }
      return;
    }

    applySeasonSelection(null, true);
  };

  const handleExport = async (format: ReportFormat) => {
    if (!preview) {
      Alert.alert(t('common.error'), t('common.errors.noReportDataAvailable'));
      return;
    }

    try {
      await exportReport(preview, format, reportType, areaUnit);
      telemetry.capture('data_exported', {
        export_type: format,
        scope: 'farm',
        farm_id: selectedFarmId,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('reports.errors.unableToExport');
      Alert.alert(t('reports.alerts.exportFailedTitle'), errorMessage);
    }
  };

  const handleDownload = async (format: ReportFormat) => {
    if (!preview) {
      Alert.alert(t('common.error'), t('common.errors.noReportDataAvailable'));
      return;
    }

    try {
      const fileUri = await downloadReport(preview, format, reportType, areaUnit);
      telemetry.capture('data_exported', {
        export_type: `${format}_download`,
        scope: 'farm',
        farm_id: selectedFarmId,
      });
      Alert.alert(
        t('reports.alerts.downloadCompleteTitle'),
        t('reports.alerts.downloadCompleteBody', { fileUri }),
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : t('reports.errors.unableToExport');
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
    backgroundColor: colors.surface[100],
    borderRadius: borderRadius.xl,
    borderCurve: 'continuous' as const,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.surface[300],
  };

  const showStickyExport = Boolean(farms && farms.length > 0);

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
                    StyleSheet.absoluteFillObject,
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
          paddingBottom: (showStickyExport ? spacing[24] : spacing[10]) + insets.bottom,
          gap: spacing[4],
        }}
      >
        {farmsLoading ? (
          <Animated.View
            entering={FadeInUp.duration(320)}
            layout={Layout.springify().damping(18)}
            style={[
              panelStyle,
              { alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
            ]}
          >
            <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          </Animated.View>
        ) : !farms || farms.length === 0 ? (
          <Animated.View
            entering={FadeInUp.duration(320)}
            layout={Layout.springify().damping(18)}
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
              areaUnit={areaUnit}
              showFarmPicker={showFarmPicker}
              onToggleFarmPicker={() => setShowFarmPicker((prev) => !prev)}
              onSelectFarm={(farmId) => {
                setSelectedFarmId(farmId);
                setSelectedSeasonId(null);
                setDateRange(getDefaultDateRange());
                setShowFarmPicker(false);
              }}
              showSeasonPicker={showSeasonPicker}
              onToggleSeasonPicker={() => setShowSeasonPicker((prev) => !prev)}
              seasonOptions={seasonOptions}
              selectedSeasonId={selectedSeasonId}
              selectedSeasonLabel={selectedSeasonLabel}
              seasonWindowLabel={selectedSeasonWindowLabel}
              onSelectSeason={(seasonId) => applySeasonSelection(seasonId, seasonId != null)}
              seasonPresetOptions={seasonPresetOptions}
              onApplySeasonPreset={handleApplyPreset}
              showNoActiveSeasonInfo={sortedSeasons.length > 0 && activeSeason == null}
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
              reportType={reportType}
              reportTypes={REPORT_TYPES}
              onSelectReportType={setReportType}
              selectedExportFormat={selectedExportFormat}
              onSelectExportFormat={setSelectedExportFormat}
              panelStyle={panelStyle}
            />

            {dataLoading ? (
              <Animated.View
                entering={FadeInUp.duration(320).delay(100)}
                layout={Layout.springify().damping(18)}
                style={[panelStyle, { alignItems: 'center', gap: spacing[2], padding: spacing[6] }]}
              >
                <ActivityIndicator size="small" color={m3.colorScheme.primary} />
                <Text selectable style={{ color: m3.colorScheme.onSurfaceVariant }}>
                  {t('reports.loading.preview')}
                </Text>
              </Animated.View>
            ) : preview ? (
              <>
                <ReportExecutiveSummary
                  preview={preview}
                  reportType={reportType}
                  preferredCurrency={user?.user_metadata?.currency_preference ?? 'INR'}
                  comparison={comparison}
                />

                <ReportDocumentBody
                  preview={preview}
                  reportType={reportType}
                  preferredCurrency={user?.user_metadata?.currency_preference ?? 'INR'}
                  panelStyle={panelStyle}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* ── Sticky bottom export bar ── */}
      {showStickyExport ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <ReportExportActions
            canExport={Boolean(preview)}
            isExporting={isExporting}
            exportFormat={selectedExportFormat}
            onExportPdf={() => handleExport(selectedExportFormat)}
            onDownload={() => handleDownload(selectedExportFormat)}
            panelStyle={{ paddingBottom: spacing[6] + insets.bottom }}
          />
        </View>
      ) : null}

      {Platform.OS !== 'ios' && showFromPicker && (
        <DateTimePicker
          value={parseDbDateToLocalDate(dateRange.from) ?? new Date()}
          mode="date"
          display="default"
          onChange={(_, date) => handleDateChange('from', date)}
          minimumDate={fromMinimumDate}
          maximumDate={fromMaximumDate}
        />
      )}

      {Platform.OS !== 'ios' && showToPicker && (
        <DateTimePicker
          value={parseDbDateToLocalDate(dateRange.to) ?? new Date()}
          mode="date"
          display="default"
          onChange={(_, date) => handleDateChange('to', date)}
          minimumDate={toMinimumDate}
          maximumDate={toMaximumDate}
        />
      )}

      {Platform.OS === 'ios' && (showFromPicker || showToPicker) && (
        <Modal
          transparent
          visible={showFromPicker || showToPicker}
          animationType="fade"
          onRequestClose={() => {
            setShowFromPicker(false);
            setShowToPicker(false);
          }}
        >
          <Pressable
            onPress={() => {
              setShowFromPicker(false);
              setShowToPicker(false);
            }}
            style={{
              flex: 1,
              backgroundColor: colorWithOpacity(m3.colorScheme.shadow, 0.4),
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderTopLeftRadius: borderRadius['3xl'],
                borderTopRightRadius: borderRadius['3xl'],
                borderCurve: 'continuous',
                padding: spacing[4],
                paddingTop: spacing[2],
                paddingBottom: spacing[4] + insets.bottom,
                gap: spacing[3],
              }}
              onStartShouldSetResponder={() => true}
            >
              {/* Sheet handle */}
              <View style={{ alignItems: 'center', paddingBottom: spacing[1] }}>
                <View
                  style={{
                    width: 36,
                    height: 5,
                    borderRadius: borderRadius.full,
                    backgroundColor: colorWithOpacity(m3.colorScheme.onSurface, 0.3),
                  }}
                />
              </View>

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
                  onChange={(_, date) => handleDateChange('from', date)}
                  minimumDate={fromMinimumDate}
                  maximumDate={fromMaximumDate}
                />
              )}
              {showToPicker && (
                <DateTimePicker
                  value={parseDbDateToLocalDate(dateRange.to) ?? new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => handleDateChange('to', date)}
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
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}
