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
import { useCapabilities } from '@/hooks/use-capabilities';
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
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';
import { FeatureLockCard } from '@/components/subscription/feature-lock-card';

type TabType = 'history' | 'trends';

export default function SoilProfilingScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const farmIdNum = farmId ? parseInt(farmId, 10) : 0;

  const { data: farm, isLoading: farmLoading } = useFarm(farmIdNum);
  const { data: profiles, isLoading: profilesLoading } = useSoilProfiles(farmIdNum);
  const deleteProfile = useDeleteSoilProfile();
  const { data: capabilities } = useCapabilities();
  const canViewTrends = capabilities.capabilities.soilWater.moistureTrends;

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
          backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
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
              <Text style={{ fontSize: fontSize.xs, color: colors.warning }}>
                {t('soilProfiling.fusarium', { value: profile.fusarium_pct })}
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
              <Symbol name="trash" size={18} color={m3.colorScheme.error} />
            </Pressable>
          </View>
        </View>

        {/* Average Moisture */}
        <View
          style={{
            backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
            padding: spacing[3],
            borderRadius: borderRadius.lg,
            marginBottom: spacing[3],
          }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: fontSize.sm, color: m3.colorScheme.primary }}>
              {t('soilProfiling.averageMoisture')}
            </Text>
            <Text
              style={{
                fontSize: fontSize.xl,
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.primary,
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
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.08),
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
                    color: m3.colorScheme.primary,
                  }}
                >
                  {info.abbr}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    textAlign: 'center',
                    color: m3.colorScheme.primary,
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
          backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
        }}
      >
        <Symbol name="layers" size={40} color={colorWithOpacity(m3.colorScheme.primary, 0.5)} />
      </View>
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          marginTop: spacing[4],
          color: colors.surface[900],
        }}
      >
        {t('soilProfiling.noProfiles')}
      </Text>
      <Text
        style={{
          textAlign: 'center',
          marginTop: spacing[2],
          paddingHorizontal: spacing[8],
          color: colors.surface[500],
        }}
      >
        {t('soilProfiling.noProfilesDescription')}
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
          backgroundColor: m3.colorScheme.primary,
        }}
      >
        <Symbol name="plus" size={20} color={m3.colorScheme.onPrimary} />
        <Text
          style={{
            color: m3.colorScheme.onPrimary,
            fontWeight: fontWeight.semibold,
            marginLeft: spacing[1],
          }}
        >
          {t('soilProfiling.addFirstProfile')}
        </Text>
      </Pressable>
    </View>
  );

  const renderTrends = () => {
    if (!canViewTrends) {
      return (
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[6] }}>
          <FeatureLockCard
            title={t('subscription.locks.soilTrends.title')}
            description={t('subscription.locks.soilTrends.description')}
            ctaLabel={t('subscription.locks.cta')}
            featureKey="soilTrends"
            onUpgrade={() => router.push('/paywall?source=soilTrends')}
          />
        </View>
      );
    }
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
          <Symbol
            name="analytics-outline"
            size={48}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          />
          <Text
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              marginTop: spacing[4],
              color: colors.surface[900],
            }}
          >
            {t('soilProfiling.notEnoughData')}
          </Text>
          <Text
            style={{
              textAlign: 'center',
              marginTop: spacing[2],
              paddingHorizontal: spacing[8],
              color: colors.surface[500],
            }}
          >
            {t('soilProfiling.notEnoughDataDescription')}
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
              backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
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
              {t('soilProfiling.avgMoisture')}
            </Text>
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.primary,
              }}
            >
              {trendsData.avgMoisture}%
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
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
              {t('soilProfiling.totalProfiles')}
            </Text>
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: m3.colorScheme.primary,
              }}
            >
              {trendsData.profileCount}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: colorWithOpacity(colors.surface[100], 0.9),
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
            {t('soilProfiling.recentChange')}
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
                  ? colors.success
                  : m3.colorScheme.error
              }
            />
            <Text
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                marginLeft: spacing[2],
                color:
                  trendsData.moistureChange !== null && trendsData.moistureChange >= 0
                    ? colors.success
                    : m3.colorScheme.error,
              }}
            >
              {trendsData.moistureChange !== null
                ? Math.abs(trendsData.moistureChange).toFixed(1)
                : '0.0'}
              %
            </Text>
            <Text style={{ marginLeft: spacing[2], color: colors.surface[500] }}>
              {t('soilProfiling.fromLastProfile')}
            </Text>
          </View>
        </View>

        {/* Latest Profile */}
        <View
          style={{
            backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
            borderRadius: borderRadius.xl,
            padding: spacing[4],
          }}
        >
          <Text
            style={{ fontSize: fontSize.sm, marginBottom: spacing[2], color: colors.surface[500] }}
          >
            {t('soilProfiling.latestMoisture')}
          </Text>
          <Text
            style={{
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.primary,
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
      <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[8],
          }}
        >
          <Symbol
            name="layers-outline"
            size={64}
            color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
          />
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
              backgroundColor: m3.colorScheme.primary,
            }}
          >
            <Text style={{ fontWeight: fontWeight.semibold, color: m3.colorScheme.onPrimary }}>
              {t('soilProfiling.noFarm.cta')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: m3.colorScheme.background }}>
      <LinearGradient
        colors={[colorWithOpacity(m3.colorScheme.primary, 0.08), 'transparent']}
        style={{ height: 300, position: 'absolute', top: 0, left: 0, right: 0 }}
      />
      {/* Header */}
      <View
        style={{
          backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
          borderBottomWidth: 0.5,
          borderBottomColor: colorWithOpacity(m3.colorScheme.onSurface, 0.12),
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3] + insets.top,
          paddingBottom: spacing[3],
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing[3] }}>
          <Symbol name="chevron.left" size={24} color={m3.colorScheme.primary} />
        </Pressable>
        <Symbol name="layers" size={24} color={m3.colorScheme.primary} />
        <View style={{ marginLeft: spacing[2], flex: 1 }}>
          <Text
            style={{
              fontSize: fontSize.xl,
              fontWeight: fontWeight.bold,
              color: m3.colorScheme.onSurface,
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
          <Symbol name="add-circle" size={28} color={m3.colorScheme.primary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colorWithOpacity(colors.surface[100], 0.85),
        }}
      >
        <Pressable
          onPress={() => setSelectedTab('history')}
          style={{
            flex: 1,
            paddingVertical: spacing[3],
            marginRight: spacing[4],
            borderBottomWidth: selectedTab === 'history' ? 2 : 0,
            borderBottomColor: selectedTab === 'history' ? m3.colorScheme.primary : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.sm,
              textTransform: 'uppercase',
              color:
                selectedTab === 'history'
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
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
            borderBottomColor: selectedTab === 'trends' ? m3.colorScheme.primary : 'transparent',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.sm,
              textTransform: 'uppercase',
              color:
                selectedTab === 'trends'
                  ? m3.colorScheme.primary
                  : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7),
            }}
          >
            {t('soilProfiling.tabs.trends')}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={m3.colorScheme.primary} />
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
