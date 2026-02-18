import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Symbol as Icon } from '@/components/ui/symbol';
import { ICON_REGISTRY, resolveSymbolIconName } from '@/constants/icon-registry';
import { useFarms } from '../src/hooks';
import { useWeatherData } from '../src/hooks/use-weather';
import { GrapeGrowthStage, SoilType } from '../src/types/weather';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { formatDate } from '@/i18n/format';
import { useM3, useThemeColors } from '@/styles/use-theme';
import { colorWithOpacity } from '@/utils/color';

// Growth stages
const GROWTH_STAGES: GrapeGrowthStage[] = [
  'Budbreak',
  'Leaf development',
  'Flowering',
  'Fruit set',
  'Veraison',
  'Harvest',
  'Post-harvest',
  'Dormant',
];

// Soil types
const SOIL_TYPES: { value: SoilType; label: string }[] = [
  { value: 'sandy', label: 'Sandy' },
  { value: 'medium', label: 'Medium (Loam)' },
  { value: 'clay', label: 'Clay' },
];

// Weather condition icons
function getWeatherIconName(conditionCode: number): string {
  switch (conditionCode) {
    case 1000:
      return 'sun.max.fill';
    case 1003:
      return 'cloud.sun.fill';
    case 1006:
      return 'cloud.fill';
    case 1153:
      return 'cloud.drizzle.fill';
    case 1186:
      return 'cloud.rain.fill';
    default:
      return 'cloud.fill';
  }
}

// Day name helper
function getDayName(dateString: string, t: TFunction): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return t('tasks.dueDate.today');
  if (date.toDateString() === tomorrow.toDateString()) return t('tasks.dueDate.tomorrow');
  return formatDate(date, { weekday: 'short' });
}

