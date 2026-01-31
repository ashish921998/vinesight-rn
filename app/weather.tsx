import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Symbol as Icon } from '@/components/ui/symbol';
import { useFarms } from '../src/hooks';
import { useWeatherData } from '../src/hooks/use-weather';
import { GrapeGrowthStage, SoilType } from '../src/types/weather';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';

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

// Urgency badge colors
const urgencyColors = {
  low: { bg: '#DCFCE7', text: '#166534' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  high: { bg: '#FEE2E2', text: '#991B1B' },
};

// Day name helper
function getDayName(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function WeatherScreen() {
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [growthStage, setGrowthStage] = useState<GrapeGrowthStage>('Fruit set');
  const [soilType, setSoilType] = useState<SoilType>('medium');
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showGrowthPicker, setShowGrowthPicker] = useState(false);
  const [showSoilPicker, setShowSoilPicker] = useState(false);

  // Get selected farm coordinates
  const selectedFarm = useMemo(() => {
    if (!farms || farms.length === 0) return null;
    if (selectedFarmId) return farms.find((f) => f.id === selectedFarmId) || farms[0];
    return farms[0];
  }, [farms, selectedFarmId]);

  // Fetch weather data
  const { weather, etc, alerts, irrigationSchedule, isLoading, error, refetch, isRefetching } =
    useWeatherData(
      selectedFarm?.latitude ?? undefined,
      selectedFarm?.longitude ?? undefined,
      growthStage,
      soilType,
    );

  // Set initial farm when farms load
  React.useEffect(() => {
    if (farms && farms.length > 0 && !selectedFarmId && farms[0].id !== undefined) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

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
        <ActivityIndicator size="large" color="#408059" />
        <Text style={{ color: colors.surface[600], marginTop: spacing[4] }}>
          Loading weather data...
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
        <Icon name="cloud.slash.fill" size={48} color="#9CA3AF" />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          Unable to load weather data
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
          <Text style={{ color: colors.white, fontWeight: fontWeight.semibold }}>Try Again</Text>
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
        <Icon name="leaf.fill" size={48} color="#9CA3AF" />
        <Text
          style={{
            color: colors.surface[600],
            marginTop: spacing[4],
            textAlign: 'center',
          }}
        >
          No farms available
        </Text>
        <Text
          style={{
            color: colors.surface[500],
            fontSize: fontSize.sm,
            marginTop: spacing[2],
            textAlign: 'center',
          }}
        >
          Add a farm to see weather data for your location
        </Text>
      </View>
    );
  }

  const hasCoordinates =
    Number.isFinite(selectedFarm?.latitude) && Number.isFinite(selectedFarm?.longitude);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface[50] }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
        style={{ backgroundColor: colors.surface[50] }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#408059" />
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
            FARM
          </Text>
          <Pressable
            onPress={() => setShowFarmPicker(!showFarmPicker)}
            style={{
              backgroundColor: colors.white,
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
                  backgroundColor: colors.primary[100],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="leaf.fill" size={20} color="#408059" />
              </View>
              <View style={{ marginLeft: spacing[3] }}>
                <Text
                  style={{
                    fontSize: fontSize.base,
                    fontWeight: fontWeight.semibold,
                    color: colors.surface[900],
                  }}
                >
                  {selectedFarm?.name || 'Select Farm'}
                </Text>
                {hasCoordinates && (
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {selectedFarm?.latitude?.toFixed(4)}, {selectedFarm?.longitude?.toFixed(4)}
                  </Text>
                )}
              </View>
            </View>
            <Icon name={showFarmPicker ? 'chevron.up' : 'chevron.down'} size={20} color="#9CA3AF" />
          </Pressable>
          {showFarmPicker && (
            <View
              style={{
                backgroundColor: colors.white,
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
                    borderBottomColor: colors.surface[100],
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: selectedFarmId === farm.id ? colors.primary[50] : colors.white,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: selectedFarmId === farm.id ? colors.primary[700] : colors.surface[700],
                      fontWeight:
                        selectedFarmId === farm.id ? fontWeight.semibold : fontWeight.normal,
                    }}
                  >
                    {farm.name}
                  </Text>
                  {selectedFarmId === farm.id && (
                    <Icon name="checkmark" size={20} color="#408059" />
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
              backgroundColor: '#FFFBEB',
              borderRadius: borderRadius.xl,
              padding: spacing[4],
              marginBottom: spacing[4],
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Icon name="exclamationmark.triangle.fill" size={20} color="#F59E0B" />
            <Text
              style={{
                color: '#92400E',
                fontSize: fontSize.sm,
                marginLeft: spacing[3],
                flex: 1,
              }}
            >
              This farm doesn&apos;t have location coordinates. Weather data is showing default
              location (Nashik). Add GPS coordinates to get farm-specific weather.
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
              GROWTH STAGE
            </Text>
            <Pressable
              onPress={() => setShowGrowthPicker(!showGrowthPicker)}
              style={{
                backgroundColor: colors.white,
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
              <Icon name="chevron.down" size={16} color="#9CA3AF" />
            </Pressable>
            {showGrowthPicker && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  position: 'absolute',
                  top: 64,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
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
                        borderBottomColor: colors.surface[100],
                        backgroundColor: growthStage === stage ? colors.primary[50] : colors.white,
                      }}
                    >
                      <Text
                        style={{
                          color: growthStage === stage ? colors.primary[700] : colors.surface[700],
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
              SOIL TYPE
            </Text>
            <Pressable
              onPress={() => setShowSoilPicker(!showSoilPicker)}
              style={{
                backgroundColor: colors.white,
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
              <Icon name="chevron.down" size={16} color="#9CA3AF" />
            </Pressable>
            {showSoilPicker && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.xl,
                  marginTop: spacing[2],
                  position: 'absolute',
                  top: 64,
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
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
                      borderBottomColor: colors.surface[100],
                      backgroundColor: soilType === type.value ? colors.primary[50] : colors.white,
                    }}
                  >
                    <Text
                      style={{
                        color: soilType === type.value ? colors.primary[700] : colors.surface[700],
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
              backgroundColor: colors.primary[600],
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
                <Text style={{ color: colors.primary[100], fontSize: fontSize.sm }}>
                  {weather.location.name || 'Current Location'}
                </Text>
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 48,
                    fontWeight: fontWeight.bold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.temperature}°
                </Text>
                <Text
                  style={{
                    color: colors.primary[100],
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
                  color="rgba(255,255,255,0.9)"
                />
                <Text
                  style={{
                    color: colors.primary[100],
                    fontSize: fontSize.xs,
                    marginTop: spacing[2],
                  }}
                >
                  Feels like {weather.current.feelsLike}°
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginTop: spacing[4],
                paddingTop: spacing[4],
                borderTopWidth: 1,
                borderTopColor: colors.primary[500],
              }}
            >
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon name="drop.fill" size={18} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: colors.white,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.humidity}%
                </Text>
                <Text style={{ color: colors.primary[200], fontSize: fontSize.xs }}>Humidity</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon name="gauge" size={18} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: colors.white,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.windSpeed} km/h
                </Text>
                <Text style={{ color: colors.primary[200], fontSize: fontSize.xs }}>Wind</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon name="sun.max.fill" size={18} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: colors.white,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.uvIndex}
                </Text>
                <Text style={{ color: colors.primary[200], fontSize: fontSize.xs }}>UV Index</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Icon name="cloud.rain.fill" size={18} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    color: colors.white,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    marginTop: spacing[1],
                  }}
                >
                  {weather.current.precipitation} mm
                </Text>
                <Text style={{ color: colors.primary[200], fontSize: fontSize.xs }}>Rain</Text>
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
              7-DAY FORECAST
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
                    backgroundColor: colors.white,
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    alignItems: 'center',
                    borderWidth: index === 0 ? 2 : 0,
                    borderColor: index === 0 ? colors.primary[500] : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.semibold,
                      color: index === 0 ? colors.primary[600] : colors.surface[600],
                    }}
                  >
                    {getDayName(day.date)}
                  </Text>
                  <Icon
                    name={getWeatherIconName(day.conditionCode)}
                    size={28}
                    color={index === 0 ? '#408059' : '#6B7280'}
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
                      <Icon name="drop.fill" size={10} color="#3B82F6" />
                      <Text style={{ fontSize: fontSize.xs, color: '#2563EB', marginLeft: 2 }}>
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
              backgroundColor: colors.white,
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
                  backgroundColor: '#DBEAFE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="drop.fill" size={20} color="#3B82F6" />
              </View>
              <Text
                style={{
                  fontSize: fontSize.base,
                  fontWeight: fontWeight.semibold,
                  color: colors.surface[900],
                  marginLeft: spacing[3],
                }}
              >
                Water Requirements
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
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>Daily ETc</Text>
                <Text
                  style={{
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    color: colors.surface[900],
                  }}
                >
                  {etc.dailyETc} mm
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                  Kc: {etc.cropCoefficient}
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
                  Weekly Need
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
                <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                  ET₀: {etc.referenceET} mm
                </Text>
              </View>
              {irrigationSchedule && (
                <View
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: borderRadius.xl,
                    padding: spacing[3],
                    flex: 1,
                    minWidth: '45%',
                  }}
                >
                  <Text style={{ fontSize: fontSize.xs, color: '#2563EB' }}>Total (7 days)</Text>
                  <Text
                    style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: '#1D4ED8' }}
                  >
                    {irrigationSchedule.totalWaterNeed} mm
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: '#2563EB' }}>
                    {irrigationSchedule.schedule.length} irrigations
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
              ALERTS &amp; RECOMMENDATIONS
            </Text>

            {/* Irrigation Alert */}
            <View
              style={{
                backgroundColor: colors.white,
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
                      backgroundColor: '#DBEAFE',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="drop.fill" size={16} color="#3B82F6" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    Irrigation
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
                    {alerts.irrigation.urgency.toUpperCase()}
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
                  <Icon name="checkmark.circle.fill" size={14} color="#408059" />
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
                backgroundColor: colors.white,
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
                      backgroundColor: '#FEF3C7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="ant.fill" size={16} color="#F59E0B" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    Pest & Disease
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
                    {alerts.pest.riskLevel.toUpperCase()} RISK
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
                  <Icon name="checkmark.shield.fill" size={14} color="#F59E0B" />
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
                backgroundColor: colors.white,
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
                      backgroundColor: '#EDE9FE',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="basket.fill" size={16} color="#8B5CF6" />
                  </View>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.semibold,
                      color: colors.surface[900],
                      marginLeft: spacing[2],
                    }}
                  >
                    Harvest Conditions
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[1],
                    borderRadius: borderRadius.full,
                    backgroundColor: alerts.harvest.isOptimal ? '#DCFCE7' : '#FEF3C7',
                  }}
                >
                  <Text style={{ color: alerts.harvest.isOptimal ? '#166534' : '#92400E' }}>
                    {alerts.harvest.isOptimal ? 'OPTIMAL' : 'MODERATE'}
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
                  <Icon name="checkmark.circle.fill" size={14} color="#8B5CF6" />
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
              IRRIGATION SCHEDULE
            </Text>
            {irrigationSchedule.schedule.map((item, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: colors.white,
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
                    backgroundColor:
                      item.priority === 'high'
                        ? '#FEE2E2'
                        : item.priority === 'medium'
                          ? '#FEF3C7'
                          : '#DCFCE7',
                  }}
                >
                  <Icon
                    name="drop.fill"
                    size={20}
                    color={
                      item.priority === 'high'
                        ? '#DC2626'
                        : item.priority === 'medium'
                          ? '#D97706'
                          : '#16A34A'
                    }
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
                    {getDayName(item.date)} - {item.amount} mm
                  </Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.surface[500] }}>
                    {item.duration.toFixed(1)} hours • {item.reason}
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
                    {item.priority.toUpperCase()}
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
              Last updated: {new Date(weather.lastUpdated).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
