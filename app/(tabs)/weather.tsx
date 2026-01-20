import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFarms } from '../../src/hooks';
import { useWeatherData } from '../../src/hooks/useWeather';
import { WeatherService } from '../../src/services/weatherService';
import { GrapeGrowthStage, SoilType, ForecastDay } from '../../src/types/weather';
import { Farm } from '../../src/types';

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
function getWeatherIconName(conditionCode: number): keyof typeof Ionicons.glyphMap {
  switch (conditionCode) {
    case 1000: return 'sunny';
    case 1003: return 'partly-sunny';
    case 1006: return 'cloudy';
    case 1153: return 'rainy';
    case 1186: return 'rainy';
    default: return 'cloudy';
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
  const {
    weather,
    etc,
    alerts,
    irrigationSchedule,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useWeatherData(
    selectedFarm?.latitude ?? undefined,
    selectedFarm?.longitude ?? undefined,
    growthStage,
    soilType
  );

  // Set initial farm when farms load
  React.useEffect(() => {
    if (farms && farms.length > 0 && !selectedFarmId && farms[0].id !== undefined) {
      setSelectedFarmId(farms[0].id);
    }
  }, [farms, selectedFarmId]);

  if (farmsLoading || isLoading) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center">
        <ActivityIndicator size="large" color="#408059" />
        <Text className="text-surface-600 mt-4">Loading weather data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center p-6">
        <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
        <Text className="text-surface-600 mt-4 text-center">
          Unable to load weather data
        </Text>
        <Text className="text-surface-500 text-sm mt-2 text-center">
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 bg-primary-600 px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <View className="flex-1 bg-surface-50 items-center justify-center p-6">
        <Ionicons name="leaf" size={48} color="#9CA3AF" />
        <Text className="text-surface-600 mt-4 text-center">No farms available</Text>
        <Text className="text-surface-500 text-sm mt-2 text-center">
          Add a farm to see weather data for your location
        </Text>
      </View>
    );
  }

  const hasCoordinates = selectedFarm?.latitude && selectedFarm?.longitude;

  return (
    <ScrollView
      className="flex-1 bg-surface-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#408059"
        />
      }
    >
      {/* Farm Selector */}
      <View className="mb-4">
        <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2">
          FARM
        </Text>
        <TouchableOpacity
          onPress={() => setShowFarmPicker(!showFarmPicker)}
          className="bg-white rounded-xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl bg-primary-100 items-center justify-center">
              <Ionicons name="leaf" size={20} color="#408059" />
            </View>
            <View className="ml-3">
              <Text className="text-base font-semibold text-surface-900">
                {selectedFarm?.name || 'Select Farm'}
              </Text>
              {hasCoordinates && (
                <Text className="text-xs text-surface-500">
                  {selectedFarm?.latitude?.toFixed(4)}, {selectedFarm?.longitude?.toFixed(4)}
                </Text>
              )}
            </View>
          </View>
          <Ionicons
            name={showFarmPicker ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#9CA3AF"
          />
        </TouchableOpacity>
        {showFarmPicker && (
          <View className="bg-white rounded-xl mt-2 overflow-hidden">
            {farms.map((farm) => (
              <TouchableOpacity
                key={farm.id}
                onPress={() => {
                  if (farm.id !== undefined) setSelectedFarmId(farm.id);
                  setShowFarmPicker(false);
                }}
                className={`p-4 border-b border-surface-100 flex-row items-center ${
                  selectedFarmId === farm.id ? 'bg-primary-50' : ''
                }`}
              >
                <Text
                  className={`flex-1 ${
                    selectedFarmId === farm.id
                      ? 'text-primary-700 font-semibold'
                      : 'text-surface-700'
                  }`}
                >
                  {farm.name}
                </Text>
                {selectedFarmId === farm.id && (
                  <Ionicons name="checkmark" size={20} color="#408059" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* No coordinates warning */}
      {!hasCoordinates && (
        <View className="bg-amber-50 rounded-xl p-4 mb-4 flex-row items-start">
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <Text className="text-amber-800 text-sm ml-3 flex-1">
            This farm doesn't have location coordinates. Weather data is showing default
            location (Nashik). Add GPS coordinates to get farm-specific weather.
          </Text>
        </View>
      )}

      {/* Settings Row */}
      <View className="flex-row mb-4" style={{ gap: 12 }}>
        {/* Growth Stage Picker */}
        <View className="flex-1">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2">
            GROWTH STAGE
          </Text>
          <TouchableOpacity
            onPress={() => setShowGrowthPicker(!showGrowthPicker)}
            className="bg-white rounded-xl p-3 flex-row items-center justify-between"
          >
            <Text className="text-sm text-surface-900" numberOfLines={1}>
              {growthStage}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
          {showGrowthPicker && (
            <View className="bg-white rounded-xl mt-2 absolute top-16 left-0 right-0 z-10 border border-gray-200">
              <ScrollView style={{ maxHeight: 200 }}>
                {GROWTH_STAGES.map((stage) => (
                  <TouchableOpacity
                    key={stage}
                    onPress={() => {
                      setGrowthStage(stage);
                      setShowGrowthPicker(false);
                    }}
                    className={`p-3 border-b border-surface-100 ${
                      growthStage === stage ? 'bg-primary-50' : ''
                    }`}
                  >
                    <Text
                      className={
                        growthStage === stage
                          ? 'text-primary-700 font-medium'
                          : 'text-surface-700'
                      }
                    >
                      {stage}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Soil Type Picker */}
        <View className="flex-1">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-2">
            SOIL TYPE
          </Text>
          <TouchableOpacity
            onPress={() => setShowSoilPicker(!showSoilPicker)}
            className="bg-white rounded-xl p-3 flex-row items-center justify-between"
          >
            <Text className="text-sm text-surface-900" numberOfLines={1}>
              {SOIL_TYPES.find((s) => s.value === soilType)?.label}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
          {showSoilPicker && (
            <View className="bg-white rounded-xl mt-2 absolute top-16 left-0 right-0 z-10 border border-gray-200">
              {SOIL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => {
                    setSoilType(type.value);
                    setShowSoilPicker(false);
                  }}
                  className={`p-3 border-b border-surface-100 ${
                    soilType === type.value ? 'bg-primary-50' : ''
                  }`}
                >
                  <Text
                    className={
                      soilType === type.value
                        ? 'text-primary-700 font-medium'
                        : 'text-surface-700'
                    }
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Current Weather Card */}
      {weather && (
        <View className="bg-primary-600 rounded-2xl p-5 mb-4">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-primary-100 text-sm">
                {weather.location.name || 'Current Location'}
              </Text>
              <Text className="text-white text-5xl font-bold mt-1">
                {weather.current.temperature}°
              </Text>
              <Text className="text-primary-100 text-base mt-1">
                {weather.current.condition}
              </Text>
            </View>
            <View className="items-end">
              <Ionicons
                name={getWeatherIconName(weather.current.conditionCode)}
                size={56}
                color="rgba(255,255,255,0.9)"
              />
              <Text className="text-primary-100 text-xs mt-2">
                Feels like {weather.current.feelsLike}°
              </Text>
            </View>
          </View>
          <View className="flex-row mt-4 pt-4 border-t border-primary-500">
            <View className="flex-1 items-center">
              <Ionicons name="water" size={18} color="rgba(255,255,255,0.8)" />
              <Text className="text-white text-sm font-semibold mt-1">
                {weather.current.humidity}%
              </Text>
              <Text className="text-primary-200 text-xs">Humidity</Text>
            </View>
            <View className="flex-1 items-center">
              <Ionicons name="speedometer" size={18} color="rgba(255,255,255,0.8)" />
              <Text className="text-white text-sm font-semibold mt-1">
                {weather.current.windSpeed} km/h
              </Text>
              <Text className="text-primary-200 text-xs">Wind</Text>
            </View>
            <View className="flex-1 items-center">
              <Ionicons name="sunny" size={18} color="rgba(255,255,255,0.8)" />
              <Text className="text-white text-sm font-semibold mt-1">
                {weather.current.uvIndex}
              </Text>
              <Text className="text-primary-200 text-xs">UV Index</Text>
            </View>
            <View className="flex-1 items-center">
              <Ionicons name="rainy" size={18} color="rgba(255,255,255,0.8)" />
              <Text className="text-white text-sm font-semibold mt-1">
                {weather.current.precipitation} mm
              </Text>
              <Text className="text-primary-200 text-xs">Rain</Text>
            </View>
          </View>
        </View>
      )}

      {/* 7-Day Forecast */}
      {weather && (
        <View className="mb-4">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">
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
                className={`bg-white rounded-xl p-3 items-center ${
                  index === 0 ? 'border-2 border-primary-500' : ''
                }`}
                style={{ width: 80 }}
              >
                <Text
                  className={`text-xs font-semibold ${
                    index === 0 ? 'text-primary-600' : 'text-surface-600'
                  }`}
                >
                  {getDayName(day.date)}
                </Text>
                <Ionicons
                  name={getWeatherIconName(day.conditionCode)}
                  size={28}
                  color={index === 0 ? '#408059' : '#6B7280'}
                  style={{ marginVertical: 8 }}
                />
                <Text className="text-sm font-bold text-surface-900">
                  {day.maxTemp}°
                </Text>
                <Text className="text-xs text-surface-500">{day.minTemp}°</Text>
                {day.precipitationProbability > 0 && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="water" size={10} color="#3B82F6" />
                    <Text className="text-xs text-blue-600 ml-0.5">
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
        <View className="bg-white rounded-2xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center">
              <Ionicons name="water" size={20} color="#3B82F6" />
            </View>
            <Text className="text-base font-semibold text-surface-900 ml-3">
              Water Requirements
            </Text>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            <View className="bg-surface-50 rounded-xl p-3 flex-1" style={{ minWidth: '45%' }}>
              <Text className="text-xs text-surface-500">Daily ETc</Text>
              <Text className="text-xl font-bold text-surface-900">{etc.dailyETc} mm</Text>
              <Text className="text-xs text-surface-500">Kc: {etc.cropCoefficient}</Text>
            </View>
            <View className="bg-surface-50 rounded-xl p-3 flex-1" style={{ minWidth: '45%' }}>
              <Text className="text-xs text-surface-500">Weekly Need</Text>
              <Text className="text-xl font-bold text-surface-900">{etc.weeklyETc} mm</Text>
              <Text className="text-xs text-surface-500">ET₀: {etc.referenceET} mm</Text>
            </View>
            {irrigationSchedule && (
              <View className="bg-blue-50 rounded-xl p-3 flex-1" style={{ minWidth: '45%' }}>
                <Text className="text-xs text-blue-600">Total (7 days)</Text>
                <Text className="text-xl font-bold text-blue-700">
                  {irrigationSchedule.totalWaterNeed} mm
                </Text>
                <Text className="text-xs text-blue-600">
                  {irrigationSchedule.schedule.length} irrigations
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Weather Alerts */}
      {alerts && (
        <View className="mb-4">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">
            ALERTS & RECOMMENDATIONS
          </Text>

          {/* Irrigation Alert */}
          <View className="bg-white rounded-2xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center">
                  <Ionicons name="water" size={16} color="#3B82F6" />
                </View>
                <Text className="text-sm font-semibold text-surface-900 ml-2">
                  Irrigation
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: urgencyColors[alerts.irrigation.urgency].bg }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: urgencyColors[alerts.irrigation.urgency].text }}
                >
                  {alerts.irrigation.urgency.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-surface-700">{alerts.irrigation.reason}</Text>
            {alerts.irrigation.recommendations.map((rec, i) => (
              <View key={i} className="flex-row items-start mt-2">
                <Ionicons name="checkmark-circle" size={14} color="#408059" />
                <Text className="text-xs text-surface-600 ml-2 flex-1">{rec}</Text>
              </View>
            ))}
          </View>

          {/* Pest Alert */}
          <View className="bg-white rounded-2xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-lg bg-orange-100 items-center justify-center">
                  <Ionicons name="bug" size={16} color="#F59E0B" />
                </View>
                <Text className="text-sm font-semibold text-surface-900 ml-2">
                  Pest & Disease
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: urgencyColors[alerts.pest.riskLevel].bg }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: urgencyColors[alerts.pest.riskLevel].text }}
                >
                  {alerts.pest.riskLevel.toUpperCase()} RISK
                </Text>
              </View>
            </View>
            {alerts.pest.conditions.map((cond, i) => (
              <Text key={i} className="text-sm text-surface-700">
                {cond}
              </Text>
            ))}
            {alerts.pest.precautions.map((prec, i) => (
              <View key={i} className="flex-row items-start mt-2">
                <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
                <Text className="text-xs text-surface-600 ml-2 flex-1">{prec}</Text>
              </View>
            ))}
          </View>

          {/* Harvest Alert */}
          <View className="bg-white rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
                  <Ionicons name="basket" size={16} color="#8B5CF6" />
                </View>
                <Text className="text-sm font-semibold text-surface-900 ml-2">
                  Harvest Conditions
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded-full"
                style={{
                  backgroundColor: alerts.harvest.isOptimal ? '#DCFCE7' : '#FEF3C7',
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: alerts.harvest.isOptimal ? '#166534' : '#92400E' }}
                >
                  {alerts.harvest.isOptimal ? 'OPTIMAL' : 'MODERATE'}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-surface-700">{alerts.harvest.conditions}</Text>
            {alerts.harvest.recommendations.map((rec, i) => (
              <View key={i} className="flex-row items-start mt-2">
                <Ionicons name="checkmark-circle" size={14} color="#8B5CF6" />
                <Text className="text-xs text-surface-600 ml-2 flex-1">{rec}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Irrigation Schedule */}
      {irrigationSchedule && irrigationSchedule.schedule.length > 0 && (
        <View className="mb-4">
          <Text className="text-xs font-bold text-surface-500 tracking-wider mb-3">
            IRRIGATION SCHEDULE
          </Text>
          {irrigationSchedule.schedule.map((item, i) => (
            <View key={i} className="bg-white rounded-xl p-4 mb-2 flex-row items-center">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{
                  backgroundColor:
                    item.priority === 'high'
                      ? '#FEE2E2'
                      : item.priority === 'medium'
                      ? '#FEF3C7'
                      : '#DCFCE7',
                }}
              >
                <Ionicons
                  name="water"
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
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-surface-900">
                  {getDayName(item.date)} - {item.amount} mm
                </Text>
                <Text className="text-xs text-surface-500">
                  {item.duration.toFixed(1)} hours • {item.reason}
                </Text>
              </View>
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: urgencyColors[item.priority].bg }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: urgencyColors[item.priority].text }}
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
        <View className="items-center mt-2">
          <Text className="text-xs text-surface-400">
            Last updated: {new Date(weather.lastUpdated).toLocaleTimeString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
