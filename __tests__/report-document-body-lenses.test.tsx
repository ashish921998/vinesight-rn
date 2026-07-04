/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Lens rendering in the on-screen report document (issue #198): the per-plot
 * / per-acre / per-liter cards, the verbatim buckets, the compliance match
 * labels, the per-acre "unavailable" message, and the gating on the stock
 * section (financial reports never show lenses).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReportPreview } from '@/types/report';
import { computeUsageLenses } from '@/services/report-usage-lenses';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
    FadeIn: { duration: () => ({}) },
    ZoomIn: { duration: () => ({ delay: () => ({}) }) },
    Layout: { springify: () => ({ damping: () => ({}) }) },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useThemeColors: () => ({
    surface: { 50: '#fff', 100: '#fff', 200: '#eee' },
    success: '#0f0',
  }),
  useM3: () => ({
    colorScheme: {
      primary: '#0a5',
      secondary: '#00a',
      tertiary: '#a50',
      error: '#d00',
      onSurface: '#111',
      onSurfaceVariant: '#555',
      shadow: '#000',
    },
    surface: {
      s50: '#fff',
      s100: '#fff',
      s200: '#eee',
      s300: '#ddd',
      s400: '#ccc',
      s500: '#888',
      s600: '#666',
      s700: '#444',
      s800: '#222',
      s900: '#111',
    },
  }),
}));

jest.mock('@/i18n/format', () => ({
  formatCurrency: (value: number) => `INR ${value}`,
  formatDate: () => 'DATE',
  formatNumber: (value: number) => String(value),
}));

const { ReportDocumentBody } = require('@/components/screens/reports/report-document-body');

const USAGE = computeUsageLenses({
  events: [
    {
      type: 'spray',
      waterLiters: 400,
      items: [{ name: 'Fungicide', quantity: 30, unit: 'gm/L' }],
    },
    {
      type: 'fertilizer',
      waterLiters: null,
      items: [
        { name: 'Urea', quantity: 8.4, unit: 'kg', planItemId: 'pi-urea' },
        { name: 'Jeevamrut', quantity: 5, unit: 'tola' },
      ],
    },
  ],
  areaAcres: 2,
  planItems: [{ id: 'pi-urea', name: 'Urea', quantity: 5, unit: 'kg/acre' }],
});

function previewWith(usage: ReportPreview['data']['usage']): ReportPreview {
  return {
    summary: {
      totalRecords: 2,
      dateRange: '2026-01-01 to 2026-12-31',
      totalIrrigationHours: 0,
      totalWaterUsage: 0,
      totalHarvest: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      irrigationCount: 0,
      sprayCount: 1,
      fertigationCount: 1,
      harvestCount: 0,
      expenseCount: 0,
      stockUsageCount: 0,
    },
    data: {
      farmName: 'Farm A',
      farmArea: 2,
      farmRegion: 'Nashik',
      dateRange: { from: '2026-01-01', to: '2026-12-31' },
      irrigation: [],
      spray: [],
      fertigation: [],
      harvest: [],
      expense: [],
      stock: [],
      usage,
    },
  };
}

function renderBody(preview: ReportPreview, reportType: 'stock-usage' | 'financial') {
  return render(
    <ReportDocumentBody
      preview={preview}
      reportType={reportType}
      preferredCurrency="INR"
      areaUnit="acres"
      panelStyle={{}}
    />,
  );
}

describe('usage lens cards in the report document', () => {
  it('renders per-plot, Other bucket, per-acre, compliance and per-liter cards', () => {
    const { getByText } = renderBody(previewWith(USAGE), 'stock-usage');

    expect(getByText('reports.lenses.perPlotTitle')).toBeTruthy();
    expect(getByText('≈ 12 kg')).toBeTruthy(); // 30 g/L × 400 L, per plot

    expect(getByText('reports.lenses.otherTitle')).toBeTruthy();
    expect(getByText('5 tola')).toBeTruthy(); // verbatim, never converted

    expect(getByText('reports.lenses.perAcreTitle')).toBeTruthy();
    expect(getByText('≈ 6 kg/acre')).toBeTruthy(); // 12 kg ÷ 2 acres

    expect(getByText('reports.lenses.complianceTitle')).toBeTruthy();
    expect(getByText('reports.lenses.verified')).toBeTruthy();
    expect(getByText('reports.lenses.complianceNote')).toBeTruthy();

    expect(getByText('reports.lenses.perLiterTitle')).toBeTruthy();
    expect(getByText('≈ 30 g/L')).toBeTruthy();
    expect(getByText('reports.lenses.waterCoverage')).toBeTruthy();
  });

  it('shows the per-acre unavailable message instead of rows when the area is missing', () => {
    const usage = computeUsageLenses({
      events: [
        {
          type: 'fertilizer',
          waterLiters: null,
          items: [
            { name: 'Urea', quantity: 5, unit: 'kg/acre' },
            { name: 'DAP', quantity: 10, unit: 'kg' },
          ],
        },
      ],
      areaAcres: null,
    });
    const { getByText, queryByText } = renderBody(previewWith(usage), 'stock-usage');

    expect(getByText('reports.lenses.rateOnlyTitle')).toBeTruthy();
    expect(getByText('reports.lenses.perAcreUnavailable')).toBeTruthy();
    // Design review: the card keeps its titled header even when unavailable,
    // so the reader knows WHICH lens is unavailable — the message renders in
    // the block's empty-state slot instead of the rows.
    expect(getByText('reports.lenses.perAcreTitle')).toBeTruthy();
    expect(queryByText('reports.lenses.complianceTitle')).toBeNull();
  });

  it('never renders lens cards outside the stock section (financial report)', () => {
    const { queryByText } = renderBody(previewWith(USAGE), 'financial');
    expect(queryByText('reports.lenses.perPlotTitle')).toBeNull();
    expect(queryByText('reports.lenses.perLiterTitle')).toBeNull();
    expect(queryByText('reports.lenses.complianceTitle')).toBeNull();
  });

  it('renders no lens cards when usage is absent (hand-built preview data)', () => {
    const { queryByText } = renderBody(previewWith(undefined), 'stock-usage');
    expect(queryByText('reports.lenses.perPlotTitle')).toBeNull();
    expect(queryByText('reports.lenses.perAcreUnavailable')).toBeNull();
  });
});
