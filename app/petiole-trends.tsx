/**
 * Petiole Trends Screen
 * Trends visualization for petiole tests
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { SafeScreen } from '@/components/ui/safe-screen';
import { useFarm } from '@/hooks/use-farms';
import { usePetioleTestTrends, PETIOLE_DEFAULT_PARAMS } from '@/hooks/use-lab-tests';
import ParameterSelector from '@/components/screens/parameter-selector';
import TrendsTable from '@/components/screens/trends-table';
import TrendsChart from '@/components/screens/trends-chart';
import { spacing, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type ViewMode = 'table' | 'chart';

export default function PetioleTrendsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
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
      <SafeScreen backgroundColor={m3.colorScheme.background}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Symbol name="exclamationmark.triangle.fill" size={48} color={m3.colorScheme.error} />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
              marginTop: spacing[4],
            }}
          >
            {t('common.errors.invalidFarm')}
          </Text>
        </View>
      </SafeScreen>
    );
  }

  if (farmLoading || trendsLoading || !trends || !trends.parameterTrends) {
    return (
      <SafeScreen backgroundColor={m3.colorScheme.background}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.labTest.petiole} />
          <Text
            style={{
              color: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.8),
              marginTop: spacing[4],
            }}
          >
            {t('common.loading')}
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen backgroundColor={m3.colorScheme.background}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          backgroundColor: colors.surface[100],
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Symbol name="chevron.left" size={24} color={m3.colorScheme.onSurface} />
        </Pressable>
        <Symbol name="leaf.fill" size={24} color={colors.labTest.petiole} />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
            }}
          >
            {t('trends.screens.petiole')}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}>
            {farm?.name || t('tasks.unknownFarm')}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Parameter Selector */}
        <View style={{ paddingTop: spacing[2] }}>
          <ParameterSelector
            testType="petiole"
            selected={selectedParams}
            onChange={setSelectedParams}
          />
        </View>

        {/* View Toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderBottomWidth: 1,
            borderBottomColor: colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.2),
          }}
        >
          <Pressable
            onPress={() => setViewMode('table')}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              marginRight: spacing[2],
              borderBottomWidth: viewMode === 'table' ? 2 : 0,
              borderBottomColor: viewMode === 'table' ? colors.labTest.petiole : 'transparent',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                color:
                  viewMode === 'table'
                    ? colors.labTest.petiole
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.55),
              }}
            >
              {t('trends.viewModes.table')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('chart')}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              marginLeft: spacing[2],
              borderBottomWidth: viewMode === 'chart' ? 2 : 0,
              borderBottomColor: viewMode === 'chart' ? colors.labTest.petiole : 'transparent',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                color:
                  viewMode === 'chart'
                    ? colors.labTest.petiole
                    : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.55),
              }}
            >
              {t('trends.viewModes.chart')}
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
              testType="petiole"
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
    </SafeScreen>
  );
}
