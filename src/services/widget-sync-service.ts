/**
 * Widget Sync Service
 * Handles syncing data from React Native to native home screen widgets
 */

import { Platform, NativeModules } from 'react-native';
import type { WeatherWidgetData, WidgetConfig, WidgetDataPayload } from '@/types/widget';

const { WidgetBridge } = NativeModules;

export class WidgetSyncService {
  /**
   * Sync weather data to the widget
   */
  static async syncWeather(weatherData: WeatherWidgetData): Promise<void> {
    try {
      const payload: WidgetDataPayload = {
        weather: weatherData,
      };

      const jsonString = JSON.stringify(payload);

      if (WidgetBridge?.updateWidget) {
        await WidgetBridge.updateWidget(jsonString);
      } else {
        throw new Error('WidgetBridge native module is not available');
      }
    } catch (error) {
      console.error('Failed to sync weather widget:', error);
      throw error;
    }
  }

  /**
   * Save widget configuration (selected farm)
   */
  static async saveWidgetConfig(config: WidgetConfig): Promise<void> {
    try {
      const jsonString = JSON.stringify(config);

      if (WidgetBridge?.saveWidgetConfig) {
        await WidgetBridge.saveWidgetConfig(jsonString);
      } else {
        throw new Error('WidgetBridge native module is not available');
      }
    } catch (error) {
      console.error('Failed to save widget config:', error);
      throw error;
    }
  }

  /**
   * Load widget configuration
   */
  static async loadWidgetConfig(): Promise<WidgetConfig | null> {
    try {
      if (WidgetBridge?.loadWidgetConfig) {
        const configString = await WidgetBridge.loadWidgetConfig();
        if (!configString) return null;
        const parsed = JSON.parse(configString);
        if (parsed && typeof parsed === 'object' && 'selectedFarmId' in parsed) {
          return parsed as WidgetConfig;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to load widget config:', error);
      return null;
    }
  }

  /**
   * Trigger widget reload (iOS only)
   */
  static async reloadWidgets(): Promise<void> {
    if (Platform.OS === 'ios' && WidgetBridge?.reloadAllWidgets) {
      await WidgetBridge.reloadAllWidgets();
    }
  }
}
