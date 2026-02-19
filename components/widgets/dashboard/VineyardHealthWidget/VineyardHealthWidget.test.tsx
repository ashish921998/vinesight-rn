import React from 'react';
import { render } from '@widgets/shared/utils/testUtils';
import { VineyardHealthWidget } from './VineyardHealthWidget';
import type { HealthMetric } from './VineyardHealthWidget';

describe('VineyardHealthWidget', () => {
  it('renders with default title and metrics', () => {
    const { getByTestId } = render(<VineyardHealthWidget />);

    expect(getByTestId('vineyard-health-widget-title')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-overall-status')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-water')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-disease')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-growth')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-soil')).toBeTruthy();
  });

  it('renders with custom title', () => {
    const { getByTestId } = render(<VineyardHealthWidget title="My Vineyard" />);

    expect(getByTestId('vineyard-health-widget-title')).toHaveTextContent('My Vineyard');
  });

  it('renders custom metrics', () => {
    const customMetrics: HealthMetric[] = [
      {
        id: 'test1',
        icon: 'sunny' as const,
        labelKey: 'widgets.vineyardHealth.metrics.waterStatus',
        value: 'High',
        status: 'optimal' as const,
      },
      {
        id: 'test2',
        icon: 'cloud' as const,
        labelKey: 'widgets.vineyardHealth.metrics.diseaseRisk',
        value: 'Low',
        status: 'critical' as const,
      },
    ];

    const { getByTestId } = render(<VineyardHealthWidget metrics={customMetrics} />);

    expect(getByTestId('vineyard-health-widget-metric-test1')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-test1-value')).toHaveTextContent('High');
    expect(getByTestId('vineyard-health-widget-metric-test2')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-test2-value')).toHaveTextContent('Low');
  });

  it('renders with custom overall status', () => {
    const { getByTestId } = render(
      <VineyardHealthWidget
        overallStatus={{ status: 'critical', labelKey: 'widgets.vineyardHealth.overallStatus' }}
      />,
    );

    expect(getByTestId('vineyard-health-widget-overall-status')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<VineyardHealthWidget testID="vineyard-health-widget" />);

    expect(getByTestId('vineyard-health-widget')).toBeTruthy();
  });

  it('renders with accessibilityLabel', () => {
    const { getByLabelText } = render(
      <VineyardHealthWidget accessibilityLabel="My Vineyard Health Widget" />,
    );

    expect(getByLabelText('My Vineyard Health Widget')).toBeTruthy();
  });

  it('renders title with accessibilityRole header', () => {
    const { getByRole } = render(<VineyardHealthWidget />);

    expect(getByRole('header')).toBeTruthy();
  });

  it('renders overall status badge with accessibilityLabel', () => {
    const { getByLabelText } = render(
      <VineyardHealthWidget
        overallStatus={{ status: 'optimal', labelKey: 'widgets.vineyardHealth.overallStatus' }}
      />,
    );

    expect(getByLabelText(/Overall status:/)).toBeTruthy();
  });

  it('renders all 4 default metrics', () => {
    const { getAllByLabelText } = render(<VineyardHealthWidget />);

    const metricLabels = getAllByLabelText(/:/);
    expect(metricLabels.length).toBeGreaterThanOrEqual(4);
  });

  it('renders different status types in metrics', () => {
    const mixedMetrics: HealthMetric[] = [
      {
        id: 'optimal',
        icon: 'checkmark-circle' as const,
        labelKey: 'widgets.vineyardHealth.metrics.waterStatus',
        value: '100%',
        status: 'optimal' as const,
      },
      {
        id: 'critical',
        icon: 'alert-circle' as const,
        labelKey: 'widgets.vineyardHealth.metrics.diseaseRisk',
        value: '0%',
        status: 'critical' as const,
      },
      {
        id: 'due',
        icon: 'time' as const,
        labelKey: 'widgets.vineyardHealth.metrics.growthStage',
        value: 'Pending',
        status: 'due' as const,
      },
      {
        id: 'delayed',
        icon: 'pause-circle' as const,
        labelKey: 'widgets.vineyardHealth.metrics.soilMoisture',
        value: 'Overdue',
        status: 'delayed' as const,
      },
      {
        id: 'info',
        icon: 'information-circle' as const,
        labelKey: 'widgets.vineyardHealth.metrics.waterStatus',
        value: 'Details',
        status: 'info' as const,
      },
    ];

    const { getByTestId } = render(<VineyardHealthWidget metrics={mixedMetrics} />);

    expect(getByTestId('vineyard-health-widget-metric-optimal')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-critical')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-due')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-delayed')).toBeTruthy();
    expect(getByTestId('vineyard-health-widget-metric-info')).toBeTruthy();
  });
});
