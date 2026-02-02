/**
 * Soil Profiling Screen
 * View and manage soil moisture profiles for a farm
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Symbol } from '@/components/ui/symbol';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from '../src/hooks/use-soil-profiles';
import { SoilProfile } from '../src/types/database';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

type TabType = 'history' | 'trends';

export default function SoilProfilingScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const farmIdNum = farmId ? parseInt(farmId, 10) : 0;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: profiles, isLoading: profilesLoading } = useSoilProfiles(farmIdNum);
  const deleteProfile = useDeleteSoilProfile();

  const [selectedTab, setSelectedTab] = useState<TabType>('history');

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
    Alert.alert(
      t('soilProfiling.alerts.deleteProfileTitle'),
      t('soilProfiling.alerts.deleteProfileBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            if (profile.id) {
              deleteProfile.mutate({ id: profile.id, farmId: farmIdNum });
            }
          },
        },
      ],
    );
  };

  const renderProfileCard = (profile: SoilProfile) => {
    const avgMoisture = calculateAverageMoisture(profile.sections);
    const status = getMoistureStatus(avgMoisture);

    return (
      <View
        key={profile.id}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: borderRadius.xl,
          padding: spacing[4],
          marginBottom: spacing[3],
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
          <View>
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: colors.surface[900],
              }}
            >
              {formatProfileDate(profile.created_at)}
            </Text>
            {profile.fusarium_pct !== null && profile.fusarium_pct !== undefined && (
              <Text style={{ fontSize: fontSize.xs, color: '#ff9500' }}>
                Fusarium: {profile.fusarium_pct}%
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                borderRadius: borderRadius.full,
                marginRight: spacing[2],
                backgroundColor: `${status.color}20`,
              }}
            >
              <Text
                style={{
                  color: status.color,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {t(status.labelKey)}
              </Text>
            </View>
            <Pressable onPress={() => handleDeleteProfile(profile)} style={{ padding: spacing[2] }}>
              <Symbol name="trash" size={18} color="#ff3b30" />
            </Pressable>
          </View>
        </View>

        {/* Average Moisture */}
        <View
          style={{
            backgroundColor: 'rgba(64, 128, 89, 0.08)',
            padding: spacing[3],
            borderRadius: borderRadius.lg,
            marginBottom: spacing[3],
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.primary[600] }}>
              Average Moisture
            </Text>
            <Text
              style={{
                fontSize: fontSize.xl,
                fontWeight: fontWeight.bold,
                color: colors.primary[600],
              }}
            >
              {avgMoisture}%
            </Text>
          </View>
        </View>

        {/* Section Indicators */}
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {SECTION_NAMES.map((name) => {
            const value = getSectionValue(profile.sections, name);
            const info = SECTION_INFO[name];
            return (
              <View
                key={name}
                style={{
                  backgroundColor: 'rgba(64, 128, 89, 0.08)',
                  flex: 1,
                  padding: spacing[2],
                  borderRadius: borderRadius.lg,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    textAlign: 'center',
                    color: colors.primary[600],
                  }}
                >
                  {info.abbr}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    textAlign: 'center',
                    color: colors.primary[600],
                  }}
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
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing[16],
      }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(64, 128, 89, 0.1)',
        }}
      >
        <Symbol name="layers" size={40} color="rgba(64, 128, 89, 0.5)" />
      </View>
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          marginTop: spacing[4],
          color: colors.surface[900],
        }}
      >
        No Soil Profiles
      </Text>
      <Text
        style={{
          textAlign: 'center',
          marginTop: spacing[2],
          paddingHorizontal: spacing[8],
          color: colors.surface[500],
        }}
      >
        Add soil moisture profiles to track your farm&apos;s soil health over time.
      </Text>
      <Pressable
        onPress={() =>
          router.push({ pathname: '/add-soil-profile', params: { farmId: farmIdNum.toString() } })
        }
        style={{
          marginTop: spacing[4],
          paddingHorizontal: spacing[6],
          paddingVertical: spacing[3],
          borderRadius: borderRadius.full,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#408059',
        }}
      >
        <Symbol name="plus" size={20} color="#ffffff" />
        <Text
          style={{ color: colors.white, fontWeight: fontWeight.semibold, marginLeft: spacing[1] }}
        >
          Add First Profile
        </Text>
      </Pressable>
    </View>
  );

  const renderTrends = () => {
    if (!trendsData || !profiles || profiles.length < 2) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing[16],
          }}
        >
          <Symbol name="analytics-outline" size={48} color="#8e8e93" />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              marginTop: spacing[4],
              color: colors.surface[900],
            }}
          >
            Not Enough Data
          </Text>
          <Text
            style={{
              textAlign: 'center',
              marginTop: spacing[2],
              paddingHorizontal: spacing[8],
              color: colors.surface[500],
            }}
          >
            Add at least 2 profiles to see trends.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
        {/* Overview Cards */}
        <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: spacing[4] }}>
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              flex: 1,
              borderRadius: borderRadius.xl,
              padding: spacing[4],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                marginBottom: spacing[1],
                color: colors.surface[500],
              }}
            >
              Avg Moisture
            </Text>
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: colors.primary[600],
              }}
            >
              {trendsData.avgMoisture}%
            </Text>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              flex: 1,
              borderRadius: borderRadius.xl,
              padding: spacing[4],
            }}
          >
            <Text
              style={{
                fontSize: fontSize.xs,
                marginBottom: spacing[1],
                color: colors.surface[500],
              }}
            >
              Total Profiles
            </Text>
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: colors.primary[600],
              }}
            >
              {trendsData.profileCount}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: borderRadius['3xl'],
            padding: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              marginBottom: spacing[2],
              color: colors.surface[500],
            }}
          >
            Recent Change
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Symbol
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
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                marginLeft: spacing[2],
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
            <Text style={{ marginLeft: spacing[2], color: colors.surface[500] }}>
              from last profile
            </Text>
          </View>
        </View>

        {/* Latest Profile */}
        <View
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderRadius: borderRadius.xl,
            padding: spacing[4],
          }}
        >
          <Text
            style={{ fontSize: fontSize.sm, marginBottom: spacing[2], color: colors.surface[500] }}
          >
            Latest Moisture
          </Text>
          <Text
            style={{
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              color: colors.primary[600],
            }}
          >
            {trendsData.latestMoisture}%
          </Text>
          <Text
            style={{ fontSize: fontSize.xs, marginTop: spacing[1], color: colors.surface[300] }}
          >
            {profiles[0] && formatProfileDate(profiles[0].created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (!farmId || farmIdNum === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[8],
          }}
        >
          <Symbol name="layers-outline" size={64} color="#8e8e93" />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              marginTop: spacing[4],
              color: colors.surface[900],
            }}
          >
            {t('soilProfiling.noFarm.title')}
          </Text>
          <Text style={{ textAlign: 'center', marginTop: spacing[2], color: colors.surface[500] }}>
            {t('soilProfiling.noFarm.subtitle')}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/farms')}
            style={{
              marginTop: spacing[6],
              paddingHorizontal: spacing[6],
              paddingVertical: spacing[3],
              borderRadius: borderRadius.full,
              backgroundColor: '#408059',
            }}
          >
            <Text style={{ fontWeight: fontWeight.semibold, color: colors.white }}>
              {t('soilProfiling.noFarm.cta')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
      <LinearGradient
        colors={['rgba(64, 128, 89, 0.08)', 'transparent']}
        style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
      />
      {/* Header */}
      <View
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3] + insets.top,
          paddingBottom: spacing[3],
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Symbol name="chevron.left" size={24} color="#408059" />
        </Pressable>
        <Symbol name="layers" size={24} color="#408059" />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: colors.surface[900],
            }}
          >
            {t('soilProfiling.title')}
          </Text>
          {farm && (
            <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>{farm.name}</Text>
          )}
        </View>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/add-soil-profile', params: { farmId: farmIdNum.toString() } })
          }
          style={{ padding: spacing[2] }}
        >
          <Symbol name="add-circle" size={28} color="#408059" />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
        }}
      >
        <Pressable
          onPress={() => setSelectedTab('history')}
          style={{
            flex: 1,
            paddingVertical: spacing[3],
            marginRight: spacing[4],
            borderBottomWidth: selectedTab === 'history' ? 2 : 0,
            borderBottomColor: selectedTab === 'history' ? '#408059' : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.sm,
              textTransform: 'uppercase',
              color: selectedTab === 'history' ? '#408059' : '#8e8e93',
            }}
          >
            {t('soilProfiling.tabs.history')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedTab('trends')}
          style={{
            flex: 1,
            paddingVertical: spacing[3],
            borderBottomWidth: selectedTab === 'trends' ? 2 : 0,
            borderBottomColor: selectedTab === 'trends' ? '#408059' : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.sm,
              textTransform: 'uppercase',
              color: selectedTab === 'trends' ? '#408059' : '#8e8e93',
            }}
          >
            {t('soilProfiling.tabs.trends')}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#408059" />
          <Text style={{ marginTop: spacing[2], color: colors.surface[500] }}>
            {t('soilProfiling.loading')}
          </Text>
        </View>
      ) : selectedTab === 'history' ? (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: spacing[4], paddingTop: spacing[4] }}
          showsVerticalScrollIndicator={false}
        >
          {profiles && profiles.length > 0 ? profiles.map(renderProfileCard) : renderEmptyState()}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {renderTrends()}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}

      {/* Add Modal */}
      {/* Soil profile creation handled via route */}
    </View>
  );
}
