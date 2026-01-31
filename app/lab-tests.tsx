/**
 * Lab Tests Screen
 * View and manage soil/petiole test records for a farm
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

type TestType = 'soil' | 'petiole';

export default function LabTestsScreen() {
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
    Alert.alert('Delete Test', 'Are you sure you want to delete this soil test?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (test.id) {
            deleteSoilTest.mutate({ id: test.id, farmId: farmIdNum });
          }
        },
      },
    ]);
  };

  const handleDeletePetioleTest = (test: PetioleTestRecord) => {
    Alert.alert('Delete Test', 'Are you sure you want to delete this petiole test?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (test.id) {
            deletePetioleTest.mutate({ id: test.id, farmId: farmIdNum });
          }
        },
      },
    ]);
  };

  const renderTestCard = (test: SoilTestRecord | PetioleTestRecord, type: TestType) => {
    const isSoil = type === 'soil';
    const params = Object.entries(test.parameters || {}).slice(0, 8);
    const color = isSoil ? '#597A61' : '#4C806B';

    return (
      <Pressable
        key={test.id}
        onPress={() => {
          setSelectedTest(test);
          setSelectedType(type);
          setDetailsVisible(true);
        }}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: borderRadius['2xl'],
          padding: spacing[4],
          marginBottom: spacing[4],
          borderWidth: 1,
          borderColor: isSoil ? 'rgba(89, 122, 97, 0.2)' : 'rgba(76, 128, 107, 0.2)',
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
                backgroundColor: isSoil ? 'rgba(89, 122, 97, 0.1)' : 'rgba(76, 128, 107, 0.1)',
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
              >
                {isSoil ? 'Soil Analysis' : 'Petiole Analysis'}
              </Text>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.gray[800],
                }}
              >
                {test.date}
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
            <IconSymbol name="trash" size={18} color="#ef4444" />
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
                    backgroundColor: 'rgba(242, 242, 247, 0.5)',
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
              color: '#666',
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
    const color = type === 'soil' ? '#597A61' : '#4C806B';

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
        >
          No {type === 'soil' ? 'Soil' : 'Petiole'} Tests
        </Text>
        <Text
          style={{
            color: colors.gray[500],
            textAlign: 'center',
            marginTop: spacing[2],
            paddingHorizontal: spacing[8],
          }}
        >
          Add a {type === 'soil' ? 'soil' : 'petiole'} test to track nutrient levels.
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
            backgroundColor: '#408059',
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <IconSymbol name="plus" size={20} color="white" />
          <Text
            style={{ color: colors.white, fontWeight: fontWeight.semibold, marginLeft: spacing[1] }}
          >
            Add {type === 'soil' ? 'Soil' : 'Petiole'} Test
          </Text>
        </Pressable>
      </View>
    );
  };

  if (!farmId || farmIdNum === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color="#ef4444" />
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
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: spacing[4],
              backgroundColor: colors.gray[200],
              paddingHorizontal: spacing[6],
              paddingVertical: spacing[2],
              borderRadius: borderRadius.lg,
            }}
          >
            <Text style={{ color: colors.gray[700], fontWeight: fontWeight.medium }}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
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
          backgroundColor: 'rgba(255,255,255,0.8)',
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <IconSymbol name="chevron.left" size={24} color="#333" />
        </Pressable>
        <IconSymbol name="flask.fill" size={24} color="#408059" />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.gray[800] }}
          >
            Lab Tests
          </Text>
          {farm && (
            <Text style={{ fontSize: fontSize.xs, color: colors.gray[500] }}>{farm.name}</Text>
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
            backgroundColor: '#408059',
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: borderRadius.full,
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: spacing[2],
          }}
        >
          <IconSymbol name="arrow.up.right" size={16} color="white" />
          <Text
            style={{
              color: colors.white,
              fontWeight: fontWeight.semibold,
              marginLeft: spacing[1],
              fontSize: fontSize.sm,
            }}
          >
            View Trends
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
            backgroundColor: '#408059',
            padding: spacing[2],
            borderRadius: borderRadius.full,
          }}
        >
          <IconSymbol name="plus" size={24} color="white" />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(255,255,255,0.8)',
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
            borderBottomColor: selectedTab === 'soil' ? '#597A61' : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              textTransform: 'uppercase',
              color: selectedTab === 'soil' ? '#597A61' : colors.gray[400],
            }}
          >
            Soil ({soilTests?.length || 0})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedTab('petiole')}
          style={{
            flex: 1,
            paddingVertical: spacing[2],
            marginLeft: spacing[2],
            borderBottomWidth: selectedTab === 'petiole' ? 2 : 0,
            borderBottomColor: selectedTab === 'petiole' ? '#4C806B' : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              textTransform: 'uppercase',
              color: selectedTab === 'petiole' ? '#4C806B' : colors.gray[400],
            }}
          >
            Petiole ({petioleTests?.length || 0})
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={{ color: colors.gray[500], marginTop: spacing[2] }}>Loading tests...</Text>
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
