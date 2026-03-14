/**
 * Farm Weather Module
 * Fetches weather data from Open-Meteo and builds context blocks.
 * SECURITY: Only fetches weather for validated farm coordinates — no hardcoded fallbacks.
 */

import type { Citation, ToolCall, WeatherData } from './farm-details.ts';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

function getWeatherCondition(temp: number, precipitation: number): string {
  if (precipitation > 5) return 'Rainy';
  if (precipitation > 0) return 'Light Rain';
  if (temp > 35) return 'Hot';
  if (temp > 25) return 'Sunny';
  if (temp > 15) return 'Partly Cloudy';
  return 'Cloudy';
}

/**
 * Fetch weather data for given coordinates.
 * SECURITY: latitude/longitude must both be non-null; returns null data otherwise.
 * Callers (assembleContext) must validate farm ownership before passing coordinates.
 */
export async function fetchWeatherData(input: {
  latitude: number | null;
  longitude: number | null;
  locale: 'en' | 'hi' | 'mr';
  toolCalls: ToolCall[];
}): Promise<{ data: WeatherData | null; citation: Citation | null }> {
  if (input.latitude === null || input.longitude === null) {
    input.toolCalls.push({
      tool: 'weather.fetch',
      status: 'skipped',
      output: { reason: 'no_farm_coordinates' },
    });
    return { data: null, citation: null };
  }

  const lat = input.latitude;
  const lon = input.longitude;

  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'temperature_2m_mean',
        'relative_humidity_2m_mean',
        'precipitation_sum',
        'precipitation_probability_max',
        'et0_fao_evapotranspiration',
        'wind_speed_10m_max',
      ].join(','),
      timezone: 'auto',
      forecast_days: '7',
    });

    const response = await fetch(`${OPEN_METEO_API}?${params}`);
    if (!response.ok) {
      input.toolCalls.push({
        tool: 'weather.fetch',
        status: 'error',
        error: `HTTP ${response.status}`,
      });
      return { data: null, citation: null };
    }

    const json = await response.json();
    const daily = json.daily;

    if (!daily || !Array.isArray(daily.time)) {
      input.toolCalls.push({
        tool: 'weather.fetch',
        status: 'error',
        error: 'invalid_response_format',
      });
      return { data: null, citation: null };
    }

    const weatherData: WeatherData = {
      temperature: Math.round(daily.temperature_2m_mean[0]),
      humidity: Math.round(daily.relative_humidity_2m_mean[0]),
      windSpeed: Math.round(daily.wind_speed_10m_max[0]),
      precipitation: daily.precipitation_sum[0] || 0,
      precipitationProbability: daily.precipitation_probability_max?.[0] || 0,
      condition: getWeatherCondition(daily.temperature_2m_mean[0], daily.precipitation_sum[0]),
      et0: daily.et0_fao_evapotranspiration[0] || 5,
      forecast: daily.time.slice(0, 7).map((date: string, i: number) => ({
        date,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        precipitation: daily.precipitation_sum[i] || 0,
        precipitationProbability: daily.precipitation_probability_max?.[i] || 0,
        et0: daily.et0_fao_evapotranspiration[i] || 5,
      })),
    };

    input.toolCalls.push({
      tool: 'weather.fetch',
      status: 'ok',
      output: { temperature: weatherData.temperature, condition: weatherData.condition },
    });

    const citation: Citation = {
      id: 'weather-current',
      title: 'Current weather',
      sourceType: 'weather',
      snippet: `${weatherData.temperature}°C, ${weatherData.condition}, ${weatherData.precipitation}mm rain`,
      metadata: { source: 'open-meteo', latitude: lat, longitude: lon },
    };

    return { data: weatherData, citation };
  } catch (error) {
    input.toolCalls.push({ tool: 'weather.fetch', status: 'error', error: String(error) });
    return { data: null, citation: null };
  }
}

/**
 * Build weather context block for LLM
 */
export function buildWeatherContextBlock(weather: WeatherData | null): string {
  if (!weather) return '';

  const forecast3Days = weather.forecast.slice(0, 3);
  const upcomingRain = forecast3Days.reduce((sum, d) => sum + d.precipitation, 0);
  const maxRainProb = Math.max(...forecast3Days.map((d) => d.precipitationProbability));

  return `Weather context:
- Current: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.condition}
- Wind: ${weather.windSpeed} km/h
- ET0: ${weather.et0.toFixed(1)} mm/day
- Precipitation today: ${weather.precipitation} mm
- 3-day rain: ${upcomingRain.toFixed(1)} mm (${maxRainProb}% probability)
- Forecast: ${forecast3Days.map((d) => `${d.date}: ${d.maxTemp}°/${d.minTemp}°C, ${d.precipitation}mm`).join('; ')}`;
}
