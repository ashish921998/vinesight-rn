/**
 * Widget Storage Service
 * Handles persistent storage of widget configuration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetConfig } from '@/types/widget';

const STORAGE_KEY = '@vinesight/widget_config';

export class WidgetStorageService {
  /**
   * Save widget configuration to local storage
   */
  static async saveConfig(config: WidgetConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save widget config to storage:', error);
      throw error;
    }
  }

  /**
   * Load widget configuration from local storage
   */
  static async loadConfig(): Promise<WidgetConfig | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as WidgetConfig;
      }
      return null;
    } catch (error) {
      console.error('Failed to load widget config from storage:', error);
      return null;
    }
  }

  /**
   * Clear widget configuration
   */
  static async clearConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear widget config:', error);
      throw error;
    }
  }

  /**
   * Get default config (auto-select first farm)
   */
  static getDefaultConfig(farmId: number, farmName: string): WidgetConfig {
    return {
      selectedFarmId: farmId,
      selectedFarmName: farmName,
    };
  }
}
