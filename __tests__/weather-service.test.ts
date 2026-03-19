import { WeatherService } from '@/services/weather-service';
import type { WeatherData } from '@/types/weather';

// Mock __DEV__ global
(global as Record<string, unknown>).__DEV__ = false;

// Mock fetch globally
const mockFetch = jest.fn();
(global as Record<string, unknown>).fetch = mockFetch;

const makeMockApiResponse = (days: number = 7) => {
  const time = Array.from({ length: days }, (_, i) => {
    const d = new Date(2024, 5, 15 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  return {
    latitude: 19.08,
    longitude: 73.2,
    timezone: 'Asia/Kolkata',
    elevation: 565,
    daily: {
      time,
      temperature_2m_max: Array(days).fill(35),
      temperature_2m_min: Array(days).fill(22),
      temperature_2m_mean: Array(days).fill(28),
      relative_humidity_2m_max: Array(days).fill(80),
      relative_humidity_2m_min: Array(days).fill(40),
      relative_humidity_2m_mean: Array(days).fill(60),
      wind_speed_10m_max: Array(days).fill(15),
      wind_direction_10m_dominant: Array(days).fill(180),
      precipitation_sum: Array(days).fill(0),
      shortwave_radiation_sum: Array(days).fill(20),
      sunshine_duration: Array(days).fill(36000),
      et0_fao_evapotranspiration: Array(days).fill(5.2),
      precipitation_probability_max: Array(days).fill(10),
      uv_index_max: Array(days).fill(8),
    },
  };
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('WeatherService.getWeatherData', () => {
  it('calls Open-Meteo API with provided coordinates', async () => {
    const apiData = makeMockApiResponse();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiData,
    });

    const result = await WeatherService.getWeatherData(20.0, 74.0);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('latitude=20');
    expect(url).toContain('longitude=74');

    expect(result.current).toBeDefined();
    expect(result.forecast).toHaveLength(7);
    expect(result.location.latitude).toBe(19.08);
  });

  it('uses default Nashik coordinates when no location provided', async () => {
    const apiData = makeMockApiResponse();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => apiData,
    });

    await WeatherService.getWeatherData();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('latitude=19.0825');
    expect(url).toContain('longitude=73.1963');
  });

  it('throws on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(WeatherService.getWeatherData()).rejects.toThrow('Failed to fetch weather data');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    await expect(WeatherService.getWeatherData()).rejects.toThrow('Failed to fetch weather data');
  });
});

describe('WeatherService.calculateETc', () => {
  it('calculates ETc with correct crop coefficient for Budbreak', () => {
    const weather = {
      forecast: [{ et0: 5.0 }],
    } as unknown as WeatherData;

    const result = WeatherService.calculateETc(weather, 'Budbreak');

    expect(result.cropCoefficient).toBe(0.3);
    expect(result.dailyETc).toBeCloseTo(1.5, 2);
    expect(result.weeklyETc).toBeCloseTo(10.5, 2);
    expect(result.referenceET).toBe(5.0);
    expect(result.growthStage).toBe('Budbreak');
  });

  it('uses default ET0 when forecast is empty', () => {
    const weather = {
      forecast: [],
    } as unknown as WeatherData;

    const result = WeatherService.calculateETc(weather, 'Flowering');

    // Default ET0 = 5, Flowering kc = 0.7
    expect(result.cropCoefficient).toBe(0.7);
    expect(result.dailyETc).toBeCloseTo(3.5, 2);
    expect(result.referenceET).toBe(5);
  });

  it('calculates ETc for Harvest stage', () => {
    const weather = {
      forecast: [{ et0: 6.0 }],
    } as unknown as WeatherData;

    const result = WeatherService.calculateETc(weather, 'Harvest');

    expect(result.cropCoefficient).toBe(0.6);
    expect(result.dailyETc).toBeCloseTo(3.6, 2);
  });
});

describe('WeatherService.getWeatherIcon', () => {
  it('returns sunny for condition code 1000', () => {
    expect(WeatherService.getWeatherIcon(1000)).toBe('sunny');
  });

  it('returns partly-sunny for condition code 1003', () => {
    expect(WeatherService.getWeatherIcon(1003)).toBe('partly-sunny');
  });

  it('returns cloudy for condition code 1006', () => {
    expect(WeatherService.getWeatherIcon(1006)).toBe('cloudy');
  });

  it('returns rainy for condition code 1153', () => {
    expect(WeatherService.getWeatherIcon(1153)).toBe('rainy');
  });

  it('returns cloudy as default for unknown codes', () => {
    expect(WeatherService.getWeatherIcon(9999)).toBe('cloudy');
  });
});
