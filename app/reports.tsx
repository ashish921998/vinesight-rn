/**
 * Reports Screen
 * Generate and export farm reports as PDF or CSV
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Symbol as Icon } from '@/components/ui/symbol';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFarms } from '../src/hooks';
import { useReportData, useReportExport, getDefaultDateRange } from '../src/hooks/use-reports';
import { DateRange, ReportType, ReportFormat } from '../src/types/report';

const REPORT_TYPES: { value: ReportType; label: string; icon: string }[] = [
  { value: 'comprehensive', label: 'Comprehensive', icon: 'doc.text.fill' },
  { value: 'operations', label: 'Operations', icon: 'drop.fill' },
  { value: 'financial', label: 'Financial', icon: 'dollarsign.circle.fill' },
];

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { data: farms, isLoading: farmsLoading } = useFarms();
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
      Alert.alert('Error', 'No report data available');
      return;
    }

    try {
      await exportReport(preview, format, reportType);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unable to export report';
      Alert.alert('Export Failed', errorMessage);
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
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#1a5d1a" />
        </View>
      </View>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3] + insets.top,
            paddingBottom: spacing[3],
            borderBottomWidth: 1,
            borderBottomColor: colors.gray[200],
            backgroundColor: colors.white,
          }}
        >
          <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
            <Icon name="chevron.left" size={24} color="#333" />
          </Pressable>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: colors.gray[800],
            }}
          >
            Reports
          </Text>
        </View>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] }}
        >
          <Icon name="doc.text" size={64} color="#9ca3af" />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.gray[600],
              marginTop: spacing[4],
            }}
          >
            No Farms Found
          </Text>
          <Text style={{ color: colors.gray[500], textAlign: 'center', marginTop: spacing[2] }}>
            Add a farm first to generate reports
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3] + insets.top,
          paddingBottom: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
          backgroundColor: colors.white,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Icon name="chevron.left" size={24} color="#333" />
        </Pressable>
        <Icon name="doc.text.fill" size={24} color="#1a5d1a" />
        <Text
          style={{
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.gray[800],
            marginLeft: spacing[2],
          }}
        >
          Reports
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Farm Selector */}
        <View
          style={{
            backgroundColor: colors.white,
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
              color: colors.gray[500],
              marginBottom: spacing[2],
            }}
          >
            Select Farm
          </Text>
          <Pressable
            onPress={() => setShowFarmPicker(!showFarmPicker)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.gray[50],
              padding: spacing[3],
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: colors.gray[200],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Icon name="leaf.fill" size={20} color="#1a5d1a" />
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.gray[800],
                  marginLeft: spacing[2],
                }}
                numberOfLines={1}
              >
                {selectedFarm?.name || 'Select a farm'}
              </Text>
            </View>
            <Icon name={showFarmPicker ? 'chevron.up' : 'chevron.down'} size={20} color="#666" />
          </Pressable>

          {showFarmPicker && (
            <View
              style={{
                marginTop: spacing[2],
                borderWidth: 1,
                borderColor: colors.gray[200],
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
                    borderBottomColor: colors.gray[100],
                    backgroundColor: f.id === selectedFarmId ? colors.primary[50] : colors.white,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.base,
                      color: f.id === selectedFarmId ? colors.primary[700] : colors.gray[700],
                      fontWeight: f.id === selectedFarmId ? fontWeight.semibold : fontWeight.normal,
                    }}
                  >
                    {f.name} ({f.area} acres)
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Date Range */}
        <View
          style={{
            backgroundColor: colors.white,
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
              color: colors.gray[500],
              marginBottom: spacing[3],
            }}
          >
            Date Range
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <Pressable
              onPress={() => setShowFromPicker(true)}
              style={{
                flex: 1,
                backgroundColor: colors.gray[50],
                padding: spacing[3],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.gray[200],
              }}
            >
              <Text
                style={{ fontSize: fontSize.xs, color: colors.gray[500], marginBottom: spacing[1] }}
              >
                From
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.gray[800],
                }}
              >
                {dateRange.from}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowToPicker(true)}
              style={{
                flex: 1,
                backgroundColor: colors.gray[50],
                padding: spacing[3],
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.gray[200],
              }}
            >
              <Text
                style={{ fontSize: fontSize.xs, color: colors.gray[500], marginBottom: spacing[1] }}
              >
                To
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.medium,
                  color: colors.gray[800],
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
            backgroundColor: colors.white,
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
              color: colors.gray[500],
              marginBottom: spacing[3],
            }}
          >
            Report Type
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
                  backgroundColor: reportType === type.value ? colors.primary[50] : colors.gray[50],
                  borderColor: reportType === type.value ? colors.primary[500] : colors.gray[200],
                }}
              >
                <Icon
                  name={type.icon}
                  size={24}
                  color={reportType === type.value ? '#1a5d1a' : '#9ca3af'}
                  style={{ alignSelf: 'center' }}
                />
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    textAlign: 'center',
                    marginTop: spacing[1],
                    color: reportType === type.value ? colors.primary[700] : colors.gray[600],
                    fontWeight: reportType === type.value ? fontWeight.semibold : fontWeight.normal,
                  }}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Preview Summary */}
        {dataLoading ? (
          <View
            style={{
              backgroundColor: colors.white,
              marginHorizontal: spacing[4],
              marginTop: spacing[4],
              borderRadius: borderRadius.xl,
              padding: spacing[6],
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="small" color="#1a5d1a" />
            <Text style={{ color: colors.gray[500], marginTop: spacing[2] }}>
              Loading report data...
            </Text>
          </View>
        ) : preview ? (
          <View
            style={{
              backgroundColor: colors.white,
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
                color: colors.gray[500],
                marginBottom: spacing[3],
              }}
            >
              Preview Summary
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              <View
                style={{
                  backgroundColor: '#EFF6FF',
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
                    color: '#2563EB',
                  }}
                >
                  {preview.summary.totalRecords}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#2563EB' }}>Total Records</Text>
              </View>
              <View
                style={{
                  backgroundColor: '#ECFEFF',
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
                    color: '#0891B2',
                  }}
                >
                  {preview.summary.totalWaterUsage.toLocaleString()}L
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#0891B2' }}>Water Usage</Text>
              </View>
              <View
                style={{
                  backgroundColor: '#F5F3FF',
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
                    color: '#7C3AED',
                  }}
                >
                  {preview.summary.totalHarvest}kg
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#7C3AED' }}>Total Harvest</Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.primary[50],
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
                    color: preview.summary.netProfit >= 0 ? '#16A34A' : '#DC2626',
                  }}
                >
                  ₹{preview.summary.netProfit.toLocaleString()}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: '#16A34A' }}>Net Profit</Text>
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
                borderTopColor: colors.gray[100],
              }}
            >
              <View
                style={{
                  backgroundColor: colors.gray[100],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[600] }}>
                  💧 {preview.summary.irrigationCount} irrigations
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.gray[100],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[600] }}>
                  🧪 {preview.summary.sprayCount} sprays
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.gray[100],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[600] }}>
                  🍇 {preview.summary.harvestCount} harvests
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.gray[100],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  borderRadius: borderRadius.full,
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.gray[600] }}>
                  💰 {preview.summary.expenseCount} expenses
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
              color: colors.gray[500],
              marginBottom: spacing[3],
            }}
          >
            Export As
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
                backgroundColor: !preview || isExporting ? colors.gray[200] : '#EF4444',
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="doc.fill" size={24} color="white" />
                  <Text
                    style={{
                      color: colors.white,
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
                backgroundColor: !preview || isExporting ? colors.gray[200] : '#16A34A',
              }}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="square.grid.2x2.fill" size={24} color="white" />
                  <Text
                    style={{
                      color: colors.white,
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
