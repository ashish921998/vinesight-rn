/**
 * Lab Tests Screen
 * View and manage soil/petiole test records for a farm
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Symbol as IconSymbol } from '@/components/ui/symbol';
import { LabTestDetailsModal } from '@/components/screens/lab-test-details-modal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFarm } from '../src/hooks';
import {
  useSoilTests,
  usePetioleTests,
  useDeleteSoilTest,
  useDeletePetioleTest,
  formatParameterKey,
} from '../src/hooks/use-lab-tests';
import { SoilTestRecord, PetioleTestRecord } from '../src/types/database';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

type TestType = 'soil' | 'petiole';

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
    const params = Object.entries(test.parameters || {}).slice(0, 8);
    const color = isSoil ? colors.labTest.soil : colors.labTest.petiole;

    return (
      <Pressable
        key={test.id}
        onPress={() => {
          setSelectedTest(test);
          setSelectedType(type);
          setDetailsVisible(true);
        }}
        style={{
          backgroundColor: colors.surface[100],
          borderRadius: borderRadius['2xl'],
          padding: spacing[4],
          marginBottom: spacing[4],
          borderWidth: 1,
          borderColor: isSoil
            ? colorWithOpacity(colors.labTest.soil, 0.2)
            : colorWithOpacity(colors.labTest.petiole, 0.2),
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
                backgroundColor: isSoil
                  ? colorWithOpacity(colors.labTest.soil, 0.12)
                  : colorWithOpacity(colors.labTest.petiole, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol name={isSoil ? 'leaf' : 'leaf-outline'} size={20} color={color} />
            </View>
            <View style={{ marginLeft: spacing[3] }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: color,
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
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.gray[800],
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
            style={{ padding: spacing[2] }}
          >
            <IconSymbol name="trash" size={18} color={colors.error} />
          </Pressable>
        </View>

        {/* Parameters Grid */}
        {params.length > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.gray[200],
              paddingTop: spacing[3],
              marginBottom: spacing[3],
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] }}>
              {params.map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    backgroundColor: colors.surface[50],
                    borderRadius: borderRadius.lg,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    minWidth: 75,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: color,
                    }}
                    textBreakStrategy="highQuality"
                    lineBreakStrategyIOS="standard"
                  >
                    {formatParameterKey(key, type)}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: colors.gray[800],
                      marginTop: spacing[1],
                    }}
                  >
                    {typeof value === 'number' ? value.toFixed(2) : value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {test.notes && (
          <Text
            style={{
              fontSize: 12,
              color: colors.surface[500],
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
    const color = type === 'soil' ? colors.labTest.soil : colors.labTest.petiole;

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
          name={type === 'soil' ? 'leaf' : 'leaf-outline'}
          size={48}
          color={color}
          style={{ opacity: 0.5 }}
        />
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.gray[800],
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
            color: colors.gray[500],
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
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <IconSymbol name="plus" size={20} color={colors.white} />
          <Text
            style={{ color: colors.white, fontWeight: fontWeight.semibold, marginLeft: spacing[1] }}
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
      <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.surface[900],
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
              style={{ color: colors.surface[700], fontWeight: fontWeight.medium }}
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
    <View style={{ flex: 1, backgroundColor: colors.surface[50] }}>
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
          backgroundColor: colors.surface[100],
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <IconSymbol name="chevron.left" size={24} color={colors.surface[700]} />
        </Pressable>
        <IconSymbol name="flask.fill" size={24} color={colors.primary[600]} />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.gray[800] }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.list.title')}
          </Text>
          {farm && (
            <Text
              style={{ fontSize: fontSize.xs, color: colors.gray[500] }}
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {farm.name}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => {
            if (selectedTab === 'soil') {
              router.push(`/soil-trends?farmId=${farmId}`);
            } else {
              router.push(`/petiole-trends?farmId=${farmId}`);
            }
          }}
          style={{
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: spacing[2],
          }}
        >
          <IconSymbol name="arrow.up.right" size={16} color={colors.white} />
          <Text
            style={{
              color: colors.white,
              fontWeight: fontWeight.semibold,
              marginLeft: spacing[1],
              fontSize: fontSize.sm,
            }}
            textBreakStrategy="highQuality"
            lineBreakStrategyIOS="standard"
          >
            {t('labTests.list.viewTrends')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/add-lab-test',
              params: {
                farmId: farmIdNum.toString(),
                testType: selectedTab,
              },
            })
          }
          style={{
            backgroundColor: colors.primary[600],
            padding: spacing[2],
            borderRadius: borderRadius.full,
          }}
        >
          <IconSymbol name="plus" size={24} color={colors.white} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface[100],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
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
              color: selectedTab === 'soil' ? colors.labTest.soil : colors.gray[400],
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
              color: selectedTab === 'petiole' ? colors.labTest.petiole : colors.gray[400],
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
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text
            style={{ color: colors.gray[500], marginTop: spacing[2] }}
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
          {selectedTab === 'soil'
            ? soilTests && soilTests.length > 0
              ? soilTests.map((test) => renderTestCard(test, 'soil'))
              : renderEmptyState('soil')
            : petioleTests && petioleTests.length > 0
              ? petioleTests.map((test) => renderTestCard(test, 'petiole'))
              : renderEmptyState('petiole')}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      {/* Lab test creation handled via route */}
      <LabTestDetailsModal
        visible={detailsVisible}
        test={selectedTest}
        testType={selectedType}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}
