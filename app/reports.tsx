/**
 * Reports Screen
 * Generate and export farm reports as PDF or CSV
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNumber } from '@/i18n/format';

import { Symbol as Icon } from '@/components/ui/symbol';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFarms, useProfile } from '../src/hooks';
import { useReportData, useReportExport, getDefaultDateRange } from '../src/hooks/use-reports';
import { DateRange, ReportType, ReportFormat } from '../src/types/report';
import { useAuthStore } from '@/stores';
import { telemetry } from '@/services/telemetry';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

const REPORT_TYPES: { value: ReportType; labelKey: string; icon: string }[] = [
  { value: 'comprehensive', labelKey: 'reports.types.comprehensive', icon: 'doc.text.fill' },
  { value: 'operations', labelKey: 'reports.types.operations', icon: 'drop.fill' },
  { value: 'financial', labelKey: 'reports.types.financial', icon: 'dollarsign.circle.fill' },
];

export default function ReportsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const VALID_AREA_UNITS = ['acres', 'hectares'] as const;
  const rawAreaUnit = user?.user_metadata?.area_unit;
  const areaUnit = VALID_AREA_UNITS.includes(rawAreaUnit as 'acres' | 'hectares')
    ? rawAreaUnit
    : 'acres';
  const preferredCurrency = profile?.preferred_currency || 'USD';
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const [reportType, setReportType] = useState<ReportType>('comprehensive');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);

  const { preview, isLoading: dataLoading } = useReportData(selectedFarmId, dateRange);
  const { isExporting, exportReport } = useReportExport();

  // Auto-select first farm
  React.useEffect(() => {
    if (farms && farms.length > 0 && !selectedFarmId) {
      setSelectedFarmId(farms[0].id ?? null);
    }
  }, [farms, selectedFarmId]);

  const handleExport = async (format: ReportFormat) => {
    if (!preview) {
      Alert.alert(t('common.error'), t('common.errors.noReportDataAvailable'));
      return;
    }

    try {
      await exportReport(preview, format, reportType);

      // Track successful export - scope is always 'farm' since reports are generated
      // for a single selected farm, not multi-farm
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

  const handleDateChange = (type: 'from' | 'to', date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      setDateRange((prev) => ({ ...prev, [type]: dateStr }));
    }
    if (type === 'from') setShowFromPicker(false);
    if (type === 'to') setShowToPicker(false);
  };

  const selectedFarm = useMemo(() => {
    if (!farms || !selectedFarmId) return null;
    return farms.find((f) => f.id === selectedFarmId) || null;
  }, [farms, selectedFarmId]);

  if (farmsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        </View>
      </View>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3] + insets.top,
            paddingBottom: spacing[3],
            borderBottomWidth: 1,
            borderBottomColor: colors.surface[200],
            backgroundColor: colors.surface[100],
          }}
        >
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
            <Icon name="chevron.left" size={24} color={m3.colorScheme.onSurface} />
          </Pressable>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('reports.title')}
          </Text>
        </View>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}
        >
          <Icon
            name="doc.text"
            size={64}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[600],
              marginTop: spacing[4],
            }}
          >
            {t('reports.noFarms.title')}
          </Text>
          <Text style={{ color: colors.surface[500], textAlign: 'center', marginTop: spacing[2] }}>
            {t('reports.noFarms.subtitle')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3] + insets.top,
          paddingBottom: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.surface[200],
          backgroundColor: colors.surface[100],
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Icon name="chevron.left" size={24} color={m3.colorScheme.onSurface} />
        </Pressable>
        <Icon name="doc.text.fill" size={24} color={m3.colorScheme.primary} />
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: m3.colorScheme.onSurface,
            marginLeft: spacing[2],
          }}
        >
          {t('reports.title')}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Farm Selector */}
        <View
          style={{
            backgroundColor: colors.surface[100],
            marginHorizontal: spacing[4],
            marginTop: spacing[4],
            borderRadius: borderRadius.xl,
            padding: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.surface[500],
              marginBottom: spacing[2],
            }}
          >
            {t('reports.selectFarmLabel')}
          </Text>
          <Pressable
            onPress={() => setShowFarmPicker(!showFarmPicker)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.surface[50],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: colors.surface[200],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="leaf.fill" size={20} color={m3.colorScheme.primary} />
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurface,
                  marginLeft: spacing[2],
                }}
                numberOfLines={1}
              >
                {selectedFarm?.name || t('reports.selectFarmPlaceholder')}
              </Text>
            </View>
            <Icon
              name={showFarmPicker ? 'chevron.up' : 'chevron.down'}
              size={20}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
          </Pressable>

          {showFarmPicker && (
            <View
              style={{
                marginTop: spacing[2],
                borderWidth: 1,
                borderColor: colors.surface[200],
                borderRadius: borderRadius.lg,
                overflow: 'hidden',
              }}
            >
              {farms.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setSelectedFarmId(f.id ?? null);
                    setShowFarmPicker(false);
                  }}
                  style={{
                    padding: spacing[3],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[200],
                    backgroundColor:
                      f.id === selectedFarmId
                        ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                        : colors.surface[100],
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: f.id === selectedFarmId ? m3.colorScheme.primary : colors.surface[700],
                      fontWeight: f.id === selectedFarmId ? fontWeight.semibold : fontWeight.normal,
                    }}
                  >
                    {f.name} ({f.area} {t(`units.${areaUnit}`)})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Date Range */}
        <View
          style={{
            backgroundColor: colors.surface[100],
            marginHorizontal: spacing[4],
            marginTop: spacing[4],
            borderRadius: borderRadius.xl,
            padding: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            {t('reports.dateRange.label')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Pressable
              onPress={() => setShowFromPicker(true)}
              style={{
                flex: 1,
                backgroundColor: colors.surface[50],
                padding: spacing[3],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: colors.surface[500],
                  marginBottom: spacing[1],
                }}
              >
                {t('common.from')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {dateRange.from}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowToPicker(true)}
              style={{
                flex: 1,
                backgroundColor: colors.surface[50],
                padding: spacing[3],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.surface[200],
              }}
            >
              <Text
                style={{
                  fontSize: fontSize.xs,
                  color: colors.surface[500],
                  marginBottom: spacing[1],
                }}
              >
                {t('common.to')}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {dateRange.to}
              </Text>
            </Pressable>
          </View>

          {showFromPicker && (
            <DateTimePicker
              value={new Date(dateRange.from)}
              mode="date"
              display="default"
              onChange={(_, date) => handleDateChange('from', date)}
              maximumDate={new Date(dateRange.to)}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={new Date(dateRange.to)}
              mode="date"
              display="default"
              onChange={(_, date) => handleDateChange('to', date)}
              minimumDate={new Date(dateRange.from)}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Report Type */}
        <View
          style={{
            backgroundColor: colors.surface[100],
            marginHorizontal: spacing[4],
            marginTop: spacing[4],
            borderRadius: borderRadius.xl,
            padding: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            {t('reports.reportType.label')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            {REPORT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                onPress={() => setReportType(type.value)}
                style={{
                  flex: 1,
                  padding: spacing[3],
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  backgroundColor:
                    reportType === type.value
                      ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                      : colors.surface[50],
                  borderColor:
                    reportType === type.value ? m3.colorScheme.primary : colors.surface[200],
                }}
              >
                <Icon
                  name={type.icon}
                  size={24}
                  color={
                    reportType === type.value
                      ? m3.colorScheme.primary
                      : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                  }
                  style={{ alignSelf: 'center' }}
                />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    textAlign: 'center',
                    marginTop: spacing[1],
                    color: reportType === type.value ? m3.colorScheme.primary : colors.surface[600],
                    fontWeight: reportType === type.value ? fontWeight.semibold : fontWeight.normal,
                  }}
                >
                  {t(type.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Preview Summary */}
        {dataLoading ? (
          <View
            style={{
              backgroundColor: colors.surface[100],
              marginHorizontal: spacing[4],
              marginTop: spacing[4],
              borderRadius: borderRadius.xl,
              padding: spacing[6],
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="small" color={m3.colorScheme.primary} />
            <Text style={{ color: colors.surface[500], marginTop: spacing[2] }}>
              {t('reports.loading.preview')}
            </Text>
          </View>
        ) : preview ? (
          <View
            style={{
              backgroundColor: colors.surface[100],
              marginHorizontal: spacing[4],
              marginTop: spacing[4],
              borderRadius: borderRadius.xl,
              padding: spacing[4],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.medium,
                color: colors.surface[500],
                marginBottom: spacing[3],
              }}
            >
              {t('reports.preview.title')}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  padding: spacing[3],
                  borderRadius: borderRadius.lg,
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.primary,
                  }}
                >
                  {preview.summary.totalRecords}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.primary }}>
                  {t('reports.summary.totalRecords')}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.secondary, 0.12),
                  padding: spacing[3],
                  borderRadius: borderRadius.lg,
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.secondary,
                  }}
                >
                  {formatNumber(preview.summary.totalWaterUsage)}L
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.secondary }}>
                  {t('reports.summary.waterUsage')}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.12),
                  padding: spacing[3],
                  borderRadius: borderRadius.lg,
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: m3.colorScheme.tertiary,
                  }}
                >
                  {preview.summary.totalHarvest}kg
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.tertiary }}>
                  {t('reports.summary.totalHarvest')}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  padding: spacing[3],
                  borderRadius: borderRadius.lg,
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize['2xl'],
                    fontWeight: fontWeight.bold,
                    color: preview.summary.netProfit >= 0 ? colors.success : m3.colorScheme.error,
                  }}
                >
                  {formatCurrency(preview.summary.netProfit, preferredCurrency)}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: preview.summary.netProfit >= 0 ? colors.success : m3.colorScheme.error,
                  }}
                >
                  {t('reports.summary.netProfit')}
                </Text>
              </View>
            </View>

            {/* Record counts */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing[2],
                marginTop: spacing[4],
                paddingTop: spacing[4],
                borderTopWidth: 1,
                borderTopColor: colors.surface[200],
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surface[200],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[600] }}>
                  💧{' '}
                  {t('reports.preview.counts.irrigations', {
                    count: preview.summary.irrigationCount,
                  })}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.surface[200],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[600] }}>
                  🧪 {t('reports.preview.counts.sprays', { count: preview.summary.sprayCount })}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.surface[200],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[600] }}>
                  🍇 {t('reports.preview.counts.harvests', { count: preview.summary.harvestCount })}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.surface[200],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[600] }}>
                  💰 {t('reports.preview.counts.expenses', { count: preview.summary.expenseCount })}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Export Buttons */}
        <View
          style={{ marginHorizontal: spacing[4], marginTop: spacing[6], marginBottom: spacing[8] }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.medium,
              color: colors.surface[500],
              marginBottom: spacing[3],
            }}
          >
            {t('reports.exportAs')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Pressable
              onPress={() => handleExport('pdf')}
              disabled={!preview || isExporting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing[4],
                borderRadius: borderRadius.xl,
                backgroundColor:
                  !preview || isExporting ? colors.surface[200] : m3.colorScheme.error,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={m3.colorScheme.onError} />
              ) : (
                <>
                  <Icon name="doc.fill" size={24} color={m3.colorScheme.onError} />
                  <Text
                    style={{
                      color: m3.colorScheme.onError,
                      fontWeight: fontWeight.bold,
                      marginLeft: spacing[2],
                    }}
                  >
                    PDF
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => handleExport('csv')}
              disabled={!preview || isExporting}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing[4],
                borderRadius: borderRadius.xl,
                backgroundColor: !preview || isExporting ? colors.surface[200] : colors.success,
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={m3.colorScheme.onSurfaceVariant} />
              ) : (
                <>
                  <Icon
                    name="square.grid.2x2.fill"
                    size={24}
                    color={preview ? m3.colorScheme.onSurface : m3.colorScheme.onSurfaceVariant}
                  />
                  <Text
                    style={{
                      color: preview ? m3.colorScheme.onSurface : m3.colorScheme.onSurfaceVariant,
                      fontWeight: fontWeight.bold,
                      marginLeft: spacing[2],
                    }}
                  >
                    CSV
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
