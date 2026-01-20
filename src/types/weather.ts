/**
 * Weather Types for Vinesight
 * Based on Open-Meteo API for agricultural weather data
 */

// Current weather conditions
export interface CurrentWeather {
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  windDirection: string;
  uvIndex: number;
  cloudCover: number; // %
  condition: string;
  conditionCode: number;
  precipitation: number; // mm
  feelsLike: number; // °C
}

// Daily forecast data
export interface ForecastDay {
  date: string;
  maxTemp: number; // °C
  minTemp: number; // °C
  avgTemp: number; // °C
  maxHumidity: number; // %
  minHumidity: number; // %
  avgHumidity: number; // %
  precipitation: number; // mm
  precipitationProbability: number; // %
  windSpeed: number; // km/h
  windDirection: string;
  condition: string;
  conditionCode: number;
  uvIndex: number;
  et0?: number; // Reference evapotranspiration from Open-Meteo (mm/day)
}

// Location data
export interface LocationData {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
}

// Combined weather data response
export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  location: LocationData;
  lastUpdated: Date;
}

// Evapotranspiration calculation results
export interface ETc {
  dailyETc: number; // mm/day
  weeklyETc: number; // mm/week
  monthlyETc: number; // mm/month
  cropCoefficient: number;
  referenceET: number; // mm/day (ET0)
  growthStage: string;
}

// Weather-based alerts
export interface WeatherAlerts {
  irrigation: {
    shouldIrrigate: boolean;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
    recommendations: string[];
  };
  pest: {
    riskLevel: 'low' | 'medium' | 'high';
    conditions: string[];
    precautions: string[];
  };
  harvest: {
    isOptimal: boolean;
    conditions: string;
    recommendations: string[];
  };
}

// Irrigation schedule item
export interface IrrigationScheduleItem {
  date: string;
  duration: number; // hours
  amount: number; // mm
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

// Full irrigation schedule
export interface IrrigationSchedule {
  schedule: IrrigationScheduleItem[];
  totalWaterNeed: number;
}

// Open-Meteo API response types
export interface OpenMeteoWeatherData {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  temperatureMean: number;
  relativeHumidityMax: number;
  relativeHumidityMin: number;
  relativeHumidityMean: number;
  windSpeed10m: number;
  windDirection10m: number;
  windSpeedMax: number;
  precipitationSum: number;
  shortwaveRadiationSum: number;
  sunshineDuration: number;
  et0FaoEvapotranspiration: number;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
}

// Growth stages for grape crops
export type GrapeGrowthStage =
  | 'Budbreak'
  | 'Leaf development'
  | 'Flowering'
  | 'Fruit set'
  | 'Veraison'
  | 'Harvest'
  | 'Post-harvest'
  | 'Dormant';

// Soil types for irrigation calculations
export type SoilType = 'sandy' | 'medium' | 'clay';
