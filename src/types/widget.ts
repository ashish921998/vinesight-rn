/**
 * Widget data types for home screen widgets
 * Shared between React Native app and native widgets
 */

export interface WeatherWidgetData {
  farmId: number;
  farmName: string;
  current: {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    icon: string;
  };
  forecast: WeatherForecastDay[];
  lastUpdated: number;
}

export interface WeatherForecastDay {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
}

export interface WidgetConfig {
  selectedFarmId: number | null;
  selectedFarmName: string | null;
}

export interface WidgetDataPayload {
  weather?: WeatherWidgetData;
  config?: WidgetConfig;
}

export type WidgetType = 'weather';

export const WIDGET_DEFAULTS = {
  APP_GROUP_IOS: 'group.com.vinesight.app',
  SHARED_PREFS_ANDROID: 'VineyardWidget',
  WIDGET_DATA_KEY: 'widgetData',
  WIDGET_CONFIG_KEY: 'widgetConfig',
} as const;
