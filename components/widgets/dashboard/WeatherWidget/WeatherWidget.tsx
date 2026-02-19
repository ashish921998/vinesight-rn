import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseWidgetProps, LoadingState } from '@widgets/shared/types';
import { useM3 } from '@/styles/use-theme';
import { spacing, shadows, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { colorWithOpacity } from '@/utils/color';
import { useTranslation } from 'react-i18next';

interface CurrentWeatherData {
  temperature: number;
  conditionKey: string;
  humidity: number;
  wind: number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ForecastDay {
  labelKey: string;
  high: number;
  low: number;
  icon: keyof typeof Ionicons.glyphMap;
  conditionKey: string;
}

export interface WeatherWidgetProps extends BaseWidgetProps {
  /** Optional title override */
  title?: string;
  /** Current weather data */
  currentWeather?: CurrentWeatherData | null;
  /** 3-day forecast data */
  forecast?: ForecastDay[];
  loadingState?: LoadingState;
  onRetry?: () => void;
}

const FORECAST: ForecastDay[] = [
  {
    labelKey: 'widgets.weather.days.today',
    high: 28,
    low: 19,
    icon: 'sunny',
    conditionKey: 'widgets.weather.conditions.sunny',
  },
  {
    labelKey: 'widgets.weather.days.tomorrow',
    high: 30,
    low: 21,
    icon: 'cloudy',
    conditionKey: 'widgets.weather.conditions.cloudy',
  },
  {
    labelKey: 'widgets.weather.days.dayAfter',
    high: 26,
    low: 18,
    icon: 'rainy',
    conditionKey: 'widgets.weather.conditions.rainy',
  },
];

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  title,
  currentWeather,
  forecast = FORECAST,
  testID,
  accessibilityLabel,
  style,
  loadingState = 'idle',
  onRetry,
}) => {
  const { t } = useTranslation();
  const m3 = useM3();
  const { colorScheme, surface, typography } = m3;

  if (loadingState === 'loading') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Weather loading'}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: surface.surfaceContainerLow,
            borderColor: colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Text style={[styles.message, { color: colorScheme.onSurfaceVariant }]}>
          {t('widgets.common.loading')}
        </Text>
      </View>
    );
  }

  if (loadingState === 'error') {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Weather error'}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: surface.surfaceContainerLow,
            borderColor: colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons name="alert-circle" size={32} color={colorScheme.error} style={styles.icon} />
        <Text style={[styles.message, { color: colorScheme.error }]}>
          {t('widgets.common.error')}
        </Text>
        {onRetry && (
          <Pressable onPress={onRetry}>
            <Text style={[styles.retry, { color: colorScheme.primary }]}>
              {t('widgets.common.retry')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!currentWeather) {
    return (
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? 'Weather empty'}
        style={[
          styles.card,
          styles.centered,
          {
            backgroundColor: surface.surfaceContainerLow,
            borderColor: colorScheme.outlineVariant,
          },
          style,
        ]}
      >
        <Ionicons
          name="cloud-outline"
          size={32}
          color={colorScheme.onSurfaceVariant}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: colorScheme.onSurfaceVariant }]}>
          {t('widgets.common.empty')}
        </Text>
      </View>
    );
  }

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
        {title ?? t('widgets.weather.title')}
      </Text>

      {/* Current conditions row */}
      <View style={styles.currentRow}>
        <View style={styles.tempSection}>
          <Ionicons
            name={currentWeather.icon}
            size={40}
            color={colorScheme.primary}
            accessibilityLabel={t(currentWeather.conditionKey)}
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
            accessibilityLabel={`Condition: ${t(currentWeather.conditionKey)}`}
          >
            {t(currentWeather.conditionKey)}
          </Text>
          <View style={styles.detailRow}>
            <Ionicons name="water-outline" size={14} color={colorScheme.onSurfaceVariant} />
            <Text
              style={[
                typography.bodyMedium,
                { color: colorScheme.onSurfaceVariant, marginLeft: spacing[1] },
              ]}
              accessibilityLabel={`${t('widgets.weather.humidity')} ${currentWeather.humidity} percent`}
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
              accessibilityLabel={`${t('widgets.weather.wind')} ${currentWeather.wind} kilometers per hour`}
            >
              {currentWeather.wind} km/h
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colorScheme.outlineVariant }]} />

      {/* 3-day forecast */}
      <View style={styles.forecastRow} accessibilityLabel={t('widgets.weather.forecast')}>
        {forecast.map((day) => (
          <View
            key={day.labelKey}
            style={[
              styles.forecastDay,
              { backgroundColor: colorWithOpacity(colorScheme.primary, 0.06) },
            ]}
            accessibilityLabel={`${t(day.labelKey)}: ${t(day.conditionKey)}, high ${day.high} degrees, low ${day.low} degrees`}
          >
            <Text style={[typography.labelSmall, { color: colorScheme.onSurfaceVariant }]}>
              {t(day.labelKey)}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  icon: {
    marginBottom: spacing[2],
  },
  message: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  retry: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing[3],
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
