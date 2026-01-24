/**
 * Petiole Trends Screen
 * Trends visualization for petiole tests
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFarm } from '@/hooks/useFarms';
import { usePetioleTestTrends, PETIOLE_DEFAULT_PARAMS } from '@/hooks/useLabTests';
import ParameterSelector from '@/components/screens/ParameterSelector';
import TrendsTable from '@/components/screens/TrendsTable';
import TrendsChart from '@/components/screens/TrendsChart';

type ViewMode = 'table' | 'chart';

export default function PetioleTrendsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const parsed = farmId ? parseInt(farmId, 10) : 0;
  const farmIdNum = Number.isNaN(parsed) ? 0 : parsed;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: trends, isLoading: trendsLoading } = usePetioleTestTrends(farmIdNum);

  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedParams, setSelectedParams] = useState<Set<string>>(
    new Set(PETIOLE_DEFAULT_PARAMS),
  );

  if (!farmId || farmIdNum === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-lg font-semibold text-gray-700 mt-4">Invalid Farm</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (farmLoading || trendsLoading || !trends || !trends.parameterTrends) {
    return (
      <SafeAreaView className="flex-1 bg-[#f2f2f7]">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4C806B" />
          <Text className="text-gray-500 mt-4">Loading trends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Ionicons name="analytics" size={24} color="#4C806B" />
        <View className="ml-2 flex-1">
          <Text className="text-lg font-bold text-gray-800">Petiole Trends</Text>
          <Text className="text-xs text-gray-500">{farm?.name || 'Farm'}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Parameter Selector */}
        <View className="pt-2">
          <ParameterSelector
            testType="petiole"
            selected={selectedParams}
            onChange={setSelectedParams}
          />
        </View>

        {/* View Toggle */}
        <View className="flex-row bg-white/80 px-4 py-2 border-b border-gray-200">
          <TouchableOpacity
            onPress={() => setViewMode('table')}
            className={`flex-1 py-2 mr-2 ${
              viewMode === 'table' ? 'border-b-2 border-[#4C806B]' : ''
            }`}
          >
            <Text
              className={`text-center text-sm font-semibold uppercase ${
                viewMode === 'table' ? 'text-[#4C806B]' : 'text-gray-400'
              }`}
            >
              Table
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('chart')}
            className={`flex-1 py-2 ml-2 ${
              viewMode === 'chart' ? 'border-b-2 border-[#4C806B]' : ''
            }`}
          >
            <Text
              className={`text-center text-sm font-semibold uppercase ${
                viewMode === 'chart' ? 'text-[#4C806B]' : 'text-gray-400'
              }`}
            >
              Chart
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1 min-h-[500px]">
          {viewMode === 'table' ? (
            <TrendsTable
              trendData={trends.tests}
              parameterTrends={trends.parameterTrends}
              selectedParams={selectedParams}
            />
          ) : (
            <TrendsChart
              trendData={trends.tests}
              parameterTrends={trends.parameterTrends}
              selectedParams={selectedParams}
              onToggleParam={(key) => {
                const newSelected = new Set(selectedParams);
                if (newSelected.has(key)) {
                  newSelected.delete(key);
                } else {
                  newSelected.add(key);
                }
                setSelectedParams(newSelected);
              }}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
