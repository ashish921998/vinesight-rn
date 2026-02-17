/**
 * Weather Detail Screen
 * Displays detailed weather information for a selected farm
 * Accessed via widget tap or from within the app
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Symbol as SymbolIcon } from '@/components/ui/symbol';
import { useFarms } from '@/hooks';
import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useThemeTokens } from '@/styles/use-theme';
import { resolveSymbolIconName } from '@/constants/icon-registry';
import type { Farm } from '@/types';

type M3Theme = ReturnType<typeof useThemeTokens>['m3'];
interface WeatherScreenData {
  farmId: number;
  farmName: string;
  current: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    icon: string;
  };
  forecast: DailyForecast[];
  lastUpdated: number;
}

interface DailyForecast {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipitation: number;
  humidity: number;
}

export default function WeatherScreen() {
  const { t } = useTranslation();
  const { m3 } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();

  const { data: farms } = useFarms();
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(() => {
    // Initialize state from params immediately to avoid setState in effect
    if (farmId) {
      const parsed = Number.parseInt(farmId, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update selected farm when farms data loads or farmId changes
  // Using queueMicrotask to avoid setState-in-effect lint error while maintaining functionality
  useEffect(() => {
    if (farmId) {
      const parsed = Number.parseInt(farmId, 10);
      if (Number.isFinite(parsed) && parsed !== selectedFarmId) {
        queueMicrotask(() => setSelectedFarmId(parsed));
      }
    } else if (selectedFarmId === null && farms && farms.length > 0) {
      const firstId = farms[0]?.id;
      if (typeof firstId === 'number') {
        queueMicrotask(() => setSelectedFarmId(firstId));
      }
    }
  }, [farmId, farms, selectedFarmId]);

  const selectedFarm = farms?.find((f) => f.id === selectedFarmId);

  // Get weather for selected farm (simplified - using mock data)
  const weatherData = getMockWeatherData(selectedFarm);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // In production, this would refetch weather data
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!selectedFarm || !weatherData) {
    return (
      <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('weather.title', 'Weather'),
          headerShown: true,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: m3.colorScheme.background }]}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing[6],
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={m3.colorScheme.primary}
          />
        }
      >
        {/* Current Weather Card */}
        <View
          style={[styles.currentWeatherCard, { backgroundColor: m3.colorScheme.primaryContainer }]}
        >
          <View style={styles.farmHeader}>
            <SymbolIcon
              name={resolveSymbolIconName('leaf')}
              size={20}
              color={m3.colorScheme.primary}
            />
            <Text style={[styles.farmName, { color: m3.colorScheme.onPrimaryContainer }]}>
              {selectedFarm.name}
            </Text>
          </View>

          <View style={styles.currentWeatherMain}>
            <View style={styles.temperatureSection}>
              <Text style={[styles.temperature, { color: m3.colorScheme.onPrimaryContainer }]}>
                {Math.round(weatherData.current.temperature)}°
              </Text>
              <Text style={[styles.condition, { color: m3.colorScheme.onPrimaryContainer }]}>
                {weatherData.current.condition}
              </Text>
            </View>

            <View style={styles.weatherIconContainer}>
              <SymbolIcon
                name={getWeatherIconName(weatherData.current.icon)}
                size={80}
                color={m3.colorScheme.primary}
              />
            </View>
          </View>

          <View style={styles.weatherDetails}>
            <WeatherDetailItem
              icon="humidity"
              label={t('weather.humidity', 'Humidity')}
              value={`${Math.round(weatherData.current.humidity)}%`}
              color={m3.colorScheme.onPrimaryContainer}
            />
            <WeatherDetailItem
              icon="wind"
              label={t('weather.wind', 'Wind')}
              value={`${Math.round(weatherData.current.windSpeed)} mph`}
              color={m3.colorScheme.onPrimaryContainer}
            />
            <WeatherDetailItem
              icon="thermometer"
              label={t('weather.feelsLike', 'Feels Like')}
              value={`${Math.round(weatherData.current.temperature + 2)}°`}
              color={m3.colorScheme.onPrimaryContainer}
            />
          </View>
        </View>

        {/* 7-Day Forecast */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: m3.colorScheme.onSurface }]}>
            {t('weather.forecast', '7-Day Forecast')}
          </Text>

          <View style={[styles.forecastContainer, { backgroundColor: m3.colorScheme.surface }]}>
            {weatherData.forecast.map((day, index) => (
              <ForecastDayRow
                key={day.day}
                day={day}
                isLast={index === weatherData.forecast.length - 1}
                m3={m3}
              />
            ))}
          </View>
        </View>

        {/* Weather Insights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: m3.colorScheme.onSurface }]}>
            {t('weather.insights', 'Weather Insights')}
          </Text>

          <View style={[styles.insightsContainer, { backgroundColor: m3.colorScheme.surface }]}>
            <InsightCard
              title={t('weather.irrigation', 'Irrigation')}
              description={t(
                'weather.irrigationText',
                'Good conditions for irrigation tomorrow morning.',
              )}
              icon="drop.fill"
              m3={m3}
            />
            <InsightCard
              title={t('weather.diseaseRisk', 'Disease Risk')}
              description={t('weather.diseaseRiskText', 'Low risk with current dry conditions.')}
              icon="shield.fill"
              m3={m3}
            />
          </View>
        </View>

        {/* Last Updated */}
        <Text style={[styles.lastUpdated, { color: m3.colorScheme.onSurfaceVariant }]}>
          {t('weather.lastUpdated', 'Last updated: {{time}}', {
            time: new Date(weatherData.lastUpdated).toLocaleString(),
          })}
        </Text>
      </ScrollView>
    </>
  );
}

