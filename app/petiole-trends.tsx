/**
 * Petiole Trends Screen
 * Trends visualization for petiole tests
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { SafeScreen } from '@/components/ui/safe-screen';
import { useFarm } from '@/hooks/use-farms';
import { usePetioleTestTrends, PETIOLE_DEFAULT_PARAMS } from '@/hooks/use-lab-tests';
import { useFertigationRecords } from '@/hooks';
import ParameterSelector from '@/components/screens/parameter-selector';
import { PetioleComparison, type ComparisonTest } from '@/components/lab/petiole-comparison';
import TrendsChart from '@/components/screens/trends-chart';
import { borderRadius, fontSize, fontWeight, radius, spacing } from '@/styles/theme';
import { useM3 } from '@/styles/use-theme';
import { useDomainColors } from '@/styles/use-domain-colors';
import { colorWithOpacity } from '@/utils/color';
import { aggregateNutrientsBetweenPetioleTests } from '@/services/nutrient-flow-service';
import { formatDate } from '@/i18n/format';

type ViewMode = 'table' | 'chart';

const DEFAULT_ELEMENT_ROWS = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];
const INTERVAL_NUTRIENT_UNIT = 'kg/acre';

function mapPetioleParamToElement(paramKey: string): string | null {
  switch (paramKey) {
    case 'total_nitrogen':
    case 'nitrate_nitrogen':
    case 'ammoniacal_nitrogen':
      return 'N';
    case 'phosphorus':
      return 'P';
    case 'potassium':
      return 'K';
    case 'calcium':
      return 'Ca';
    case 'magnesium':
      return 'Mg';
    case 'sulfur':
      return 'S';
    case 'iron':
      return 'Fe';
    case 'manganese':
      return 'Mn';
    case 'zinc':
      return 'Zn';
    case 'copper':
      return 'Cu';
    case 'boron':
      return 'B';
    case 'molybdenum':
      return 'Mo';
    case 'sodium':
      return 'Na';
    case 'chloride':
      return 'Cl';
    default:
      return null;
  }
}

export default function PetioleTrendsScreen() {
  const { t } = useTranslation();
  const m3 = useM3();
  const domain = useDomainColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const parsed = farmId ? parseInt(farmId, 10) : 0;
  const farmIdNum = Number.isNaN(parsed) ? 0 : parsed;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: trends, isLoading: trendsLoading } = usePetioleTestTrends(farmIdNum);
  const { data: fertigationRecords = [], isLoading: fertigationLoading } =
    useFertigationRecords(farmIdNum);

  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedParams, setSelectedParams] = useState<Set<string>>(
    new Set(PETIOLE_DEFAULT_PARAMS),
  );

  const nutrientIntervals =
    trends?.tests && trends.tests.length >= 2
      ? aggregateNutrientsBetweenPetioleTests({
          testDates: trends.tests.map((test) => test.date),
          sprayRecords: [],
          fertigationRecords,
        })
      : [];

  const trendTests = trends?.tests;
  const comparisonTests: ComparisonTest[] = useMemo(() => {
    if (!trendTests) return [];
    return trendTests.map((test, index) => ({
      id: index,
      date: test.date,
      date_of_pruning: test.dateOfPruning ?? null,
      parameters: test.parameters,
    }));
  }, [trendTests]);

  const selectedElements = useMemo(() => {
    const mapped = Array.from(selectedParams)
      .map((key) => mapPetioleParamToElement(key))
      .filter((value): value is string => value !== null);
    const deduped = Array.from(new Set(mapped));
    return deduped.length > 0 ? deduped : DEFAULT_ELEMENT_ROWS;
  }, [selectedParams]);

  const hasPartialCoverage = nutrientIntervals.some((interval) => interval.coveragePercent < 100);

  if (!farmId || farmIdNum === 0) {
    return (
      <SafeScreen backgroundColor={m3.colorScheme.background}>
        <Stack.Screen options={{ headerShown: false }} />
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

  if (farmLoading || trendsLoading || fertigationLoading || !trends || !trends.parameterTrends) {
    return (
      <SafeScreen backgroundColor={m3.colorScheme.background}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={domain.labTest.petiole} />
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
    <SafeScreen backgroundColor={m3.colorScheme.background} edges={['left', 'right']}>
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

          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFill,
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
              {t('trends.screens.petiole')}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Symbol
            name={resolveSymbolIconName(ICON_REGISTRY.petioleTest)}
            size={20}
            color={domain.labTest.petiole}
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
            testType="petiole"
            selected={selectedParams}
            onChange={setSelectedParams}
          />
        </View>

        {/* View Toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colorWithOpacity(m3.surface.s100, 0.9),
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
              borderBottomColor: viewMode === 'table' ? domain.labTest.petiole : 'transparent',
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
                    ? domain.labTest.petiole
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
              borderBottomColor: viewMode === 'chart' ? domain.labTest.petiole : 'transparent',
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
                    ? domain.labTest.petiole
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
            <ScrollView style={{ flex: 1 }} nestedScrollEnabled>
              <View style={{ padding: spacing[4] }}>
                <PetioleComparison
                  tests={comparisonTests}
                  selectedParams={selectedParams}
                  showTrendIndicators
                  showPruningInfo
                  showLegend
                />
              </View>
            </ScrollView>
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

        {/* Nutrient flow between petiole tests */}
        <View
          style={{
            marginHorizontal: spacing[4],
            marginBottom: spacing[8],
            padding: spacing[4],
            borderRadius: borderRadius.xl,
            backgroundColor: m3.surface.s100,
            borderWidth: 1,
            borderColor: colorWithOpacity(m3.colorScheme.outline, 0.2),
          }}
        >
          <Text
            style={{
              fontSize: fontSize.base,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurface,
              marginBottom: spacing[2],
            }}
          >
            {t('trends.nutrientFlow.title', { unit: INTERVAL_NUTRIENT_UNIT })}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: m3.colorScheme.onSurfaceVariant,
              marginBottom: spacing[2],
            }}
          >
            {t('trends.nutrientFlow.subtitle')}
          </Text>

          {nutrientIntervals.length === 0 ? (
            <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurfaceVariant }}>
              {t('trends.nutrientFlow.empty')}
            </Text>
          ) : (
            <>
              {hasPartialCoverage ? (
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    color: m3.colorScheme.error,
                    marginBottom: spacing[2],
                  }}
                >
                  {t('trends.nutrientFlow.partialHistory')}
                </Text>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={{ flexDirection: 'row' }}>
                    <View
                      style={{
                        width: 110,
                        paddingVertical: spacing[2],
                        paddingHorizontal: spacing[2],
                        borderBottomWidth: 1,
                        borderBottomColor: colorWithOpacity(m3.colorScheme.outline, 0.3),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          color: m3.colorScheme.onSurfaceVariant,
                        }}
                      >
                        {t('trends.nutrientFlow.nutrient')}
                      </Text>
                    </View>

                    {nutrientIntervals.map((interval) => (
                      <View
                        key={`${interval.fromDate}-${interval.toDate}`}
                        style={{
                          width: 170,
                          paddingVertical: spacing[2],
                          paddingHorizontal: spacing[2],
                          borderBottomWidth: 1,
                          borderBottomColor: colorWithOpacity(m3.colorScheme.outline, 0.3),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.xs,
                            fontWeight: fontWeight.semibold,
                            color: m3.colorScheme.onSurface,
                          }}
                        >
                          {formatDate(new Date(interval.fromDate), {
                            day: '2-digit',
                            month: 'short',
                          })}{' '}
                          →{' '}
                          {formatDate(new Date(interval.toDate), {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </Text>
                        <Text
                          style={{ fontSize: fontSize.xs, color: m3.colorScheme.onSurfaceVariant }}
                        >
                          {t('trends.nutrientFlow.coverage', {
                            value: interval.coveragePercent.toFixed(0),
                          })}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {selectedElements.map((element) => (
                    <View key={element} style={{ flexDirection: 'row' }}>
                      <View
                        style={{
                          width: 110,
                          paddingVertical: spacing[2],
                          paddingHorizontal: spacing[2],
                          borderBottomWidth: 1,
                          borderBottomColor: colorWithOpacity(m3.colorScheme.outline, 0.16),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fontSize.sm,
                            fontWeight: fontWeight.semibold,
                            color: m3.colorScheme.onSurface,
                          }}
                        >
                          {element}
                        </Text>
                      </View>

                      {nutrientIntervals.map((interval) => (
                        <View
                          key={`${element}-${interval.fromDate}-${interval.toDate}`}
                          style={{
                            width: 170,
                            paddingVertical: spacing[2],
                            paddingHorizontal: spacing[2],
                            borderBottomWidth: 1,
                            borderBottomColor: colorWithOpacity(m3.colorScheme.outline, 0.16),
                          }}
                        >
                          <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.onSurface }}>
                            {(interval.totalsPerAcre[element] ?? 0).toFixed(2)}{' '}
                            {INTERVAL_NUTRIENT_UNIT}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}
