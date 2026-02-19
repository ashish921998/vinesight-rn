/**
 * Widget Configuration Screen
 * Allows users to select which farm's weather to display in the home screen widget
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import { Button } from '@/components/ui';
import { useFarms } from '@/hooks';
import { useWidgetConfig } from '@/hooks/use-widget-config';
import { WidgetSyncService } from '@/services/widget-sync-service';
import { WeatherService } from '@/services/weather-service';
import type { WeatherWidgetData } from '@/types/widget';

import { spacing, borderRadius, fontSize, fontWeight } from '@/styles/theme';
import { useThemeTokens } from '@/styles/use-theme';
import { telemetry } from '@/services/telemetry';

interface ServiceWeatherData {
  current: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    icon?: string;
    conditionCode?: number;
  };
  forecast: Array<{
    date?: string;
    day?: string;
    maxTemp?: number;
    high?: number;
    minTemp?: number;
    low?: number;
    condition: string;
    icon?: string;
    conditionCode?: number;
  }>;
}

export default function WidgetConfigurationScreen() {
  const { t } = useTranslation();
  const { m3 } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const { config, isLoading: configLoading, saveConfig } = useWidgetConfig();

  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-select first farm if no config exists
  useEffect(() => {
    if (!configLoading && farms && farms.length > 0) {
      if (config?.selectedFarmId != null) {
        setSelectedFarmId(config.selectedFarmId);
      } else {
        // Auto-select first farm
        const firstId = farms[0]?.id;
        if (typeof firstId === 'number') setSelectedFarmId(firstId);
      }
    }
  }, [config, configLoading, farms]);

  const handleSave = async () => {
    if (selectedFarmId == null || farms == null) return;

    const selectedFarm = farms.find((f) => f.id === selectedFarmId);
    if (!selectedFarm) return;

    try {
      setIsSaving(true);

      const farmId = selectedFarm.id;
      if (typeof farmId !== 'number') {
        Alert.alert(
          t('widgetConfig.errorTitle', 'Error'),
          t('widgetConfig.invalidFarmSelection', 'Invalid farm selection. Please try again.'),
        );
        return;
      }
      const latitude = selectedFarm.latitude ?? undefined;
      const longitude = selectedFarm.longitude ?? undefined;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        Alert.alert(
          t('widgetConfig.errorTitle', 'Error'),
          t(
            'widgetConfig.coordinatesRequired',
            'This farm is missing location coordinates. Please add coordinates and try again.',
          ),
        );
        return;
      }

      // Save widget configuration
      await saveConfig(farmId, selectedFarm.name);

      // Fetch and sync weather data for selected farm
      try {
        await syncWeatherForFarm(farmId, latitude, longitude);
      } catch (_syncError) {
        Alert.alert(
          t('widgetConfig.successTitle', 'Widget Configured'),
          t(
            'widgetConfig.partialSyncMessage',
            'Widget configured, but weather data could not be synced. It will update automatically later.',
          ),
          [{ text: t('common.ok', 'OK') }],
        );
        return;
      }

      // Track widget configuration
      telemetry.capture('widget_configured', {
        widget_type: 'weather',
        farm_id: farmId,
      });

      Alert.alert(
        t('widgetConfig.successTitle', 'Widget Configured'),
        t(
          'widgetConfig.successMessage',
          'Your weather widget has been updated. Add it to your home screen to see the weather for {{farmName}}.',
          { farmName: selectedFarm.name },
        ),
        [{ text: t('common.ok', 'OK') }],
      );
    } catch (error) {
      console.error('Failed to save widget config:', error);
      Alert.alert(
        t('widgetConfig.errorTitle', 'Error'),
        t('widgetConfig.errorMessage', 'Failed to configure widget. Please try again.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const syncWeatherForFarm = async (farmId: number, latitude?: number, longitude?: number) => {
    try {
      // Get weather data for the farm (service format)
      const serviceData = await fetchWeatherForFarm(latitude, longitude);

      if (farms) {
        const farm = farms.find((f) => f.id === farmId);
        if (farm) {
          const syncFarmId = farm.id;
          if (typeof syncFarmId !== 'number') return;
          // Transform service data to widget format before syncing
          const widgetData = mapServiceWeatherToWidget(serviceData, syncFarmId, farm.name);
          await WidgetSyncService.syncWeather(widgetData, {
            selectedFarmId: syncFarmId,
            selectedFarmName: farm.name,
          });
        }
      }
    } catch (syncError) {
      console.error('Failed to sync weather for widget:', syncError);
      throw syncError;
    }
  };

  const fetchWeatherForFarm = async (
    latitude?: number,
    longitude?: number,
  ): Promise<ServiceWeatherData> => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Missing farm coordinates for widget weather sync');
    }

    const weatherData = await WeatherService.getWeatherData(latitude, longitude, 3);
    return {
      current: {
        temperature: weatherData.current.temperature,
        condition: weatherData.current.condition,
        humidity: weatherData.current.humidity,
        windSpeed: weatherData.current.windSpeed,
        conditionCode: weatherData.current.conditionCode,
      },
      forecast: weatherData.forecast.slice(0, 3).map((day) => ({
        date: day.date,
        maxTemp: day.maxTemp,
        minTemp: day.minTemp,
        condition: day.condition,
        conditionCode: day.conditionCode,
      })),
    };
  };

  /**
   * Maps service ForecastDay format to widget WeatherForecastDay format
   * Service: { date, maxTemp, minTemp, condition, icon }
   * Widget: { day, high, low, condition, icon }
   */
  const mapServiceWeatherToWidget = (
    serviceData: ServiceWeatherData,
    farmId: number,
    farmName: string,
  ): WeatherWidgetData => {
    const today = new Date();
    const deriveIcon = (condition: string): string => {
      const lower = condition.toLowerCase();
      if (lower.includes('partly')) return 'partly-cloudy';
      if (lower.includes('sun') || lower.includes('clear')) return 'sunny';
      if (lower.includes('cloud')) return 'cloudy';
      if (lower.includes('rain') || lower.includes('drizzle')) return 'rainy';
      return 'partly-cloudy';
    };
    const formatDay = (dateStr: string): string => {
      const dateParts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const date = dateParts
        ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
        : new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    };

    return {
      farmId,
      farmName,
      current: {
        temperature: serviceData.current.temperature,
        condition: serviceData.current.condition,
        humidity: serviceData.current.humidity,
        windSpeed: serviceData.current.windSpeed,
        icon:
          serviceData.current.conditionCode != null
            ? WeatherService.getWeatherIcon(serviceData.current.conditionCode)
            : (serviceData.current.icon ?? deriveIcon(serviceData.current.condition)),
      },
      forecast: serviceData.forecast.map((day, index) => ({
        day:
          day.day ??
          (day.date
            ? formatDay(day.date)
            : formatDay(
                new Date(today.getTime() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
              )),
        high: day.high ?? day.maxTemp ?? 0,
        low: day.low ?? day.minTemp ?? 0,
        condition: day.condition,
        icon:
          day.conditionCode != null
            ? WeatherService.getWeatherIcon(day.conditionCode)
            : (day.icon ?? deriveIcon(day.condition)),
      })),
      lastUpdated: Date.now(),
    };
  };

  if (farmsLoading || configLoading) {
    return (
      <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
        <ActivityIndicator size="large" color={m3.colorScheme.primary} />
      </View>
    );
  }

  if (!farms || farms.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: m3.colorScheme.background }]}>
        <Text style={{ color: m3.colorScheme.onSurface }}>
          {t('widgetConfig.noFarms', 'No farms found. Please add a farm first.')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('widgetConfig.title', 'Home Screen Widget'),
          headerShown: true,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: m3.colorScheme.background }]}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing[6],
        }}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: m3.colorScheme.onSurface }]}>
            {t('widgetConfig.selectFarm', 'Select Farm for Weather Widget')}
          </Text>

          <Text style={[styles.description, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t(
              'widgetConfig.description',
              "Choose which farm's weather information to display on your home screen widget. The widget will update daily with current conditions and a 3-day forecast.",
            )}
          </Text>

          <View
            style={[
              styles.pickerContainer,
              {
                backgroundColor: m3.colorScheme.surface,
                borderColor: m3.colorScheme.outline,
              },
            ]}
          >
            <Picker
              selectedValue={selectedFarmId}
              onValueChange={(itemValue) => setSelectedFarmId(itemValue)}
              accessibilityLabel={t('widgetConfig.selectFarm', 'Select farm')}
              style={styles.picker}
            >
              {farms.map((farm) => (
                <Picker.Item key={farm.id} label={farm.name} value={farm.id} />
              ))}
            </Picker>
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.infoTitle, { color: m3.colorScheme.onSurface }]}>
              {t('widgetConfig.widgetInfo', 'Widget Information')}
            </Text>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                {t('widgetConfig.size', 'Size:')}
              </Text>
              <Text style={[styles.infoValue, { color: m3.colorScheme.onSurface }]}>
                {t('widgetConfig.large', 'Large')}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                {t('widgetConfig.updateFrequency', 'Updates:')}
              </Text>
              <Text style={[styles.infoValue, { color: m3.colorScheme.onSurface }]}>
                {t('widgetConfig.daily', 'Daily')}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: m3.colorScheme.onSurfaceVariant }]}>
                {t('widgetConfig.tapAction', 'Tap widget to:')}
              </Text>
              <Text style={[styles.infoValue, { color: m3.colorScheme.onSurface }]}>
                {t('widgetConfig.openWeather', 'Open detailed weather')}
              </Text>
            </View>
          </View>

          <Button
            title={t('widgetConfig.saveButton', 'Save Configuration')}
            onPress={handleSave}
            isLoading={isSaving}
            disabled={selectedFarmId == null || isSaving}
            style={styles.saveButton}
          />

          <Text style={[styles.helpText, { color: m3.colorScheme.onSurfaceVariant }]}>
            {t(
              'widgetConfig.helpText',
              'After saving, add the Vinesight widget to your home screen by long-pressing on your home screen and selecting "Widgets".',
            )}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
  },
  description: {
    fontSize: fontSize.base,
    marginBottom: spacing[6],
    lineHeight: 22,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing[6],
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  infoSection: {
    marginBottom: spacing[6],
  },
  infoTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing[3],
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  infoLabel: {
    fontSize: fontSize.base,
    width: 120,
  },
  infoValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  saveButton: {
    marginBottom: spacing[4],
  },
  helpText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
