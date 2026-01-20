/**
 * Weather Service for Vinesight
 * Uses Open-Meteo free API for agricultural weather data
 */

import {
  WeatherData,
  CurrentWeather,
  ForecastDay,
  LocationData,
  ETc,
  WeatherAlerts,
  IrrigationSchedule,
  OpenMeteoWeatherData,
  GrapeGrowthStage,
  SoilType,
} from '../types/weather';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

// Default coordinates for Maharashtra grape region
const DEFAULT_COORDS = {
  latitude: 19.0825,
  longitude: 73.1963,
  name: 'Nashik',
  region: 'Maharashtra',
  country: 'India',
};

export class WeatherService {
  /**
   * Fetch weather data from Open-Meteo API
   */
  static async getWeatherData(
    latitude?: number,
    longitude?: number,
    days: number = 7
  ): Promise<WeatherData> {
    const coords =
      latitude && longitude
        ? { latitude, longitude, name: 'Farm Location', region: '', country: '' }
        : DEFAULT_COORDS;

    try {
      const params = new URLSearchParams({
        latitude: coords.latitude.toString(),
        longitude: coords.longitude.toString(),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'temperature_2m_mean',
          'relative_humidity_2m_max',
          'relative_humidity_2m_min',
          'relative_humidity_2m_mean',
          'wind_speed_10m_max',
          'wind_direction_10m_dominant',
          'precipitation_sum',
          'shortwave_radiation_sum',
          'sunshine_duration',
          'et0_fao_evapotranspiration',
          'precipitation_probability_max',
          'uv_index_max',
        ].join(','),
        timezone: 'auto',
        forecast_days: days.toString(),
      });

      const response = await fetch(`${OPEN_METEO_API}?${params}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseWeatherResponse(data, coords);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw new Error(
        `Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private static parseWeatherResponse(
    data: any,
    coords: { latitude: number; longitude: number; name: string; region: string; country: string }
  ): WeatherData {
    const daily = data.daily;
    const today = daily.time[0];

    // Current weather from today's data
    const currentWeather: CurrentWeather = {
      temperature: Math.round(daily.temperature_2m_mean[0]),
      humidity: Math.round(daily.relative_humidity_2m_mean[0]),
      windSpeed: Math.round(daily.wind_speed_10m_max[0]),
      windDirection: this.getWindDirection(daily.wind_direction_10m_dominant[0]),
      uvIndex: Math.round(daily.uv_index_max?.[0] || this.estimateUVIndex(daily.shortwave_radiation_sum[0])),
      cloudCover: this.estimateCloudCover(daily.sunshine_duration[0]),
      condition: this.getWeatherCondition(
        daily.temperature_2m_mean[0],
        daily.precipitation_sum[0]
      ),
      conditionCode: this.getConditionCode(
        daily.temperature_2m_mean[0],
        daily.precipitation_sum[0]
      ),
      precipitation: daily.precipitation_sum[0] || 0,
      feelsLike: Math.round(daily.temperature_2m_mean[0]),
    };

    // Forecast data
    const forecast: ForecastDay[] = daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: Math.round(daily.temperature_2m_max[i]),
      minTemp: Math.round(daily.temperature_2m_min[i]),
      avgTemp: Math.round(daily.temperature_2m_mean[i]),
      maxHumidity: Math.round(daily.relative_humidity_2m_max[i]),
      minHumidity: Math.round(daily.relative_humidity_2m_min[i]),
      avgHumidity: Math.round(daily.relative_humidity_2m_mean[i]),
      precipitation: daily.precipitation_sum[i] || 0,
      precipitationProbability: daily.precipitation_probability_max?.[i] || 
        this.estimatePrecipitationProbability(daily.precipitation_sum[i]),
      windSpeed: Math.round(daily.wind_speed_10m_max[i]),
      windDirection: this.getWindDirection(daily.wind_direction_10m_dominant[i]),
      condition: this.getWeatherCondition(
        daily.temperature_2m_mean[i],
        daily.precipitation_sum[i]
      ),
      conditionCode: this.getConditionCode(
        daily.temperature_2m_mean[i],
        daily.precipitation_sum[i]
      ),
      uvIndex: Math.round(daily.uv_index_max?.[i] || this.estimateUVIndex(daily.shortwave_radiation_sum[i])),
      et0: daily.et0_fao_evapotranspiration[i],
    }));

