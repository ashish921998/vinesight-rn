/**
 * Soil Profiling Screen
 * View and manage soil moisture profiles for a farm
 */

import React, { useState, useMemo } from 'react';
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
  useSoilProfiles,
  useDeleteSoilProfile,
  calculateAverageMoisture,
  getSectionValue,
  formatProfileDate,
  getMoistureStatus,
  SECTION_INFO,
  SECTION_NAMES,
} from '../src/hooks/useSoilProfiles';
import { SoilProfile } from '../src/types/database';
import AddSoilProfileModal from '../src/components/screens/AddSoilProfileModal';

type TabType = 'history' | 'trends';

export default function SoilProfilingScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const farmIdNum = farmId ? parseInt(farmId, 10) : 0;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: profiles, isLoading: profilesLoading } = useSoilProfiles(farmIdNum);
  const deleteProfile = useDeleteSoilProfile();

  const [selectedTab, setSelectedTab] = useState<TabType>('history');
  const [showAddModal, setShowAddModal] = useState(false);

  const isLoading = farmLoading || profilesLoading;

  // Calculate trends data
  const trendsData = useMemo(() => {
    if (!profiles || profiles.length === 0) return null;

    const avgMoisture = profiles.reduce((sum, p) => {
      return sum + calculateAverageMoisture(p.sections);
    }, 0) / profiles.length;

    const latestProfile = profiles[0];
    const previousProfile = profiles.length > 1 ? profiles[1] : null;

    let moistureChange: number | null = null;
    if (latestProfile && previousProfile) {
      const latestAvg = calculateAverageMoisture(latestProfile.sections);
      const prevAvg = calculateAverageMoisture(previousProfile.sections);
      moistureChange = latestAvg - prevAvg;
    }

    return {
      avgMoisture: Math.round(avgMoisture * 10) / 10,
      profileCount: profiles.length,
      moistureChange,
      latestMoisture: latestProfile
        ? calculateAverageMoisture(latestProfile.sections)
        : 0,
    };
  }, [profiles]);

  const handleDeleteProfile = (profile: SoilProfile) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this soil profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (profile.id) {
              deleteProfile.mutate({ id: profile.id, farmId: farmIdNum });
            }
          },
        },
      ]
    );
  };

  const renderProfileCard = (profile: SoilProfile) => {
    const avgMoisture = calculateAverageMoisture(profile.sections);
    const status = getMoistureStatus(avgMoisture);

    return (
      <View
        key={profile.id}
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
      >
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-sm font-semibold text-gray-800">
              {formatProfileDate(profile.created_at)}
            </Text>
            {profile.fusarium_pct !== null && profile.fusarium_pct !== undefined && (
              <Text className="text-xs text-orange-600">
                Fusarium: {profile.fusarium_pct}%
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            <View
              className="px-3 py-1 rounded-full mr-2"
              style={{ backgroundColor: `${status.color}20` }}
            >
              <Text style={{ color: status.color }} className="text-xs font-semibold">
                {status.label}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteProfile(profile)}
              className="p-2"
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Average Moisture */}
        <View className="bg-blue-50 p-3 rounded-lg mb-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-blue-700">Average Moisture</Text>
            <Text className="text-xl font-bold text-blue-700">{avgMoisture}%</Text>
          </View>
        </View>

        {/* Section Indicators */}
        <View className="flex-row gap-2">
          {SECTION_NAMES.map((name) => {
            const value = getSectionValue(profile.sections, name);
            const info = SECTION_INFO[name];
            return (
              <View
                key={name}
                className="flex-1 p-2 rounded-lg"
                style={{ backgroundColor: `${info.color}15` }}
              >
                <Text
                  className="text-xs font-bold text-center"
                  style={{ color: info.color }}
                >
                  {info.abbr}
                </Text>
                <Text
                  className="text-sm font-semibold text-center"
                  style={{ color: info.color }}
                >
                  {value !== null ? `${value}%` : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-16">
      <View className="w-20 h-20 rounded-full items-center justify-center bg-indigo-50">
        <Ionicons name="layers" size={40} color="#6366F1" />
      </View>
      <Text className="text-lg font-semibold text-gray-700 mt-4">
        No Soil Profiles
      </Text>
      <Text className="text-gray-500 text-center mt-2 px-8">
        Add soil moisture profiles to track your farm's soil health over time.
      </Text>
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        className="mt-4 bg-indigo-600 px-6 py-3 rounded-full flex-row items-center"
      >
        <Ionicons name="add" size={20} color="white" />
        <Text className="text-white font-semibold ml-1">Add First Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTrends = () => {
    if (!trendsData || !profiles || profiles.length < 2) {
      return (
        <View className="flex-1 items-center justify-center py-16">
          <Ionicons name="analytics-outline" size={48} color="#9ca3af" />
          <Text className="text-lg font-semibold text-gray-700 mt-4">
            Not Enough Data
          </Text>
          <Text className="text-gray-500 text-center mt-2 px-8">
            Add at least 2 profiles to see trends.
          </Text>
        </View>
      );
    }

    return (
      <View className="px-4 pt-4">
        {/* Overview Cards */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-xs text-gray-500 mb-1">Avg Moisture</Text>
            <Text className="text-2xl font-bold text-blue-600">
              {trendsData.avgMoisture}%
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-xs text-gray-500 mb-1">Total Profiles</Text>
            <Text className="text-2xl font-bold text-green-600">
              {trendsData.profileCount}
            </Text>
          </View>
        </View>

        {/* Moisture Change */}
        {trendsData.moistureChange !== null && (
          <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <Text className="text-sm text-gray-500 mb-2">Recent Change</Text>
            <View className="flex-row items-center">
              <Ionicons
                name={trendsData.moistureChange >= 0 ? 'arrow-up' : 'arrow-down'}
                size={24}
                color={trendsData.moistureChange >= 0 ? '#10B981' : '#EF4444'}
              />
              <Text
                className={`text-2xl font-bold ml-2 ${
                  trendsData.moistureChange >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(trendsData.moistureChange).toFixed(1)}%
              </Text>
              <Text className="text-gray-500 ml-2">from last profile</Text>
            </View>
          </View>
        )}

        {/* Latest Profile */}
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-sm text-gray-500 mb-2">Latest Moisture</Text>
          <Text className="text-3xl font-bold text-indigo-600">
            {trendsData.latestMoisture}%
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            {profiles[0] && formatProfileDate(profiles[0].created_at)}
          </Text>
        </View>
      </View>
    );
  };

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
        <Ionicons name="layers" size={24} color="#6366F1" />
        <View className="ml-2 flex-1">
          <Text className="text-xl font-bold text-gray-800">Soil Profiling</Text>
          {farm && <Text className="text-xs text-gray-500">{farm.name}</Text>}
        </View>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="bg-indigo-600 p-2 rounded-full"
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-4 py-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setSelectedTab('history')}
          className={`flex-1 py-3 rounded-lg mr-2 ${
            selectedTab === 'history' ? 'bg-indigo-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === 'history' ? 'text-indigo-700' : 'text-gray-600'
            }`}
          >
            📋 History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('trends')}
          className={`flex-1 py-3 rounded-lg ml-2 ${
            selectedTab === 'trends' ? 'bg-indigo-100' : 'bg-gray-100'
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              selectedTab === 'trends' ? 'text-indigo-700' : 'text-gray-600'
            }`}
          >
            📈 Trends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-500 mt-2">Loading profiles...</Text>
        </View>
      ) : selectedTab === 'history' ? (
        <ScrollView
          className="flex-1 px-4 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {profiles && profiles.length > 0
            ? profiles.map(renderProfileCard)
            : renderEmptyState()}
          <View className="h-8" />
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {renderTrends()}
          <View className="h-8" />
        </ScrollView>
      )}

      {/* Add Modal */}
      <AddSoilProfileModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        farmId={farmIdNum}
      />
    </SafeAreaView>
  );
}