export default function WeatherScreen() {
  const colors = useThemeColors();
  const m3 = useM3();
  const { t } = useTranslation();
  const { farmId: farmIdParam } = useLocalSearchParams<{ farmId?: string }>();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [growthStage, setGrowthStage] = useState<GrapeGrowthStage>('Fruit set');
  const [soilType, setSoilType] = useState<SoilType>('medium');
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showGrowthPicker, setShowGrowthPicker] = useState(false);
  const [showSoilPicker, setShowSoilPicker] = useState(false);
  const urgencyColors = useMemo(
    () => ({
      low: { bg: colorWithOpacity(colors.success, 0.16), text: colors.success },
      medium: { bg: colorWithOpacity(colors.warning, 0.18), text: colors.warning },
      high: { bg: colorWithOpacity(m3.colorScheme.error, 0.16), text: m3.colorScheme.error },
    }),
    [colors.success, colors.warning, m3.colorScheme.error],
  );

  const requestedFarmId = useMemo(() => {
    if (!farmIdParam) return null;
    const parsed = Number.parseInt(farmIdParam, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [farmIdParam]);

  const defaultFarmId = useMemo(() => {
    if (!farms || farms.length === 0) return null;
    if (requestedFarmId !== null) {
      const matchedFarm = farms.find((farm) => farm.id === requestedFarmId);
      if (matchedFarm && typeof matchedFarm.id === 'number') {
        return matchedFarm.id;
      }
    }
    const firstFarmId = farms[0]?.id;
    return typeof firstFarmId === 'number' ? firstFarmId : null;
  }, [farms, requestedFarmId]);
  const effectiveSelectedFarmId = useMemo(
    () => selectedFarmId ?? defaultFarmId,
    [selectedFarmId, defaultFarmId],
  );

  // Get selected farm coordinates
  const selectedFarm = useMemo(() => {
    if (!farms || farms.length === 0) return null;
    if (effectiveSelectedFarmId !== null) {
      return farms.find((f) => f.id === effectiveSelectedFarmId) || farms[0];
    }
    return farms[0];
  }, [farms, effectiveSelectedFarmId]);

  // Fetch weather data
  const { weather, etc, alerts, irrigationSchedule, isLoading, error, refetch, isRefetching } =
    useWeatherData(
      selectedFarm?.latitude ?? undefined,
      selectedFarm?.longitude ?? undefined,
      growthStage,
      soilType,
    );

  if (farmsLoading || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <Icon
          name="cloud.slash.fill"
          size={48}
          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
        />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          {t('weather.errors.unableToLoad')}
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            marginTop: spacing[2],
            textAlign: 'center',
          }}
        >
          {error.message}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={{
            marginTop: spacing[4],
            backgroundColor: colors.primary[600],
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: borderRadius.xl,
          }}
        >
          <Text style={{ color: m3.colorScheme.onPrimary, fontWeight: fontWeight.semibold }}>
            {t('common.tryAgain')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface[50],
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <Icon
          name="leaf.fill"
          size={48}
          color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
        />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          {t('weather.empty.noFarmsTitle')}
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            marginTop: spacing[2],
            textAlign: 'center',
          }}
        >
          {t('weather.empty.noFarmsSubtitle')}
        </Text>
      </View>
    );
  }

  const hasCoordinates =
    Number.isFinite(selectedFarm?.latitude) && Number.isFinite(selectedFarm?.longitude);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: m3.colorScheme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
        style={{ backgroundColor: m3.colorScheme.background }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={m3.colorScheme.primary}
          />
        }
      >
        {/* Farm Selector */}
        <View style={{ marginBottom: spacing[4] }}>
          <Text
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              color: colors.surface[500],
              letterSpacing: 1,
              marginBottom: spacing[2],
            }}
          >
            {t('glossary.farm')}
          </Text>
          <Pressable
            onPress={() => setShowFarmPicker(!showFarmPicker)}
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="leaf.fill" size={20} color={m3.colorScheme.primary} />
              </View>
              <View style={{ marginLeft: spacing[3] }}>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {selectedFarm?.name || t('dashboard.farmPicker.title')}
                </Text>
                {hasCoordinates && (
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {selectedFarm?.latitude?.toFixed(4)}, {selectedFarm?.longitude?.toFixed(4)}
                  </Text>
                )}
              </View>
            </View>
            <Icon
              name={showFarmPicker ? 'chevron.up' : 'chevron.down'}
              size={20}
              color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
            />
          </Pressable>
          {showFarmPicker && (
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.xl,
                marginTop: spacing[2],
                overflow: 'hidden',
              }}
            >
              {farms.map((farm) => (
                <Pressable
                  key={farm.id}
                  onPress={() => {
                    if (farm.id !== undefined) setSelectedFarmId(farm.id);
                    setShowFarmPicker(false);
                  }}
                  style={{
                    padding: spacing[4],
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surface[200],
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor:
                      effectiveSelectedFarmId === farm.id
                        ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                        : colors.surface[100],
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color:
                        effectiveSelectedFarmId === farm.id
                          ? m3.colorScheme.primary
                          : colors.surface[700],
                      fontWeight:
                        effectiveSelectedFarmId === farm.id
                          ? fontWeight.semibold
                          : fontWeight.normal,
                    }}
                  >
                    {farm.name}
                  </Text>
                  {effectiveSelectedFarmId === farm.id && (
                    <Icon name="checkmark" size={20} color={m3.colorScheme.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* No coordinates warning */}
        {!hasCoordinates && (
          <View
            style={{
              backgroundColor: colorWithOpacity(colors.warning, 0.18),
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              marginBottom: spacing[4],
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Icon name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
            <Text
              style={{
                color: colors.warning,
                fontSize: fontSize.sm,
                marginLeft: spacing[3],
                flex: 1,
              }}
            >
              {t('weather.warnings.noCoordinates')}
            </Text>
          </View>
        )}

        {/* Settings Row */}
        <View style={{ flexDirection: 'row', marginBottom: spacing[4], gap: 12 }}>
          {/* Growth Stage Picker */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.surface[500],
                letterSpacing: 1,
                marginBottom: spacing[2],
              }}
            >
              {t('weather.pickers.growthStage')}
            </Text>
            <Pressable
              onPress={() => setShowGrowthPicker(!showGrowthPicker)}
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.xl,
                padding: spacing[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[900] }} numberOfLines={1}>
                {growthStage}
              </Text>
              <Icon
                name="chevron.down"
                size={16}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              />
            </Pressable>
            {showGrowthPicker && (
              <View
                style={{
                  backgroundColor: colors.surface[100],
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  position: 'absolute',
                  top: 64,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {GROWTH_STAGES.map((stage) => (
                    <Pressable
                      key={stage}
                      onPress={() => {
                        setGrowthStage(stage);
                        setShowGrowthPicker(false);
                      }}
                      style={{
                        padding: spacing[3],
                        borderBottomWidth: 1,
                        borderBottomColor: colors.surface[200],
                        backgroundColor:
                          growthStage === stage
                            ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                            : colors.surface[100],
                      }}
                    >
                      <Text
                        style={{
                          color:
                            growthStage === stage ? m3.colorScheme.primary : colors.surface[700],
                          fontWeight: growthStage === stage ? fontWeight.medium : fontWeight.normal,
                        }}
                      >
                        {stage}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Soil Type Picker */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.surface[500],
                letterSpacing: 1,
                marginBottom: spacing[2],
              }}
            >
              {t('weather.pickers.soilType')}
            </Text>
            <Pressable
              onPress={() => setShowSoilPicker(!showSoilPicker)}
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius.xl,
                padding: spacing[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[900] }} numberOfLines={1}>
                {SOIL_TYPES.find((s) => s.value === soilType)?.label}
              </Text>
              <Icon
                name="chevron.down"
                size={16}
                color={colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)}
              />
            </Pressable>
            {showSoilPicker && (
              <View
                style={{
                  backgroundColor: colors.surface[100],
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  position: 'absolute',
                  top: 64,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  borderWidth: 1,
                  borderColor: colors.surface[200],
                }}
              >
                {SOIL_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    onPress={() => {
                      setSoilType(type.value);
                      setShowSoilPicker(false);
                    }}
                    style={{
                      padding: spacing[3],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surface[200],
                      backgroundColor:
                        soilType === type.value
                          ? colorWithOpacity(m3.colorScheme.primary, 0.12)
                          : colors.surface[100],
                    }}
                  >
                    <Text
                      style={{
                        color:
                          soilType === type.value ? m3.colorScheme.primary : colors.surface[700],
                        fontWeight: soilType === type.value ? fontWeight.medium : fontWeight.normal,
                      }}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Current Weather Card */}
        {weather && (
          <View
            style={{
              backgroundColor: m3.colorScheme.primary,
              borderRadius: borderRadius['2xl'],
              padding: spacing[5],
              marginBottom: spacing[4],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text style={{ color: m3.colorScheme.onPrimary, fontSize: fontSize.sm }}>
                  {weather.location.name || t('weather.location.currentLocation')}
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: 48,
                    fontWeight: fontWeight.bold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.temperature}°
                </Text>
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.base,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.condition}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Icon
                  name={getWeatherIconName(weather.current.conditionCode)}
                  size={56}
                  color={colorWithOpacity(m3.colorScheme.onPrimary, 0.9)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.xs,
                    marginTop: spacing[2],
                  }}
                >
                  {t('weather.location.feelsLike')} {weather.current.feelsLike}°
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginTop: spacing[4],
                paddingTop: spacing[4],
                borderTopWidth: 1,
                borderTopColor: colorWithOpacity(m3.colorScheme.onPrimary, 0.3),
              }}
            >
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon
                  name="drop.fill"
                  size={18}
                  color={colorWithOpacity(m3.colorScheme.onPrimary, 0.8)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.humidity}%
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity(m3.colorScheme.onPrimary, 0.8),
                    fontSize: fontSize.xs,
                  }}
                >
                  {t('weather.labels.humidity')}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon
                  name="gauge"
                  size={18}
                  color={colorWithOpacity(m3.colorScheme.onPrimary, 0.8)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.windSpeed} km/h
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity(m3.colorScheme.onPrimary, 0.8),
                    fontSize: fontSize.xs,
                  }}
                >
                  {t('weather.labels.wind')}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon
                  name="sun.max.fill"
                  size={18}
                  color={colorWithOpacity(m3.colorScheme.onPrimary, 0.8)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.uvIndex}
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity(m3.colorScheme.onPrimary, 0.8),
                    fontSize: fontSize.xs,
                  }}
                >
                  {t('weather.labels.uvIndex')}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon
                  name="cloud.rain.fill"
                  size={18}
                  color={colorWithOpacity(m3.colorScheme.onPrimary, 0.8)}
                />
                <Text
                  style={{
                    color: m3.colorScheme.onPrimary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.precipitation} mm
                </Text>
                <Text
                  style={{
                    color: colorWithOpacity(m3.colorScheme.onPrimary, 0.8),
                    fontSize: fontSize.xs,
                  }}
                >
                  {t('weather.labels.rain')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 7-Day Forecast */}
        {weather && (
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.surface[500],
                letterSpacing: 1,
                marginBottom: spacing[3],
              }}
            >
              {t('weather.sections.forecast7Day')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {weather.forecast.map((day, index) => (
                <View
                  key={day.date}
                  style={{
                    width: 80,
                    backgroundColor: colors.surface[100],
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    alignItems: 'center',
                    borderWidth: index === 0 ? 2 : 0,
                    borderColor: index === 0 ? m3.colorScheme.primary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: index === 0 ? m3.colorScheme.primary : colors.surface[600],
                    }}
                  >
                    {getDayName(day.date, t)}
                  </Text>
                  <Icon
                    name={getWeatherIconName(day.conditionCode)}
                    size={28}
                    color={
                      index === 0
                        ? m3.colorScheme.primary
                        : colorWithOpacity(m3.colorScheme.onSurfaceVariant, 0.7)
                    }
                    style={{ marginVertical: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.bold,
                      color: colors.surface[900],
                    }}
                  >
                    {day.maxTemp}°
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {day.minTemp}°
                  </Text>
                  {day.precipitationProbability > 0 && (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[1] }}
                    >
                      <Icon name="drop.fill" size={10} color={m3.colorScheme.primary} />
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: m3.colorScheme.primary,
                          marginLeft: 2,
                        }}
                      >
                        {day.precipitationProbability}%
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ETc & Irrigation Card */}
        {etc && (
          <View
            style={{
              backgroundColor: colors.surface[100],
              borderRadius: borderRadius['2xl'],
              padding: spacing[4],
              marginBottom: spacing[4],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: borderRadius.xl,
                  backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                  size={20}
                  color={m3.colorScheme.primary}
                />
              </View>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginLeft: spacing[3],
                }}
              >
                {t('weather.sections.waterRequirements')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                  {t('weather.labels.dailyEtc')}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    color: colors.surface[900],
                  }}
                >
                  {etc.dailyETc} mm
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.surface[50],
                  borderRadius: borderRadius.xl,
                  padding: spacing[3],
                  flex: 1,
                  minWidth: '45%',
                }}
              >
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                  {t('weather.labels.weeklyNeed')}
                </Text>
                <Text
                  style={{
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    color: colors.surface[900],
                  }}
                >
                  {etc.weeklyETc} mm
                </Text>
              </View>
              {irrigationSchedule && (
                <View
                  style={{
                    backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    flex: 1,
                    minWidth: '45%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.primary }}>
                    {t('weather.labels.total7Days')}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xl,
                      fontWeight: fontWeight.bold,
                      color: m3.colorScheme.primary,
                    }}
                  >
                    {irrigationSchedule.totalWaterNeed} mm
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: m3.colorScheme.primary }}>
                    {t('weather.labels.irrigations', {
                      count: irrigationSchedule.schedule.length,
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Weather Alerts */}
        {alerts && (
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.surface[500],
                letterSpacing: 1,
                marginBottom: spacing[3],
              }}
            >
              {t('weather.sections.alerts')}
            </Text>

            {/* Irrigation Alert */}
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[3],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[2],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.lg,
                      backgroundColor: colorWithOpacity(m3.colorScheme.primary, 0.12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                      size={16}
                      color={m3.colorScheme.primary}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    {t('tasks.types.irrigation')}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: urgencyColors[alerts.irrigation.urgency].bg,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Text
                    style={{
                      color: urgencyColors[alerts.irrigation.urgency].text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {t(`tasks.priority.${alerts.irrigation.urgency}`).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[700] }}>
                {alerts.irrigation.reason}
              </Text>
              {alerts.irrigation.recommendations.map((rec, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[2] }}
                >
                  <Icon name="checkmark.circle.fill" size={14} color={m3.colorScheme.primary} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.surface[600],
                      marginLeft: spacing[2],
                      flex: 1,
                    }}
                  >
                    {rec}
                  </Text>
                </View>
              ))}
            </View>

            {/* Pest Alert */}
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
                marginBottom: spacing[3],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[2],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.lg,
                      backgroundColor: colorWithOpacity(colors.warning, 0.18),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="ant.fill" size={16} color={colors.warning} />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    {t('weather.alerts.pest.title')}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: urgencyColors[alerts.pest.riskLevel].bg,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                  }}
                >
                  <Text
                    style={{
                      color: urgencyColors[alerts.pest.riskLevel].text,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {t('weather.alerts.pest.riskBadge', {
                      level: t(`tasks.priority.${alerts.pest.riskLevel}`),
                    })}
                  </Text>
                </View>
              </View>
              {alerts.pest.conditions.map((cond, i) => (
                <Text key={i} style={{ fontSize: fontSize.sm, color: colors.surface[700] }}>
                  {cond}
                </Text>
              ))}
              {alerts.pest.precautions.map((prec, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[2] }}
                >
                  <Icon name="checkmark.shield.fill" size={14} color={colors.warning} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.surface[600],
                      marginLeft: spacing[2],
                      flex: 1,
                    }}
                  >
                    {prec}
                  </Text>
                </View>
              ))}
            </View>

            {/* Harvest Alert */}
            <View
              style={{
                backgroundColor: colors.surface[100],
                borderRadius: borderRadius['2xl'],
                padding: spacing[4],
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: spacing[2],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: borderRadius.lg,
                      backgroundColor: colorWithOpacity(m3.colorScheme.tertiary, 0.18),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={resolveSymbolIconName(ICON_REGISTRY.harvest)}
                      size={16}
                      color={m3.colorScheme.tertiary}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    {t('weather.alerts.harvest.title')}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                    backgroundColor: alerts.harvest.isOptimal
                      ? colorWithOpacity(colors.success, 0.16)
                      : colorWithOpacity(colors.warning, 0.18),
                  }}
                >
                  <Text
                    style={{
                      color: alerts.harvest.isOptimal ? colors.success : colors.warning,
                    }}
                  >
                    {alerts.harvest.isOptimal
                      ? t('weather.alerts.harvest.badgeOptimal')
                      : t('weather.alerts.harvest.badgeModerate')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: fontSize.sm, color: colors.surface[700] }}>
                {alerts.harvest.conditions}
              </Text>
              {alerts.harvest.recommendations.map((rec, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[2] }}
                >
                  <Icon name="checkmark.circle.fill" size={14} color={m3.colorScheme.tertiary} />
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.surface[600],
                      marginLeft: spacing[2],
                      flex: 1,
                    }}
                  >
                    {rec}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Irrigation Schedule */}
        {irrigationSchedule && irrigationSchedule.schedule.length > 0 && (
          <View style={{ marginBottom: spacing[4] }}>
            <Text
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.surface[500],
                letterSpacing: 1,
                marginBottom: spacing[3],
              }}
            >
              {t('weather.sections.irrigationSchedule')}
            </Text>
            {irrigationSchedule.schedule.map((item, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: colors.surface[100],
                  borderRadius: borderRadius.xl,
                  padding: spacing[4],
                  marginBottom: spacing[2],
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.xl,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: urgencyColors[item.priority].bg,
                  }}
                >
                  <Icon
                    name={resolveSymbolIconName(ICON_REGISTRY.irrigation)}
                    size={20}
                    color={urgencyColors[item.priority].text}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                    }}
                  >
                    {getDayName(item.date, t)} - {item.amount} mm
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {item.duration.toFixed(1)} {t('common.units.hours')} • {item.reason}
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                    backgroundColor: urgencyColors[item.priority].bg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.medium,
                      color: urgencyColors[item.priority].text,
                    }}
                  >
                    {t(`tasks.priority.${item.priority}`).toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Last Updated */}
        {weather && (
          <View style={{ alignItems: 'center', marginTop: spacing[2] }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.surface[400] }}>
              {t('weather.lastUpdated', {
                time: new Date(weather.lastUpdated).toLocaleTimeString(),
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
