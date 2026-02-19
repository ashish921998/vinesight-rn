/**
 * Weather Hooks for Vinesight
 * React Query hooks for weather data and ETc calculations
 */

import { useQuery } from '@tanstack/react-query';
import { WeatherService } from '../services/weather-service';
import { QUERY_CACHE_MAX_AGE_MS } from '@/lib/query-cache';
import {
  WeatherData,
  ETc,
  WeatherAlerts,
  IrrigationSchedule,
  GrapeGrowthStage,
  SoilType,
} from '../types/weather';

const WEATHER_COORDINATE_PRECISION = 3;

const normalizeCoordinate = (value?: number): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const factor = 10 ** WEATHER_COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
};

// Query keys for weather data
export const weatherQueryKeys = {
  all: ['weather'] as const,
  weather: (lat?: number, lng?: number) => [...weatherQueryKeys.all, 'data', lat, lng] as const,
};

/**
 * Hook to fetch weather data for a location
 */
export function useWeather(latitude?: number, longitude?: number) {
  const normalizedLatitude = normalizeCoordinate(latitude);
  const normalizedLongitude = normalizeCoordinate(longitude);

  return useQuery<WeatherData, Error>({
    queryKey: weatherQueryKeys.weather(normalizedLatitude, normalizedLongitude),
    queryFn: () => WeatherService.getWeatherData(normalizedLatitude, normalizedLongitude),
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: QUERY_CACHE_MAX_AGE_MS, // must be >= persister maxAge for persistence
    retry: 2,
    enabled: true, // Always fetch (will use default location if no coords)
  });
}

/**
 * Hook to calculate ETc based on weather data and growth stage
 */
export function useETc(
  weather: WeatherData | undefined,
  growthStage: GrapeGrowthStage,
): ETc | null {
  if (!weather) return null;
  return WeatherService.calculateETc(weather, growthStage);
}

/**
 * Hook to generate weather alerts
 */
export function useWeatherAlerts(
  weather: WeatherData | undefined,
  etc: ETc | null,
): WeatherAlerts | null {
  if (!weather || !etc) return null;
  return WeatherService.generateWeatherAlerts(weather, etc);
}

/**
 * Hook to generate irrigation schedule
 */
export function useIrrigationSchedule(
  weather: WeatherData | undefined,
  etc: ETc | null,
  soilType: SoilType = 'medium',
): IrrigationSchedule | null {
  if (!weather || !etc) return null;
  return WeatherService.generateIrrigationSchedule(weather, etc, soilType);
}

/**
 * Combined hook for all weather-related calculations
 */
export function useWeatherData(
  latitude?: number,
  longitude?: number,
  growthStage: GrapeGrowthStage = 'Fruit set',
  soilType: SoilType = 'medium',
) {
  const weatherQuery = useWeather(latitude, longitude);
  const weather = weatherQuery.data;

  const etc = useETc(weather, growthStage);
  const alerts = useWeatherAlerts(weather, etc);
  const irrigationSchedule = useIrrigationSchedule(weather, etc, soilType);

  return {
    weather,
    etc,
    alerts,
    irrigationSchedule,
    isLoading: weatherQuery.isLoading,
    error: weatherQuery.error,
    refetch: weatherQuery.refetch,
    isRefetching: weatherQuery.isRefetching,
  };
}
