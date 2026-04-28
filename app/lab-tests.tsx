/**
 * Lab Tests Screen
 * View and manage soil/petiole test records for a farm
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { LabTestDetailsModal } from '@/components/screens/lab-test-details-modal';
import { LabTestsFabSheet } from '@/components/modals/lab-tests-fab-sheet';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFarm } from '../src/hooks';
import {
  useSoilTests,
  usePetioleTests,
  useDeleteSoilTest,
  useDeletePetioleTest,
  formatParameterKey,
  getParameterUnit,
} from '../src/hooks/use-lab-tests';
import { SoilTestRecord, PetioleTestRecord } from '../src/types/database';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { getParamOption, getParamStatus, selectDisplayParams } from '@/utils/lab-test-utils';
import { useM3, useThemeColors } from '@/styles/use-theme';

type TestType = 'soil' | 'petiole';

const getTestTypeIcon = (type: TestType) =>
  type === 'soil' ? 'square.stack.3d.up.fill' : 'leaf.fill';

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function LabTestsScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const parsedFarmId = farmId ? parseInt(farmId, 10) : 0;
  const farmIdNum = Number.isNaN(parsedFarmId) ? 0 : parsedFarmId;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: soilTests, isLoading: soilLoading } = useSoilTests(farmIdNum);
  const { data: petioleTests, isLoading: petioleLoading } = usePetioleTests(farmIdNum);
  const deleteSoilTest = useDeleteSoilTest();
  const deletePetioleTest = useDeletePetioleTest();

  const [selectedTab, setSelectedTab] = useState<TestType>('soil');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedTest, setSelectedTest] = useState<SoilTestRecord | PetioleTestRecord | null>(null);
  const [selectedType, setSelectedType] = useState<TestType>('soil');
  const [fabSheetVisible, setFabSheetVisible] = useState(false);

  const navigateToAddLabTest = (type: TestType) => {
    router.push({
      pathname: '/add-lab-test',
      params: {
        farmId: farmIdNum.toString(),
        testType: type,
      },
    });
  };

  const isLoading = farmLoading || soilLoading || petioleLoading;

  const handleDeleteSoilTest = (test: SoilTestRecord) => {
    Alert.alert(
      t('labTests.list.deleteTitle'),
      t('labTests.list.deleteBody', { type: t('labTests.form.types.soil') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (test.id) {
              deleteSoilTest.mutate({ id: test.id, farmId: farmIdNum });
            }
          },
        },
      ],
    );
  };

  const handleDeletePetioleTest = (test: PetioleTestRecord) => {
    Alert.alert(
      t('labTests.list.deleteTitle'),
      t('labTests.list.deleteBody', { type: t('labTests.form.types.petiole') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (test.id) {
              deletePetioleTest.mutate({ id: test.id, farmId: farmIdNum });
            }
          },
        },
      ],
    );
  };

  const renderTestCard = (test: SoilTestRecord | PetioleTestRecord, type: TestType) => {
    const isSoil = type === 'soil';
    const {
      selected: initialSelected,
      remainingCount: initialRemainingCount,
      outOfRangeCount,
    } = selectDisplayParams(test.parameters, type, 6);
    let selected = initialSelected;
    let remainingCount = initialRemainingCount;
    if (remainingCount > 0 && selected.length === 6) {
      selected = selected.slice(0, 5);
      remainingCount += 1;
    }
    const accentColor = isSoil ? colors.labTest.soil : colors.labTest.petiole;
    const surfaceColor = colorWithOpacity(accentColor, 0.08);
    const surfaceBorder = colorWithOpacity(accentColor, 0.25);
    const statusLine =
      outOfRangeCount > 0
        ? t('labTests.list.card.outOfRange', { count: outOfRangeCount })
        : t('labTests.list.card.allWithinRange');

    return (
      <Pressable
        key={test.id}
        onPress={() => {
          setSelectedTest(test);
          setSelectedType(type);
          setDetailsVisible(true);
        }}
        style={{
          backgroundColor: surfaceColor,
          borderRadius: borderRadius['2xl'],
          padding: spacing[4],
          marginBottom: spacing[4],
          borderWidth: 1,
          borderColor: surfaceBorder,
          borderLeftWidth: 4,
          borderLeftColor: accentColor,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing[3],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colorWithOpacity(accentColor, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol name={getTestTypeIcon(type)} size={20} color={accentColor} />
            </View>
            <View style={{ marginLeft: spacing[3] }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: accentColor,
                  textTransform: 'uppercase',
                }}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {isSoil
                  ? t('labTests.list.card.soilAnalysis')
                  : t('labTests.list.card.petioleAnalysis')}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: fontWeight.semibold,
                  color: m3.colorScheme.onSurface,
                }}
              >
                {formatDate(test.date)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              if (isSoil) {
                handleDeleteSoilTest(test as SoilTestRecord);
              } else {
                handleDeletePetioleTest(test as PetioleTestRecord);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t('labTests.list.deleteAction')}
            style={{ padding: spacing[2] }}
          >
            <IconSymbol name="trash" size={18} color={m3.colorScheme.error} />
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: fontSize.xs,
            color: m3.colorScheme.onSurfaceVariant,
            marginBottom: spacing[2],
          }}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {statusLine}
        </Text>

        {/* Parameters Chips */}
        {selected.length > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: surfaceBorder,
              paddingTop: spacing[3],
              marginBottom: spacing[2],
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              {selected.map(([key, value]) => {
                const option = getParamOption(String(key), type);
                const status = getParamStatus(value, option);
                const statusColor =
                  status === 'bad'
                    ? m3.colorScheme.error
                    : status === 'warn'
                      ? m3.colorScheme.tertiary
                      : accentColor;
                const unit = getParameterUnit(String(key), isSoil);
                const displayValue = typeof value === 'number' ? value.toFixed(2) : String(value);

                return (
                  <View
                    key={String(key)}
                    style={{
                      backgroundColor: m3.surface.surfaceContainerHighest,
                      borderRadius: borderRadius.lg,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      minWidth: 96,
                      borderWidth: 1,
                      borderColor: m3.colorScheme.outlineVariant,
                    }}
                    accessibilityLabel={`${formatParameterKey(
                      String(key),
                      type,
                    )} ${displayValue}${unit ? ` ${unit}` : ''} ${
                      status === 'bad' ? t('labTests.list.card.status.outOfRange') : ''
                    }`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: statusColor,
                          marginRight: spacing[1],
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: m3.colorScheme.onSurface,
                        }}
                        textBreakStrategy="highQuality"
                        lineBreakStrategyIOS="standard"
                      >
                        {formatParameterKey(String(key), type)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: fontWeight.medium,
                        color: m3.colorScheme.onSurfaceVariant,
                        marginTop: spacing[1],
                      }}
                    >
                      {displayValue}
                      {unit ? ` ${unit}` : ''}
                    </Text>
                  </View>
                );
              })}
              {remainingCount > 0 && (
                <View
                  style={{
                    backgroundColor: m3.surface.surfaceContainerHighest,
                    borderRadius: borderRadius.lg,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    minWidth: 96,
                    borderWidth: 1,
                    borderColor: m3.colorScheme.outlineVariant,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel={t('labTests.list.card.more', {
                    count: remainingCount,
                  })}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: m3.colorScheme.onSurfaceVariant,
                    }}
                  >
                    +{remainingCount} {t('labTests.list.card.moreLabel')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        {test.notes && (
          <Text
            style={{
              fontSize: 12,
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: 4,
            }}
            numberOfLines={2}
          >
            {test.notes}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderEmptyState = (type: TestType) => {
    const accentColor = type === 'soil' ? colors.labTest.soil : colors.labTest.petiole;

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing[16],
        }}
      >
        <IconSymbol
          name={getTestTypeIcon(type)}
          size={48}
          color={accentColor}
          style={{ opacity: 0.5 }}
        />
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: m3.colorScheme.onSurface,
            marginTop: spacing[4],
          }}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('labTests.list.empty.title', {
            type: t(type === 'soil' ? 'labTests.form.types.soil' : 'labTests.form.types.petiole'),
          })}
        </Text>
        <Text
          style={{
            color: m3.colorScheme.onSurfaceVariant,
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
          textBreakStrategy="highQuality"
          lineBreakStrategyIOS="standard"
        >
          {t('labTests.list.empty.subtitle', {
            type: t(type === 'soil' ? 'labTests.form.types.soil' : 'labTests.form.types.petiole'),
          })}
        </Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/add-lab-test',
              params: {
                farmId: farmIdNum.toString(),
                testType: type,
              },
            })
          }
          style={{
            marginTop: spacing[4],
            backgroundColor: m3.colorScheme.primary,
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <IconSymbol name="plus" size={20} color={m3.colorScheme.onPrimary} />
          <Text
            style={{
              color: m3.colorScheme.onPrimary,
              fontWeight: fontWeight.semibold,
              marginLeft: spacing[1],
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.list.empty.action', {
              type: t(type === 'soil' ? 'labTests.form.types.soil' : 'labTests.form.types.petiole'),
            })}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (!farmId || farmIdNum === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={m3.colorScheme.error} />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: m3.colorScheme.onSurfaceVariant,
              marginTop: spacing[4],
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.errors.invalidFarmTitle')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: spacing[4],
              backgroundColor: colors.surface[200],
              paddingHorizontal: spacing[6],
              paddingVertical: spacing[2],
              borderRadius: borderRadius.lg,
            }}
          >
            <Text
              style={{ color: m3.colorScheme.onSurfaceVariant, fontWeight: fontWeight.medium }}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {t('common.back')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
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
              borderRadius: 22,
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
                <IconSymbol name="chevron.left" size={22} color={m3.colorScheme.onSurface} />
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 22,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.onSurface, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </View>
            )}
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                color: m3.colorScheme.onSurface,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              {t('labTests.list.title')}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              if (selectedTab === 'soil') {
                router.push(`/soil-trends?farmId=${farmId}`);
              } else {
                router.push(`/petiole-trends?farmId=${farmId}`);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('labTests.list.viewTrends')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              paddingHorizontal: spacing[3],
              marginRight: spacing[2],
              borderRadius: borderRadius.full,
              backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
              overflow: 'hidden',
            }}
          >
            {({ pressed }) => (
              <>
                <IconSymbol
                  name="chart.line.uptrend.xyaxis"
                  size={16}
                  color={m3.colorScheme.primary}
                />
                <Text
                  style={{
                    marginLeft: spacing[1],
                    color: m3.colorScheme.primary,
                    fontWeight: fontWeight.semibold,
                    fontSize: fontSize.sm,
                  }}
                  textBreakStrategy="highQuality"
                  lineBreakStrategyIOS="standard"
                >
                  {t('labTests.list.viewTrends')}
                </Text>
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: borderRadius.full,
                      backgroundColor: pressed
                        ? colorWithOpacity(m3.colorScheme.primary, m3.stateLayerOpacity.pressed)
                        : 'transparent',
                    },
                  ]}
                />
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.surface[200],
        }}
      >
        <Pressable
          onPress={() => setSelectedTab('soil')}
          style={{
            flex: 1,
            paddingVertical: spacing[2],
            marginRight: spacing[2],
            borderBottomWidth: selectedTab === 'soil' ? 2 : 0,
            borderBottomColor: selectedTab === 'soil' ? colors.labTest.soil : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              textTransform: 'uppercase',
              color: selectedTab === 'soil' ? colors.labTest.soil : colors.surface[400],
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.list.tabs.soil', { count: soilTests?.length || 0 })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedTab('petiole')}
          style={{
            flex: 1,
            paddingVertical: spacing[2],
            marginLeft: spacing[2],
            borderBottomWidth: selectedTab === 'petiole' ? 2 : 0,
            borderBottomColor: selectedTab === 'petiole' ? colors.labTest.petiole : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              textTransform: 'uppercase',
              color: selectedTab === 'petiole' ? colors.labTest.petiole : colors.surface[400],
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.list.tabs.petiole', { count: petioleTests?.length || 0 })}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
          <Text
            style={{ color: m3.colorScheme.onSurfaceVariant, marginTop: spacing[2] }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('common.loading')}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[4] }}
          showsVerticalScrollIndicator={false}
        >
          {farm ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
              <IconSymbol
                name={getTestTypeIcon(selectedTab)}
                size={18}
                color={selectedTab === 'soil' ? colors.labTest.soil : colors.labTest.petiole}
              />
              <Text
                style={{
                  marginLeft: spacing[2],
                  fontSize: fontSize.sm,
                  color: m3.colorScheme.onSurfaceVariant,
                }}
                textBreakStrategy="highQuality"
                lineBreakStrategyIOS="standard"
              >
                {farm.name}
              </Text>
            </View>
          ) : null}
          {selectedTab === 'soil'
            ? soilTests && soilTests.length > 0
              ? soilTests.map((test) => renderTestCard(test, 'soil'))
              : renderEmptyState('soil')
            : petioleTests && petioleTests.length > 0
              ? petioleTests.map((test) => renderTestCard(test, 'petiole'))
              : renderEmptyState('petiole')}
          <View style={{ height: spacing[24] }} />
        </ScrollView>
      )}

      {/* FAB to add new lab test */}
      <Pressable
        onPress={() => setFabSheetVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('labTests.actions.title')}
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom, spacing[4]) + spacing[4],
          right: spacing[6],
          width: 56,
          height: 56,
          borderRadius: borderRadius.full,
          backgroundColor: m3.colorScheme.primary,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        {({ pressed }) => (
          <>
            <IconSymbol name="plus" size={28} color={m3.colorScheme.onPrimary} />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: pressed
                    ? colorWithOpacity(m3.colorScheme.onPrimary, m3.stateLayerOpacity.pressed)
                    : 'transparent',
                },
              ]}
            />
          </>
        )}
      </Pressable>

      {/* Add Modal */}
      {/* Lab test creation handled via route */}
      <LabTestDetailsModal
        visible={detailsVisible}
        test={selectedTest}
        testType={selectedType}
        onClose={() => setDetailsVisible(false)}
      />

      <LabTestsFabSheet
        visible={fabSheetVisible}
        onClose={() => setFabSheetVisible(false)}
        onAddSoilTest={() => navigateToAddLabTest('soil')}
        onAddPetioleTest={() => navigateToAddLabTest('petiole')}
      />
    </View>
  );
}