    return {
      current: currentWeather,
      forecast,
      location: {
        name: coords.name,
        region: coords.region,
        country: coords.country,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        elevation: data.elevation,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate ETc (Crop Evapotranspiration) for grapes
   */
  static calculateETc(weather: WeatherData, growthStage: GrapeGrowthStage): ETc {
    // Crop coefficients for grape growth stages (FAO-56)
    const cropCoefficients: Record<GrapeGrowthStage, number> = {
      Budbreak: 0.3,
      'Leaf development': 0.5,
      Flowering: 0.7,
      'Fruit set': 0.8,
      Veraison: 0.8,
      Harvest: 0.6,
      'Post-harvest': 0.4,
      Dormant: 0.2,
    };

    const kc = cropCoefficients[growthStage];

    // Get ET0 from Open-Meteo (FAO Penman-Monteith)
    const et0 = weather.forecast[0]?.et0 || 5; // Default 5mm if not available

    const dailyETc = et0 * kc;
    const weeklyETc = dailyETc * 7;
    const monthlyETc = dailyETc * 30;

    return {
      dailyETc: Math.round(dailyETc * 100) / 100,
      weeklyETc: Math.round(weeklyETc * 100) / 100,
      monthlyETc: Math.round(monthlyETc * 100) / 100,
      cropCoefficient: kc,
      referenceET: Math.round(et0 * 100) / 100,
      growthStage,
    };
  }

  /**
   * Generate weather-based alerts for farming
   */
  static generateWeatherAlerts(weather: WeatherData, etc: ETc): WeatherAlerts {
    const current = weather.current;
    const forecast = weather.forecast.slice(0, 3);

    return {
      irrigation: this.generateIrrigationAlert(weather, etc),
      pest: this.generatePestAlert(weather),
      harvest: this.generateHarvestAlert(weather),
    };
  }

  private static generateIrrigationAlert(
    weather: WeatherData,
    etc: ETc
  ): WeatherAlerts['irrigation'] {
    const current = weather.current;
    const forecast = weather.forecast.slice(0, 3);

    const upcomingRain = forecast.reduce((sum, day) => sum + day.precipitation, 0);
    const rainProbability = Math.max(...forecast.map((day) => day.precipitationProbability));
    const shouldIrrigate = upcomingRain < etc.dailyETc * 2 && rainProbability < 60;

    let urgency: 'low' | 'medium' | 'high' = 'medium';
    let reason = '';
    const recommendations: string[] = [];

    if (current.temperature > 35) {
      urgency = 'high';
      reason = 'High temperature stress detected';
      recommendations.push('Increase irrigation frequency');
      recommendations.push('Consider early morning irrigation');
    } else if (current.humidity < 30) {
      urgency = 'high';
      reason = 'Low humidity increasing water demand';
      recommendations.push('Monitor soil moisture closely');
    } else if (upcomingRain < 5 && rainProbability < 30) {
      urgency = 'medium';
      reason = 'Low rainfall expected in next 3 days';
      recommendations.push('Plan irrigation for next 24-48 hours');
    } else {
      urgency = 'low';
      reason = 'Adequate moisture conditions expected';
      recommendations.push('Monitor soil moisture levels');
    }

    if (current.windSpeed > 20) {
      recommendations.push('High winds detected - avoid overhead irrigation');
    }

    return { shouldIrrigate, reason, urgency, recommendations };
  }

  private static generatePestAlert(weather: WeatherData): WeatherAlerts['pest'] {
    const current = weather.current;
    const forecast = weather.forecast.slice(0, 3);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const conditions: string[] = [];
    const precautions: string[] = [];

    // High humidity + moderate temperature = fungal risk
    if (current.humidity > 80 && current.temperature > 20 && current.temperature < 30) {
      riskLevel = 'high';
      conditions.push('High humidity - increased fungal disease risk');
      precautions.push('Monitor for powdery mildew and downy mildew');
      precautions.push('Improve air circulation around vines');
    }

    // Wet conditions
    const recentRain =
      current.precipitation + forecast.slice(0, 2).reduce((sum, day) => sum + day.precipitation, 0);
    if (recentRain > 10) {
      if (riskLevel === 'low') riskLevel = 'medium';
      conditions.push('Wet conditions increase disease pressure');
      precautions.push('Inspect for leaf spot diseases');
      precautions.push('Ensure proper drainage');
    }

    // Temperature extremes
    if (current.temperature > 38) {
      conditions.push('High temperature stress');
      precautions.push('Monitor for heat stress symptoms');
    } else if (current.temperature < 10) {
      conditions.push('Low temperature may affect growth');
      precautions.push('Monitor for cold damage');
    }

    if (conditions.length === 0) {
      conditions.push('Favorable weather conditions');
      precautions.push('Continue regular monitoring');
    }

    return { riskLevel, conditions, precautions };
  }

  private static generateHarvestAlert(weather: WeatherData): WeatherAlerts['harvest'] {
    const forecast = weather.forecast.slice(0, 5);

    const upcomingRain = forecast.reduce((sum, day) => sum + day.precipitation, 0);
    const avgTemp = forecast.reduce((sum, day) => sum + day.avgTemp, 0) / forecast.length;
    const maxRainProb = Math.max(...forecast.map((day) => day.precipitationProbability));

    const isOptimal = upcomingRain < 2 && avgTemp > 15 && avgTemp < 30 && maxRainProb < 30;

    let conditions = '';
    const recommendations: string[] = [];

    if (isOptimal) {
      conditions = 'Excellent harvest conditions expected';
      recommendations.push('Ideal weather window for harvesting');
      recommendations.push('Plan harvest operations for the next few days');
    } else if (upcomingRain > 10 || maxRainProb > 70) {
      conditions = 'Wet weather expected - not ideal for harvest';
      recommendations.push('Delay harvest if possible');
      recommendations.push('Monitor fruit condition closely');
    } else if (avgTemp > 35) {
      conditions = 'High temperatures may affect fruit quality';
      recommendations.push('Plan harvest for early morning hours');
      recommendations.push('Ensure rapid cooling of harvested grapes');
    } else {
      conditions = 'Moderate harvest conditions';
      recommendations.push('Monitor weather forecasts closely');
    }

    return { isOptimal, conditions, recommendations };
  }

  /**
   * Generate irrigation schedule based on weather and ETc
   */
  static generateIrrigationSchedule(
    weather: WeatherData,
    etc: ETc,
    soilType: SoilType = 'medium'
  ): IrrigationSchedule {
    const schedule: IrrigationSchedule['schedule'] = [];
    const forecast = weather.forecast.slice(0, 7);

    // Soil water holding capacity (mm per 30cm depth)
    const soilCapacity: Record<SoilType, number> = {
      sandy: 80,
      medium: 120,
      clay: 160,
    };

    const capacity = soilCapacity[soilType];
    let soilMoisture = capacity * 0.6; // Assume 60% initial moisture
    let totalWaterNeed = 0;

    for (const day of forecast) {
      const dailyET = etc.dailyETc;
      const rainfall = day.precipitation;

      soilMoisture = soilMoisture - dailyET + rainfall;

      const threshold = capacity * 0.4;

      if (soilMoisture < threshold && day.precipitationProbability < 70) {
        const deficit = threshold - soilMoisture;
        const irrigationAmount = Math.min(deficit + dailyET, capacity - soilMoisture);
        const duration = irrigationAmount / 4; // Assume 4mm/hour irrigation rate

        let priority: 'low' | 'medium' | 'high' = 'medium';
        let reason = 'Scheduled irrigation based on soil moisture';

        if (day.maxTemp > 35) {
          priority = 'high';
          reason = 'High temperature stress - critical irrigation needed';
        } else if (soilMoisture < capacity * 0.25) {
          priority = 'high';
          reason = 'Critical soil moisture level';
        }

        schedule.push({
          date: day.date,
          duration: Math.round(duration * 100) / 100,
          amount: Math.round(irrigationAmount * 100) / 100,
          reason,
          priority,
        });

        soilMoisture += irrigationAmount;
        totalWaterNeed += irrigationAmount;
      }
    }

    return {
      schedule,
      totalWaterNeed: Math.round(totalWaterNeed * 100) / 100,
    };
  }

  // Helper methods
  private static getWindDirection(degrees: number): string {
    if (degrees == null || isNaN(degrees)) return 'N/A';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
    return directions[index];
  }

  private static getWeatherCondition(temp: number, precipitation: number): string {
    if (precipitation > 5) return 'Rainy';
    if (precipitation > 0) return 'Light Rain';
    if (temp > 35) return 'Hot';
    if (temp > 25) return 'Sunny';
    if (temp > 15) return 'Partly Cloudy';
    if (temp > 5) return 'Cloudy';
    return 'Cold';
  }

  private static getConditionCode(temp: number, precipitation: number): number {
    if (precipitation > 5) return 1186;
    if (precipitation > 0) return 1153;
    if (temp > 30) return 1000;
    if (temp > 20) return 1003;
    return 1006;
  }

  private static estimateUVIndex(solarRadiation: number): number {
    return Math.min(11, Math.round((solarRadiation / 25) * 11));
  }

  private static estimateCloudCover(sunshineDuration: number): number {
    const sunshineDurationHours = sunshineDuration / 3600;
    const maxSunshine = 12;
    return Math.max(0, Math.min(100, Math.round(((maxSunshine - sunshineDurationHours) / maxSunshine) * 100)));
  }

  private static estimatePrecipitationProbability(precipitation: number): number {
    if (precipitation === 0) return 0;
    if (precipitation < 2) return 30;
    if (precipitation < 5) return 60;
    if (precipitation < 10) return 80;
    return 90;
  }

  /**
   * Get weather condition icon name for display
   */
  static getWeatherIcon(conditionCode: number): string {
    switch (conditionCode) {
      case 1000: return 'sunny';
      case 1003: return 'partly-sunny';
      case 1006: return 'cloudy';
      case 1153: return 'rainy';
      case 1186: return 'rainy';
      default: return 'cloudy';
    }
  }
}
