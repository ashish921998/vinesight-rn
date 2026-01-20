/**
 * Lab Tests Screen
 * View and manage soil/petiole test records for a farm
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFarm } from '../src/hooks';
import {
  useSoilTests,
  usePetioleTests,
  useDeleteSoilTest,
  useDeletePetioleTest,
  formatParameterKey,
  getParameterUnit,
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
    Alert.alert(
      'Delete Test',
      'Are you sure you want to delete this soil test?',
      [
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
      ]
    );
  };

  const handleDeletePetioleTest = (test: PetioleTestRecord) => {
    Alert.alert(
      'Delete Test',
      'Are you sure you want to delete this petiole test?',
      [
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
      ]
    );
  };

  const renderTestCard = (
    test: SoilTestRecord | PetioleTestRecord,
    type: TestType
  ) => {
    const isSoil = type === 'soil';
    const params = Object.entries(test.parameters || {}).slice(0, 8);

    return (
      <View
        key={test.id}
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isSoil ? 'bg-amber-100' : 'bg-green-100'
              }`}
            >
              <Ionicons
                name={isSoil ? 'leaf' : 'leaf-outline'}
                size={20}
                color={isSoil ? '#d97706' : '#16a34a'}
              />
            </View>
            <View className="ml-3">
              <Text className="text-sm font-semibold text-gray-800">
                {isSoil ? 'Soil Analysis' : 'Petiole Analysis'}
              </Text>
              <Text className="text-xs text-gray-500">{test.date}</Text>
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
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Parameters Grid */}
        {params.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mb-3">
            {params.map(([key, value]) => (
              <View
                key={key}
                className="bg-gray-50 px-3 py-2 rounded-lg min-w-[70px]"
              >
                <Text className="text-xs text-gray-500">
                  {formatParameterKey(key)}
                </Text>
                <Text className="text-sm font-semibold text-gray-800">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                  <Text className="text-xs font-normal text-gray-500">
                    {' '}
                    {getParameterUnit(key, isSoil)}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendations */}
        {test.recommendations && (
          <View className="bg-blue-50 p-3 rounded-lg mb-2">
            <Text className="text-xs font-medium text-blue-700 mb-1">
              Recommendations
            </Text>
            <Text className="text-sm text-blue-800">{test.recommendations}</Text>
          </View>
        )}

        {/* Notes */}
        {test.notes && (
          <Text className="text-sm text-gray-600 italic">{test.notes}</Text>
        )}
      </View>
    );
  };

  const renderEmptyState = (type: TestType) => (
    <View className="flex-1 items-center justify-center py-16">
      <View
        className={`w-20 h-20 rounded-full items-center justify-center ${
          type === 'soil' ? 'bg-amber-50' : 'bg-green-50'
        }`}
      >
        <Ionicons
          name={type === 'soil' ? 'leaf' : 'leaf-outline'}
          size={40}
          color={type === 'soil' ? '#d97706' : '#16a34a'}
        />
      </View>
      <Text className="text-lg font-semibold text-gray-700 mt-4">
        No {type === 'soil' ? 'Soil' : 'Petiole'} Tests
      </Text>
      <Text className="text-gray-500 text-center mt-2 px-8">
        Add a {type} test to track nutrient levels and get recommendations.
      </Text>
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        className="mt-4 bg-green-600 px-6 py-3 rounded-full flex-row items-center"
      >
        <Ionicons name="add" size={20} color="white" />
        <Text className="text-white font-semibold ml-1">
          Add {type === 'soil' ? 'Soil' : 'Petiole'} Test
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!farmId || farmIdNum === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-lg font-semibold text-gray-700 mt-4">
            Invalid Farm
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-4 bg-gray-200 px-6 py-2 rounded-lg"
          >
            <Text className="text-gray-700 font-medium">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Ionicons name="flask" size={24} color="#8b5cf6" />
        <View className="ml-2 flex-1">
          <Text className="text-xl font-bold text-gray-800">Lab Tests</Text>
          {farm && (
            <Text className="text-xs text-gray-500">{farm.name}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="bg-green-600 p-2 rounded-full"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-4 py-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setSelectedTab('soil')}
          className={`flex-1 py-3 rounded-lg mr-2 ${
            selectedTab === 'soil' ? 'bg-amber-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === 'soil' ? 'text-amber-700' : 'text-gray-600'
            }`}
          >
            🌱 Soil ({soilTests?.length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('petiole')}
          className={`flex-1 py-3 rounded-lg ml-2 ${
            selectedTab === 'petiole' ? 'bg-green-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === 'petiole' ? 'text-green-700' : 'text-gray-600'
            }`}
          >
            🍃 Petiole ({petioleTests?.length || 0})
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
          {selectedTab === 'soil' ? (
            soilTests && soilTests.length > 0 ? (
              soilTests.map((test) => renderTestCard(test, 'soil'))
            ) : (
              renderEmptyState('soil')
            )
          ) : petioleTests && petioleTests.length > 0 ? (
            petioleTests.map((test) => renderTestCard(test, 'petiole'))
          ) : (
            renderEmptyState('petiole')
          )}
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
    </SafeAreaView>
  );
}
