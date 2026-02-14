import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, shadows, borderRadius } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';

export interface WeatherWidgetProps extends BaseWidgetProps {
  /** Optional title override */
  title?: string;
  /** Current weather data */
  currentWeather?: typeof CURRENT_WEATHER;
  /** 3-day forecast data */
  forecast?: ForecastDay[];
}

interface ForecastDay {
  label: string;
  high: number;
  low: number;
  icon: keyof typeof Ionicons.glyphMap;
  condition: string;
}

const CURRENT_WEATHER = {
  temperature: 28,
  condition: 'Partly Cloudy',
  humidity: 65,
  wind: 12,
  icon: 'partly-sunny' as keyof typeof Ionicons.glyphMap,
} as const;

const FORECAST: ForecastDay[] = [
  { label: 'Today', high: 28, low: 19, icon: 'sunny', condition: 'Sunny' },
  { label: 'Tomorrow', high: 30, low: 21, icon: 'cloudy', condition: 'Cloudy' },
  { label: 'Day After', high: 26, low: 18, icon: 'rainy', condition: 'Rainy' },
];

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  title = 'Vineyard Weather',
  currentWeather = CURRENT_WEATHER,
  forecast = FORECAST,
  testID,
  accessibilityLabel,
  style,
}) => {
  const m3 = useM3();
  const { colorScheme, surface, typography } = m3;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? 'Vineyard weather overview'}
      style={[
        styles.card,
        {
          backgroundColor: surface.surfaceContainerLow,
          borderColor: colorScheme.outlineVariant,
          ...shadows.sm,
        },
        style,
      ]}
    >
      {/* Header */}
      <Text
        style={[typography.labelLarge, { color: colorScheme.onSurfaceVariant }]}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {/* Current conditions row */}
      <View style={styles.currentRow}>
        <View style={styles.tempSection}>
          <Ionicons
            name={currentWeather.icon}
            size={40}
            color={colorScheme.primary}
            accessibilityLabel={currentWeather.condition}
          />
          <Text
            style={[
              typography.headlineSmall,
              { color: colorScheme.onSurface, marginLeft: spacing[2] },
            ]}
            accessibilityLabel={`${currentWeather.temperature} degrees celsius`}
          >
            {currentWeather.temperature}°C
          </Text>
        </View>

        <View style={styles.detailsSection}>
          <Text
            style={[typography.bodyMedium, { color: colorScheme.onSurface }]}
            accessibilityLabel={`Condition: ${currentWeather.condition}`}
          >
            {currentWeather.condition}
          </Text>
          <View style={styles.detailRow}>
            <Ionicons name="water-outline" size={14} color={colorScheme.onSurfaceVariant} />
            <Text
              style={[
                typography.bodyMedium,
                { color: colorScheme.onSurfaceVariant, marginLeft: spacing[1] },
              ]}
              accessibilityLabel={`Humidity ${currentWeather.humidity} percent`}
            >
              {currentWeather.humidity}%
            </Text>
            <Ionicons
              name="flag-outline"
              size={14}
              color={colorScheme.onSurfaceVariant}
              style={{ marginLeft: spacing[3] }}
            />
            <Text
              style={[
                typography.bodyMedium,
                { color: colorScheme.onSurfaceVariant, marginLeft: spacing[1] },
              ]}
              accessibilityLabel={`Wind ${currentWeather.wind} kilometers per hour`}
            >
              {currentWeather.wind} km/h
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colorScheme.outlineVariant }]} />

      {/* 3-day forecast */}
      <View style={styles.forecastRow} accessibilityLabel="3 day forecast">
        {forecast.map((day) => (
          <View
            key={day.label}
            style={[
              styles.forecastDay,
              { backgroundColor: colorWithOpacity(colorScheme.primary, 0.06) },
            ]}
            accessibilityLabel={`${day.label}: ${day.condition}, high ${day.high} degrees, low ${day.low} degrees`}
          >
            <Text style={[typography.labelSmall, { color: colorScheme.onSurfaceVariant }]}>
              {day.label}
            </Text>
            <Ionicons
              name={day.icon}
              size={20}
              color={colorScheme.primary}
              style={{ marginVertical: spacing[1] }}
            />
            <Text style={[typography.labelSmall, { color: colorScheme.onSurface }]}>
              {day.high}°/{day.low}°
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: borderRadius['2xl'],
    padding: spacing[4],
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
  },
  tempSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsSection: {
    marginLeft: spacing[4],
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    marginVertical: spacing[3],
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  forecastDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: borderRadius.lg,
  },
});
