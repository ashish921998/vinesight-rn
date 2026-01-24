/**
 * Soil Profiling Screen
 * View and manage soil moisture profiles for a farm
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
  // Note: profiles are ordered by created_at descending (latest first) via useSoilProfiles hook
  const trendsData = useMemo(() => {
    if (!profiles || profiles.length === 0) return null;

    const avgMoisture =
      profiles.reduce((sum, p) => {
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
      latestMoisture: latestProfile ? calculateAverageMoisture(latestProfile.sections) : 0,
    };
  }, [profiles]);

  const handleDeleteProfile = (profile: SoilProfile) => {
    Alert.alert('Delete Profile', 'Are you sure you want to delete this soil profile?', [
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
    ]);
  };

  const renderProfileCard = (profile: SoilProfile) => {
    const avgMoisture = calculateAverageMoisture(profile.sections);
    const status = getMoistureStatus(avgMoisture);

    return (
      <View
        key={profile.id}
        className="rounded-xl p-4 mb-3"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-sm font-semibold" style={{ color: '#1c1c1e' }}>
              {formatProfileDate(profile.created_at)}
            </Text>
            {profile.fusarium_pct !== null && profile.fusarium_pct !== undefined && (
              <Text className="text-xs" style={{ color: '#ff9500' }}>
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
            <TouchableOpacity onPress={() => handleDeleteProfile(profile)} className="p-2">
              <Ionicons name="trash-outline" size={18} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Average Moisture */}
        <View
          className="p-3 rounded-lg mb-3"
          style={{ backgroundColor: 'rgba(64, 128, 89, 0.08)' }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-sm" style={{ color: '#408059' }}>
              Average Moisture
            </Text>
            <Text className="text-xl font-bold" style={{ color: '#408059' }}>
              {avgMoisture}%
            </Text>
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
                style={{ backgroundColor: 'rgba(64, 128, 89, 0.08)' }}
              >
                <Text className="text-xs font-bold text-center" style={{ color: '#408059' }}>
                  {info.abbr}
                </Text>
                <Text className="text-sm font-semibold text-center" style={{ color: '#408059' }}>
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
      <View
        className="w-20 h-20 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(64, 128, 89, 0.1)' }}
      >
        <Ionicons name="layers" size={40} color="rgba(64, 128, 89, 0.5)" />
      </View>
      <Text className="text-lg font-semibold mt-4" style={{ color: '#1c1c1e' }}>
        No Soil Profiles
      </Text>
      <Text className="text-center mt-2 px-8" style={{ color: '#8e8e93' }}>
        Add soil moisture profiles to track your farm&apos;s soil health over time.
      </Text>
      <TouchableOpacity
        onPress={() => setShowAddModal(true)}
        className="mt-4 px-6 py-3 rounded-full flex-row items-center"
        style={{ backgroundColor: '#408059' }}
      >
        <Ionicons name="add" size={20} color="#ffffff" />
        <Text className="text-white font-semibold ml-1">Add First Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTrends = () => {
    if (!trendsData || !profiles || profiles.length < 2) {
      return (
        <View className="flex-1 items-center justify-center py-16">
          <Ionicons name="analytics-outline" size={48} color="#8e8e93" />
          <Text className="text-lg font-semibold mt-4" style={{ color: '#1c1c1e' }}>
            Not Enough Data
          </Text>
          <Text className="text-center mt-2 px-8" style={{ color: '#8e8e93' }}>
            Add at least 2 profiles to see trends.
          </Text>
        </View>
      );
    }

    return (
      <View className="px-4 pt-4">
        {/* Overview Cards */}
        <View className="flex-row gap-3 mb-4">
          <View
            className="flex-1 rounded-xl p-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-xs mb-1" style={{ color: '#8e8e93' }}>
              Avg Moisture
            </Text>
            <Text className="text-2xl font-bold" style={{ color: '#408059' }}>
              {trendsData.avgMoisture}%
            </Text>
          </View>
          <View
            className="flex-1 rounded-xl p-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Text className="text-xs mb-1" style={{ color: '#8e8e93' }}>
              Total Profiles
            </Text>
            <Text className="text-2xl font-bold" style={{ color: '#408059' }}>
              {trendsData.profileCount}
            </Text>
          </View>
        </View>

        <View
          className="bg-white rounded-t-3xl p-4 mb-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
        >
          <Text className="text-sm font-semibold mb-2" style={{ color: '#8e8e93' }}>
            Recent Change
          </Text>
          <View className="flex-row items-center">
            <Ionicons
              name={
                trendsData.moistureChange !== null && trendsData.moistureChange >= 0
                  ? 'arrow-up'
                  : 'arrow-down'
              }
              size={24}
              color={
                trendsData.moistureChange !== null && trendsData.moistureChange >= 0
                  ? '#10B981'
                  : '#EF4444'
              }
            />
            <Text
              className="text-2xl font-bold ml-2"
              style={{
                color:
                  trendsData.moistureChange !== null && trendsData.moistureChange >= 0
                    ? '#10B981'
                    : '#EF4444',
              }}
            >
              {trendsData.moistureChange !== null
                ? Math.abs(trendsData.moistureChange).toFixed(1)
                : '0.0'}
              %
            </Text>
            <Text className="ml-2" style={{ color: '#8e8e93' }}>
              from last profile
            </Text>
          </View>
        </View>

        {/* Latest Profile */}
        <View
          className="rounded-xl p-4"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <Text className="text-sm mb-2" style={{ color: '#8e8e93' }}>
            Latest Moisture
          </Text>
          <Text className="text-3xl font-bold" style={{ color: '#408059' }}>
            {trendsData.latestMoisture}%
          </Text>
          <Text className="text-xs mt-1" style={{ color: '#c7c7cc' }}>
            {profiles[0] && formatProfileDate(profiles[0].created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (!farmId || farmIdNum === 0) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#f2f2f7' }}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="layers-outline" size={64} color="#8e8e93" />
          <Text className="text-lg font-semibold mt-4" style={{ color: '#1c1c1e' }}>
            Select a Farm First
          </Text>
          <Text className="text-center mt-2" style={{ color: '#8e8e93' }}>
            Soil profiles are associated with specific farms. Please select a farm to view its soil
            profiles.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/farms')}
            className="mt-6 px-6 py-3 rounded-full"
            style={{ backgroundColor: '#408059' }}
          >
            <Text className="font-semibold" style={{ color: '#ffffff' }}>
              Go to Farms
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: '#f2f2f7' }}>
      <LinearGradient
        colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
        style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
      />
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#408059" />
        </TouchableOpacity>
        <Ionicons name="layers" size={24} color="#408059" />
        <View className="ml-2 flex-1">
          <Text className="text-xl font-bold" style={{ color: '#1c1c1e' }}>
            Soil Profiling
          </Text>
          {farm && (
            <Text className="text-xs" style={{ color: '#8e8e93' }}>
              {farm.name}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowAddModal(true)} className="p-2">
          <Ionicons name="add-circle" size={28} color="#408059" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
        <TouchableOpacity
          onPress={() => setSelectedTab('history')}
          className={`flex-1 py-3 mr-4 ${selectedTab === 'history' ? 'border-b-2 border-[#408059]' : ''}`}
        >
          <Text
            className={`text-center font-semibold text-sm uppercase ${
              selectedTab === 'history' ? 'text-[#408059]' : 'text-[#8e8e93]'
            }`}
          >
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('trends')}
          className={`flex-1 py-3 ${selectedTab === 'trends' ? 'border-b-2 border-[#408059]' : ''}`}
        >
          <Text
            className={`text-center font-semibold text-sm uppercase ${
              selectedTab === 'trends' ? 'text-[#408059]' : 'text-[#8e8e93]'
            }`}
          >
            Trends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#408059" />
          <Text className="mt-2" style={{ color: '#8e8e93' }}>
            Loading profiles...
          </Text>
        </View>
      ) : selectedTab === 'history' ? (
        <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
          {profiles && profiles.length > 0 ? profiles.map(renderProfileCard) : renderEmptyState()}
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
