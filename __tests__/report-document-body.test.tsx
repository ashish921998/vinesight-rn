/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * `ReportDocumentBody` + `ReportExecutiveSummary` rendering. Renamed from
 * reports-screen.test.tsx: it never rendered the screen, so its green status was
 * being read as coverage of app/reports.tsx that does not exist.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReportPreview } from '@/types/report';

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
  useIsDark: () => false,
  useThemeColors: () => ({
    surface: {
      50: '#fff',
      100: '#fff',
      200: '#eee',
    },
    success: '#0f0',
  }),
  useM3: () => ({
    colorScheme: {
      primary: '#0a5',
      secondary: '#00a',
      tertiary: '#a50',
      error: '#d00',
      success: '#0a0',
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
const { ReportExecutiveSummary } = require('@/components/screens/reports/report-executive-summary');

const PREVIEW: ReportPreview = {
  summary: {
    totalRecords: 5,
    dateRange: '2026-01-01 to 2026-12-31',
    totalIrrigationHours: 2,
    totalWaterUsage: 800,
    totalHarvest: 100,
    totalRevenue: 5000,
    totalExpenses: 1500,
    netProfit: 3500,
    irrigationCount: 1,
    sprayCount: 1,
    fertigationCount: 1,
    harvestCount: 1,
    expenseCount: 1,
    stockUsageCount: 1,
  },
  data: {
    farmName: 'Farm A',
    farmArea: 10,
    farmRegion: 'Nashik',
    dateRange: {
      from: '2026-01-01',
      to: '2026-12-31',
    },
    irrigation: [
      {
        date: '2026-07-10',
        duration: 2,
        area: 1,
        growthStage: 'Flowering',
        moistureStatus: 'Normal',
        systemDischarge: 400,
      },
    ],
    spray: [
      {
        date: '2026-07-09',
        chemical: 'M45',
        dose: '10 kg',
        area: 1,
        weather: 'Sunny',
        operator: 'Ravi',
      },
    ],
    fertigation: [
      {
        date: '2026-07-08',
        fertilizers: 'Calcium Nitrate (20 kg)',
        area: 1,
      },
    ],
    harvest: [
      {
        date: '2026-07-07',
        quantity: 100,
        grade: 'A',
        price: 50,
        buyer: 'Market',
      },
    ],
    expense: [
      {
        date: '2026-07-06',
        type: 'Labor',
        cost: 1200,
      },
    ],
    stock: [
      {
        itemName: 'M45',
        type: 'spray',
        quantityUsed: 10,
        unit: 'kg',
        areaTreated: 1,
        usageCount: 1,
        warehouseItemId: 1,
        currentStockQuantity: 40,
        estimatedOpeningStockQuantity: 50,
        estimatedConsumedPercent: 20,
        matchStrategy: 'warehouse_item_id',
      },
    ],
  },
};

describe('reports formal rendering', () => {
  it('operations type shows operations sections and hides financial/stock sections', () => {
    const { getByText, queryByText } = render(
      <ReportDocumentBody
        preview={PREVIEW}
        reportType="operations"
        preferredCurrency="INR"
        panelStyle={{}}
      />,
    );

    expect(getByText('reports.export.sections.irrigationRecords')).toBeTruthy();
    expect(queryByText('reports.export.sections.expenseRecords')).toBeNull();
    expect(queryByText('reports.stockDetails.title')).toBeNull();
  });

  it('financial type shows expense section only', () => {
    const { getByText, queryByText } = render(
      <ReportDocumentBody
        preview={PREVIEW}
        reportType="financial"
        preferredCurrency="INR"
        panelStyle={{}}
      />,
    );

    expect(getByText('reports.export.sections.expenseRecords')).toBeTruthy();
    expect(queryByText('reports.export.sections.irrigationRecords')).toBeNull();
    expect(queryByText('reports.stockDetails.title')).toBeNull();
  });

  it('stock-usage type shows the stock section', () => {
    const { getByText } = render(
      <ReportDocumentBody
        preview={PREVIEW}
        reportType="stock-usage"
        preferredCurrency="INR"
        panelStyle={{}}
      />,
    );

    expect(getByText(/reports\.stockDetails\.title/)).toBeTruthy();
  });

  it('overview keeps only farmer outcome metrics', () => {
    const { getByText, queryByText } = render(
      <ReportExecutiveSummary preview={PREVIEW} preferredCurrency="INR" />,
    );

    expect(getByText('reports.summary.totalHarvest')).toBeTruthy();
    expect(getByText('reports.formal.revenue')).toBeTruthy();
    expect(getByText('reports.formal.expenses')).toBeTruthy();
    expect(getByText('reports.summary.netProfit')).toBeTruthy();
    expect(getByText('reports.summary.loggedRecordsNote')).toBeTruthy();
    expect(queryByText('reports.summary.waterUsage')).toBeNull();
    expect(queryByText('reports.summary.stockUsageCount')).toBeNull();
    expect(queryByText('reports.summary.totalRecords')).toBeNull();
  });

  const ZEROED_METRICS = {
    totalWaterUsage: 0,
    totalHarvest: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    stockUsageCount: 0,
  };

  it('summary states that nothing was logged only when there are no records at all', () => {
    const emptyPreview: ReportPreview = {
      ...PREVIEW,
      summary: { ...PREVIEW.summary, ...ZEROED_METRICS, totalRecords: 0 },
    };

    const { getByText, queryByText } = render(
      <ReportExecutiveSummary preview={emptyPreview} preferredCurrency="INR" />,
    );

    expect(getByText('reports.summary.nothingLogged')).toBeTruthy();
    expect(queryByText('reports.summary.waterUsage')).toBeNull();
    expect(queryByText('reports.summary.netProfit')).toBeNull();
  });

  // Regression: irrigation logged without a water volume yields records but no
  // headline figure. Saying "nothing logged" directly above "Irrigation
  // Records (2)" contradicts the section below it.
  it('summary renders nothing when records exist but carry no headline figures', () => {
    const noMetricsPreview: ReportPreview = {
      ...PREVIEW,
      summary: { ...PREVIEW.summary, ...ZEROED_METRICS, totalRecords: 2 },
    };

    const { queryByText } = render(
      <ReportExecutiveSummary preview={noMetricsPreview} preferredCurrency="INR" />,
    );

    expect(queryByText('reports.summary.nothingLogged')).toBeNull();
    expect(queryByText('reports.formal.executiveTitle')).toBeNull();
  });

  // Replaces an earlier case asserting one empty CARD per empty section. Six
  // identical "No records in selected range" panels is a wall to scroll past,
  // not information — the empty sections are now named once in a single line.
  it('names empty sections in one line instead of rendering a card each', () => {
    const emptyOperationsPreview: ReportPreview = {
      ...PREVIEW,
      data: {
        ...PREVIEW.data,
        irrigation: [],
        spray: [],
        fertigation: [],
        harvest: [],
      },
    };

    const { getByText, queryAllByText } = render(
      <ReportDocumentBody
        preview={emptyOperationsPreview}
        reportType="operations"
        preferredCurrency="INR"
        panelStyle={{}}
      />,
    );

    expect(getByText('reports.formal.noneLogged')).toBeTruthy();
    expect(queryAllByText('reports.formal.emptySection')).toHaveLength(0);
  });

  it('renders a section per dated type that has records, and omits the rest', () => {
    const onlyIrrigation: ReportPreview = {
      ...PREVIEW,
      data: { ...PREVIEW.data, spray: [], fertigation: [], harvest: [], expense: [] },
    };

    const { getByText, queryByText } = render(
      <ReportDocumentBody
        preview={onlyIrrigation}
        reportType="comprehensive"
        preferredCurrency="INR"
        panelStyle={{}}
      />,
    );

    expect(getByText('reports.export.sections.irrigationRecords')).toBeTruthy();
    expect(queryByText('reports.export.sections.sprayRecords')).toBeNull();
    expect(queryByText('reports.export.sections.expenseRecords')).toBeNull();
    // The log type titles each row, not a bare duration.
    expect(getByText('logs.types.irrigation')).toBeTruthy();
  });
});
