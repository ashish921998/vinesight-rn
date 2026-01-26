/**
 * Lab Tests Screen
 * View and manage soil/petiole test records for a farm
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';

import { Symbol } from '@/components/ui/Symbol';
import { router, useLocalSearchParams } from 'expo-router';
import { useFarm } from '../src/hooks';
import {
  useSoilTests,
  usePetioleTests,
  useDeleteSoilTest,
  useDeletePetioleTest,
  formatParameterKey,
} from '../src/hooks/useLabTests';
import { SoilTestRecord, PetioleTestRecord } from '../src/types/database';
import AddLabTestModal from '../src/components/screens/AddLabTestModal';

type TestType = 'soil' | 'petiole';

export default function LabTestsScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const farmIdNum = farmId ? parseInt(farmId, 10) : 0;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: soilTests, isLoading: soilLoading } = useSoilTests(farmIdNum);
  const { data: petioleTests, isLoading: petioleLoading } = usePetioleTests(farmIdNum);
  const deleteSoilTest = useDeleteSoilTest();
  const deletePetioleTest = useDeletePetioleTest();

  const [selectedTab, setSelectedTab] = useState<TestType>('soil');
  const [showAddModal, setShowAddModal] = useState(false);

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
      <View
        key={test.id}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: isSoil ? 'rgba(89, 122, 97, 0.2)' : 'rgba(76, 128, 107, 0.2)',
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
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
              <Symbol name={isSoil ? 'leaf' : 'leaf-outline'} size={20} color={color} />
            </View>
            <View className="ml-3">
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
              <Text className="text-base font-semibold text-gray-800">{test.date}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              isSoil
                ? handleDeleteSoilTest(test as SoilTestRecord)
                : handleDeletePetioleTest(test as PetioleTestRecord)
            }
            className="p-2"
          >
            <Symbol name="trash" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Parameters Grid */}
        {params.length > 0 && (
          <View className="border-t border-gray-200 pt-3 mb-3">
            <View className="flex-row flex-wrap gap-3">
              {params.map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    backgroundColor: 'rgba(242, 242, 247, 0.5)',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
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
                  <Text className="text-xs font-medium text-gray-800 mt-1">
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
      </View>
    );
  };

  const renderEmptyState = (type: TestType) => {
    const color = type === 'soil' ? '#597A61' : '#4C806B';

    return (
      <View className="flex-1 items-center justify-center py-16">
        <Symbol
          name={type === 'soil' ? 'leaf' : 'leaf-outline'}
          size={48}
          color={color}
          style={{ opacity: 0.5 }}
        />
        <Text className="text-lg font-semibold text-gray-800 mt-4">
          No {type === 'soil' ? 'Soil' : 'Petiole'} Tests
        </Text>
        <Text className="text-gray-500 text-center mt-2 px-8">
          Add a {type === 'soil' ? 'soil' : 'petiole'} test to track nutrient levels.
        </Text>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="mt-4 bg-[#408059] px-6 py-3 rounded-full flex-row items-center"
        >
          <Symbol name="plus" size={20} color="white" />
          <Text className="text-white font-semibold ml-1">
            Add {type === 'soil' ? 'Soil' : 'Petiole'} Test
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!farmId || farmIdNum === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Symbol name="exclamationmark.triangle.fill" size={48} color="#ef4444" />
          <Text className="text-lg font-semibold text-gray-700 mt-4">Invalid Farm</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 bg-gray-200 px-6 py-2 rounded-lg"
          >
            <Text className="text-gray-700 font-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#f2f2f7]">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-lg">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Symbol name="chevron.left" size={24} color="#333" />
        </TouchableOpacity>
        <Symbol name="flask.fill" size={24} color="#408059" />
        <View className="ml-2 flex-1">
          <Text className="text-xl font-bold text-gray-800">Lab Tests</Text>
          {farm && <Text className="text-xs text-gray-500">{farm.name}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (selectedTab === 'soil') {
              router.push(`/soil-trends?farmId=${farmId}`);
            } else {
              router.push(`/petiole-trends?farmId=${farmId}`);
            }
          }}
          className="bg-[#408059] px-3 py-2 rounded-full flex-row items-center mr-2"
        >
          <Symbol name="arrow.up.right" size={16} color="white" />
          <Text className="text-white font-semibold ml-1.5 text-sm">View Trends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="bg-[#408059] p-2 rounded-full"
        >
          <Symbol name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white/80 px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setSelectedTab('soil')}
          className={`flex-1 py-2 mr-2 ${
            selectedTab === 'soil' ? 'border-b-2 border-[#597A61]' : ''
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold uppercase ${
              selectedTab === 'soil' ? 'text-[#597A61]' : 'text-gray-400'
            }`}
          >
            Soil ({soilTests?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('petiole')}
          className={`flex-1 py-2 ml-2 ${
            selectedTab === 'petiole' ? 'border-b-2 border-[#4C806B]' : ''
          }`}
        >
          <Text
            className={`text-center text-sm font-semibold uppercase ${
              selectedTab === 'petiole' ? 'text-[#4C806B]' : 'text-gray-400'
            }`}
          >
            Petiole ({petioleTests?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-gray-500 mt-2">Loading tests...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {selectedTab === 'soil'
            ? soilTests && soilTests.length > 0
              ? soilTests.map((test) => renderTestCard(test, 'soil'))
              : renderEmptyState('soil')
            : petioleTests && petioleTests.length > 0
              ? petioleTests.map((test) => renderTestCard(test, 'petiole'))
              : renderEmptyState('petiole')}
          <View className="h-8" />
        </ScrollView>
      )}

      {/* Add Modal */}
      <AddLabTestModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        farmId={farmIdNum}
        testType={selectedTab}
      />
    </View>
  );
}