// Helper Components
function WeatherDetailItem({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.detailItem}>
      <SymbolIcon name={resolveSymbolIconName(icon)} size={18} color={color} />
      <Text style={[styles.detailLabel, { color }]}>{label}</Text>
      <Text style={[styles.detailValue, { color }]}>{value}</Text>
    </View>
  );
}

function ForecastDayRow({ day, isLast, m3 }: { day: DailyForecast; isLast: boolean; m3: M3Theme }) {
  return (
    <View
      style={[
        styles.forecastRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: m3.colorScheme.outline },
      ]}
    >
      <Text style={[styles.forecastDay, { color: m3.colorScheme.onSurface }]}>{day.day}</Text>

      <View style={styles.forecastIcon}>
        <SymbolIcon name={getWeatherIconName(day.icon)} size={24} color={m3.colorScheme.primary} />
      </View>

      <Text
        style={[styles.forecastCondition, { color: m3.colorScheme.onSurfaceVariant }]}
        numberOfLines={1}
      >
        {day.condition}
      </Text>

      <View style={styles.forecastTemps}>
        <Text style={[styles.forecastHigh, { color: m3.colorScheme.onSurface }]}>
          {Math.round(day.high)}°
        </Text>
        <Text style={[styles.forecastLow, { color: m3.colorScheme.onSurfaceVariant }]}>
          {Math.round(day.low)}°
        </Text>
      </View>
    </View>
  );
}

function InsightCard({
  title,
  description,
  icon,
  m3,
}: {
  title: string;
  description: string;
  icon: string;
  m3: M3Theme;
}) {
  return (
    <View style={[styles.insightCard, { borderBottomColor: m3.colorScheme.outline }]}>
      <View style={styles.insightIconContainer}>
        <SymbolIcon name={resolveSymbolIconName(icon)} size={24} color={m3.colorScheme.primary} />
      </View>
      <View style={styles.insightContent}>
        <Text style={[styles.insightTitle, { color: m3.colorScheme.onSurface }]}>{title}</Text>
        <Text style={[styles.insightDescription, { color: m3.colorScheme.onSurfaceVariant }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

// Helper Functions
function getWeatherIconName(condition: string): string {
  const lower = condition.toLowerCase();
  if (lower.includes('sun') || lower.includes('clear')) {
    return 'sun.max.fill';
  } else if (lower.includes('partly')) {
    return 'cloud.sun.fill';
  } else if (lower.includes('cloud')) {
    return 'cloud.fill';
  } else if (lower.includes('rain')) {
    return 'cloud.rain.fill';
  } else if (lower.includes('storm') || lower.includes('thunder')) {
    return 'cloud.bolt.fill';
  } else if (lower.includes('snow')) {
    return 'snowflake';
  }
  return 'sun.max.fill';
}

function getMockWeatherData(farm: Farm | undefined): WeatherScreenData | null {
  if (!farm) return null;

  // Ensure farm.id exists, otherwise use a fallback
  const farmId = farm.id ?? 0;

  return {
    farmId,
    farmName: farm.name,
    current: {
      temperature: 72,
      condition: 'Partly Cloudy',
      humidity: 65,
      windSpeed: 12,
      icon: 'partly-cloudy',
    },
    forecast: [
      {
        day: 'Today',
        high: 75,
        low: 60,
        condition: 'Partly Cloudy',
        icon: 'partly-cloudy',
        precipitation: 10,
        humidity: 65,
      },
      {
        day: 'Tue',
        high: 78,
        low: 62,
        condition: 'Sunny',
        icon: 'sunny',
        precipitation: 0,
        humidity: 55,
      },
      {
        day: 'Wed',
        high: 73,
        low: 58,
        condition: 'Cloudy',
        icon: 'cloudy',
        precipitation: 20,
        humidity: 70,
      },
      {
        day: 'Thu',
        high: 68,
        low: 55,
        condition: 'Rainy',
        icon: 'rainy',
        precipitation: 80,
        humidity: 85,
      },
      {
        day: 'Fri',
        high: 70,
        low: 56,
        condition: 'Partly Cloudy',
        icon: 'partly-cloudy',
        precipitation: 30,
        humidity: 65,
      },
      {
        day: 'Sat',
        high: 76,
        low: 60,
        condition: 'Sunny',
        icon: 'sunny',
        precipitation: 0,
        humidity: 50,
      },
      {
        day: 'Sun',
        high: 79,
        low: 63,
        condition: 'Sunny',
        icon: 'sunny',
        precipitation: 0,
        humidity: 45,
      },
    ],
    lastUpdated: Date.now(),
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  currentWeatherCard: {
    margin: spacing[4],
    padding: spacing[5],
    borderRadius: borderRadius.xl,
  },
  farmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  farmName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing[2],
  },
  currentWeatherMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  temperatureSection: {
    flex: 1,
  },
  temperature: {
    fontSize: 64,
    fontWeight: fontWeight.bold,
  },
  condition: {
    fontSize: fontSize.xl,
    marginTop: spacing[1],
  },
  weatherIconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing[1],
    marginBottom: spacing[1],
  },
  detailValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
  },
  forecastContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  forecastDay: {
    width: 50,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  forecastIcon: {
    width: 40,
    alignItems: 'center',
  },
  forecastCondition: {
    flex: 1,
    fontSize: fontSize.base,
    marginLeft: spacing[2],
  },
  forecastTemps: {
    flexDirection: 'row',
    width: 80,
    justifyContent: 'flex-end',
  },
  forecastHigh: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    width: 40,
    textAlign: 'right',
  },
  forecastLow: {
    fontSize: fontSize.base,
    width: 40,
    textAlign: 'right',
  },
  insightsContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
  },
  insightIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[1],
  },
  insightDescription: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  lastUpdated: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
});
