/**
 * Soil Trends Screen
 * Trends visualization for soil tests
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { SafeScreen } from '@/components/ui/safe-screen';
import { useFarm } from '@/hooks/use-farms';
import { useSoilTestTrends, SOIL_DEFAULT_PARAMS } from '@/hooks/use-lab-tests';
import ParameterSelector from '@/components/screens/parameter-selector';
import TrendsTable from '@/components/screens/trends-table';
import TrendsChart from '@/components/screens/trends-chart';
import { fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type ViewMode = 'table' | 'chart';

export default function SoilTrendsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const m3 = useM3();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const parsed = farmId ? parseInt(farmId, 10) : 0;
  const farmIdNum = Number.isNaN(parsed) ? 0 : parsed;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: trends, isLoading: trendsLoading } = useSoilTestTrends(farmIdNum);

  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedParams, setSelectedParams] = useState<Set<string>>(new Set(SOIL_DEFAULT_PARAMS));

  if (!farmId || farmIdNum === 0) {
    return (
      <SafeScreen backgroundColor={m3.colorScheme.background}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={m3.colorScheme.error} />
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
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.labTest.soil} />
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
    <SafeScreen backgroundColor={m3.colorScheme.background} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Custom JS header (avoids iOS 26 native bar-button glass capsule) */}
      <View style={{ paddingTop: insets.top, backgroundColor: m3.colorScheme.surface }}>
        <View
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing[2],
            position: 'relative',
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
              zIndex: 1,
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
                <IconSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
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

          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 64,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {t('trends.screens.soil')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconSymbol
            name={resolveSymbolIconName(ICON_REGISTRY.soilTest)}
            size={20}
            color={colors.labTest.soil}
          />
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
              marginLeft: spacing[2],
            }}
          >
            {farm?.name || t('tasks.unknownFarm')}
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
              borderBottomColor: viewMode === 'table' ? colors.labTest.soil : 'transparent',
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
                    ? colors.labTest.soil
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
              borderBottomColor: viewMode === 'chart' ? colors.labTest.soil : 'transparent',
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
                    ? colors.labTest.soil
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
              testType="soil"
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
