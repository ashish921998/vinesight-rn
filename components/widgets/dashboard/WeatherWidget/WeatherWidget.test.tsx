import React from 'react';
import { render } from '@widgets/shared/utils/testUtils';
import { WeatherWidget } from './WeatherWidget';
import type { WeatherWidgetProps } from './WeatherWidget';

const demoWeather: NonNullable<WeatherWidgetProps['currentWeather']> = {
  temperature: 28,
  conditionKey: 'widgets.weather.conditions.partlyCloudy',
  humidity: 65,
  wind: 12,
  icon: 'partly-sunny',
};

const demoForecast: NonNullable<WeatherWidgetProps['forecast']> = [
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

describe('WeatherWidget', () => {
  it('renders title and weather data', () => {
    const { getByText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByText('Vineyard Weather')).toBeTruthy();
    expect(getByText('Partly Cloudy')).toBeTruthy();
    expect(getByText('28°C')).toBeTruthy();
  });

  it('renders custom title when provided', () => {
    const { getByText } = render(
      <WeatherWidget title="Custom Weather" currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByText('Custom Weather')).toBeTruthy();
  });

  it('renders humidity and wind details', () => {
    const { getByLabelText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByLabelText(/Humidity 65 percent/)).toBeTruthy();
    expect(getByLabelText(/Wind 12 kilometers per hour/)).toBeTruthy();
  });

  it('renders 3-day forecast', () => {
    const { getByText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Tomorrow')).toBeTruthy();
    expect(getByText('Day After')).toBeTruthy();
  });

  it('renders forecast temperature ranges', () => {
    const { getByText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByText('28°/19°')).toBeTruthy();
    expect(getByText('30°/21°')).toBeTruthy();
    expect(getByText('26°/18°')).toBeTruthy();
  });

  it('renders custom current weather data', () => {
    const customWeather: NonNullable<WeatherWidgetProps['currentWeather']> = {
      temperature: 25,
      conditionKey: 'widgets.weather.conditions.sunny',
      humidity: 50,
      wind: 8,
      icon: 'sunny',
    };

    const { getByText } = render(<WeatherWidget currentWeather={customWeather} />);

    expect(getByText('25°C')).toBeTruthy();
    expect(getByText('Sunny')).toBeTruthy();
  });

  it('renders custom forecast data', () => {
    const customForecast: NonNullable<WeatherWidgetProps['forecast']> = [
      {
        labelKey: 'widgets.weather.days.today',
        high: 32,
        low: 24,
        icon: 'sunny',
        conditionKey: 'widgets.weather.conditions.sunny',
      },
      {
        labelKey: 'widgets.weather.days.tomorrow',
        high: 28,
        low: 22,
        icon: 'cloudy',
        conditionKey: 'widgets.weather.conditions.cloudy',
      },
      {
        labelKey: 'widgets.weather.days.dayAfter',
        high: 25,
        low: 20,
        icon: 'rainy',
        conditionKey: 'widgets.weather.conditions.rainy',
      },
    ];

    const { getByText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={customForecast} />,
    );

    expect(getByText('Today')).toBeTruthy();
    expect(getByText('32°/24°')).toBeTruthy();
    expect(getByText('Tomorrow')).toBeTruthy();
    expect(getByText('28°/22°')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <WeatherWidget
        testID="weather-widget"
        currentWeather={demoWeather}
        forecast={demoForecast}
      />,
    );

    expect(getByTestId('weather-widget')).toBeTruthy();
  });

  it('renders with accessibilityLabel', () => {
    const { getByLabelText } = render(
      <WeatherWidget
        accessibilityLabel="Vineyard weather information"
        currentWeather={demoWeather}
        forecast={demoForecast}
      />,
    );

    expect(getByLabelText('Vineyard weather information')).toBeTruthy();
  });

  it('renders forecast with accessibility labels', () => {
    const { getByLabelText } = render(
      <WeatherWidget currentWeather={demoWeather} forecast={demoForecast} />,
    );

    expect(getByLabelText('3 day forecast')).toBeTruthy();
    expect(getByLabelText(/Today: Sunny, high 28 degrees, low 19 degrees/)).toBeTruthy();
  });

  it('renders empty state when weather data is missing', () => {
    const { getByText } = render(<WeatherWidget currentWeather={null} />);

    expect(getByText('No data available')).toBeTruthy();
  });
});
