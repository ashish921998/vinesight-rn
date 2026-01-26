/**
 * Reports Screen
 * Generate and export farm reports as PDF or CSV
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol } from '@/components/ui/Symbol';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFarms } from '../src/hooks';
import { useReportData, useReportExport, getDefaultDateRange } from '../src/hooks/useReports';
import { DateRange, ReportType, ReportFormat } from '../src/types/report';

const REPORT_TYPES: { value: ReportType; label: string; icon: string }[] = [
  { value: 'comprehensive', label: 'Comprehensive', icon: 'doc.text.fill' },
  { value: 'operations', label: 'Operations', icon: 'drop.fill' },
  { value: 'financial', label: 'Financial', icon: 'dollarsign.circle.fill' },
];

export default function ReportsScreen() {
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
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1a5d1a" />
        </View>
      </SafeAreaView>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Symbol name="chevron.left" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">Reports</Text>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <Symbol name="doc.text" size={64} color="#9ca3af" />
          <Text className="text-lg font-semibold text-gray-600 mt-4">No Farms Found</Text>
          <Text className="text-gray-500 text-center mt-2">
            Add a farm first to generate reports
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Symbol name="chevron.left" size={24} color="#333" />
        </TouchableOpacity>
        <Symbol name="doc.text.fill" size={24} color="#1a5d1a" />
        <Text className="text-xl font-bold text-gray-800 ml-2">Reports</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Farm Selector */}
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-500 mb-2">Select Farm</Text>
          <TouchableOpacity
            onPress={() => setShowFarmPicker(!showFarmPicker)}
            className="flex-row items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
          >
            <View className="flex-row items-center flex-1">
              <Symbol name="leaf.fill" size={20} color="#1a5d1a" />
              <Text className="text-base font-medium text-gray-800 ml-2" numberOfLines={1}>
                {selectedFarm?.name || 'Select a farm'}
              </Text>
            </View>
            <Symbol name={showFarmPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
          </TouchableOpacity>

          {showFarmPicker && (
            <View className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {farms.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => {
                    setSelectedFarmId(f.id ?? null);
                    setShowFarmPicker(false);
                  }}
                  className={`p-3 border-b border-gray-100 ${
                    f.id === selectedFarmId ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <Text
                    className={`text-base ${
                      f.id === selectedFarmId ? 'text-green-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {f.name} ({f.area} acres)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Date Range */}
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-500 mb-3">Date Range</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowFromPicker(true)}
              className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-200"
            >
              <Text className="text-xs text-gray-500 mb-1">From</Text>
              <Text className="text-base font-medium text-gray-800">{dateRange.from}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              className="flex-1 bg-gray-50 p-3 rounded-lg border border-gray-200"
            >
              <Text className="text-xs text-gray-500 mb-1">To</Text>
              <Text className="text-base font-medium text-gray-800">{dateRange.to}</Text>
            </TouchableOpacity>
          </View>

          {showFromPicker && (
            <DateTimePicker
              value={new Date(dateRange.from)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => handleDateChange('from', date)}
              maximumDate={new Date(dateRange.to)}
            />
          )}
          {showToPicker && (
            <DateTimePicker
              value={new Date(dateRange.to)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => handleDateChange('to', date)}
              minimumDate={new Date(dateRange.from)}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Report Type */}
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-500 mb-3">Report Type</Text>
          <View className="flex-row gap-2">
            {REPORT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setReportType(type.value)}
                className={`flex-1 p-3 rounded-lg border ${
                  reportType === type.value
                    ? 'bg-green-50 border-green-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Symbol
                  name={type.icon}
                  size={24}
                  color={reportType === type.value ? '#1a5d1a' : '#9ca3af'}
                  style={{ alignSelf: 'center' }}
                />
                <Text
                  className={`text-xs text-center mt-1 ${
                    reportType === type.value ? 'text-green-700 font-semibold' : 'text-gray-600'
                  }`}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview Summary */}
        {dataLoading ? (
          <View className="bg-white mx-4 mt-4 rounded-xl p-6 shadow-sm items-center">
            <ActivityIndicator size="small" color="#1a5d1a" />
            <Text className="text-gray-500 mt-2">Loading report data...</Text>
          </View>
        ) : preview ? (
          <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-3">Preview Summary</Text>

            <View className="flex-row flex-wrap gap-3">
              <View className="bg-blue-50 p-3 rounded-lg flex-1 min-w-[45%]">
                <Text className="text-2xl font-bold text-blue-600">
                  {preview.summary.totalRecords}
                </Text>
                <Text className="text-xs text-blue-600">Total Records</Text>
              </View>
              <View className="bg-cyan-50 p-3 rounded-lg flex-1 min-w-[45%]">
                <Text className="text-2xl font-bold text-cyan-600">
                  {preview.summary.totalWaterUsage.toLocaleString()}L
                </Text>
                <Text className="text-xs text-cyan-600">Water Usage</Text>
              </View>
              <View className="bg-purple-50 p-3 rounded-lg flex-1 min-w-[45%]">
                <Text className="text-2xl font-bold text-purple-600">
                  {preview.summary.totalHarvest}kg
                </Text>
                <Text className="text-xs text-purple-600">Total Harvest</Text>
              </View>
              <View className="bg-green-50 p-3 rounded-lg flex-1 min-w-[45%]">
                <Text
                  className={`text-2xl font-bold ${
                    preview.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  ₹{preview.summary.netProfit.toLocaleString()}
                </Text>
                <Text className="text-xs text-green-600">Net Profit</Text>
              </View>
            </View>

            {/* Record counts */}
            <View className="flex-row flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600">
                  💧 {preview.summary.irrigationCount} irrigations
                </Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600">
                  🧪 {preview.summary.sprayCount} sprays
                </Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600">
                  🍇 {preview.summary.harvestCount} harvests
                </Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-full">
                <Text className="text-xs text-gray-600">
                  💰 {preview.summary.expenseCount} expenses
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Export Buttons */}
        <View className="mx-4 mt-6 mb-8">
          <Text className="text-sm font-medium text-gray-500 mb-3">Export As</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => handleExport('pdf')}
              disabled={!preview || isExporting}
              className={`flex-1 flex-row items-center justify-center p-4 rounded-xl ${
                !preview || isExporting ? 'bg-gray-200' : 'bg-red-500'
              }`}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Symbol name="doc.fill" size={24} color="white" />
                  <Text className="text-white font-bold ml-2">PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleExport('csv')}
              disabled={!preview || isExporting}
              className={`flex-1 flex-row items-center justify-center p-4 rounded-xl ${
                !preview || isExporting ? 'bg-gray-200' : 'bg-green-600'
              }`}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Symbol name="square.grid.2x2.fill" size={24} color="white" />
                  <Text className="text-white font-bold ml-2">CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
