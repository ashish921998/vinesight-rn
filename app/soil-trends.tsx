/**
 * Soil Trends Screen
 * Trends visualization for soil tests
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Symbol } from '@/components/ui/symbol';
import { useFarm } from '@/hooks/use-farms';
import { useSoilTestTrends, SOIL_DEFAULT_PARAMS } from '@/hooks/use-lab-tests';
import ParameterSelector from '@/components/screens/parameter-selector';
import TrendsTable from '@/components/screens/trends-table';
import TrendsChart from '@/components/screens/trends-chart';
import { colors, spacing, fontSize, fontWeight } from '@/styles/theme';

type ViewMode = 'table' | 'chart';

export default function SoilTrendsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const parsed = farmId ? parseInt(farmId, 10) : 0;
  const farmIdNum = Number.isNaN(parsed) ? 0 : parsed;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: trends, isLoading: trendsLoading } = useSoilTestTrends(farmIdNum);

  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedParams, setSelectedParams] = useState<Set<string>>(new Set(SOIL_DEFAULT_PARAMS));

  if (!farmId || farmIdNum === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Symbol name="exclamationmark.triangle.fill" size={48} color="#ef4444" />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.gray[700],
              marginTop: spacing[4],
            }}
          >
            Invalid Farm
          </Text>
        </View>
      </View>
    );
  }

  if (farmLoading || trendsLoading || !trends || !trends.parameterTrends) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#597A61" />
          <Text style={{ color: colors.gray[500], marginTop: spacing[4] }}>Loading trends...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
          backgroundColor: colors.white,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Symbol name="chevron.left" size={24} color="#333" />
        </Pressable>
        <Symbol name="chart.bar.fill" size={24} color="#597A61" />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.gray[800] }}
          >
            Soil Trends
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>
            {farm?.name || 'Farm'}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Parameter Selector */}
        <View style={{ paddingTop: spacing[2] }}>
          <ParameterSelector
            testType="soil"
            selected={selectedParams}
            onChange={setSelectedParams}
          />
        </View>

        {/* View Toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.8)',
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderBottomWidth: 1,
            borderBottomColor: colors.gray[200],
          }}
        >
          <Pressable
            onPress={() => setViewMode('table')}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              marginRight: spacing[2],
              borderBottomWidth: viewMode === 'table' ? 2 : 0,
              borderBottomColor: viewMode === 'table' ? '#597A61' : 'transparent',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                color: viewMode === 'table' ? '#597A61' : colors.gray[400],
              }}
            >
              Table
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('chart')}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              marginLeft: spacing[2],
              borderBottomWidth: viewMode === 'chart' ? 2 : 0,
              borderBottomColor: viewMode === 'chart' ? '#597A61' : 'transparent',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                color: viewMode === 'chart' ? '#597A61' : colors.gray[400],
              }}
            >
              Chart
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flex: 1, minHeight: 500 }}>
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
    </View>
  );
}
