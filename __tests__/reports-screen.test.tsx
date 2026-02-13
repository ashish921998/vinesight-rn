/* eslint-disable @typescript-eslint/no-require-imports */
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
      onSurface: '#111',
      onSurfaceVariant: '#555',
      shadow: '#000',
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
        areaUnit="acres"
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
        areaUnit="acres"
        panelStyle={{}}
      />,
    );

    expect(getByText('reports.export.sections.expenseRecords')).toBeTruthy();
    expect(queryByText('reports.export.sections.irrigationRecords')).toBeNull();
    expect(queryByText('reports.stockDetails.title')).toBeNull();
  });

  it('stock-usage type shows stock section and stock-oriented summary without net-profit tile', () => {
    const { getByText, queryByText } = render(
      <>
        <ReportExecutiveSummary
          preview={PREVIEW}
          reportType="stock-usage"
          reportTypeLabel="Stock Usage"
          preferredCurrency="INR"
        />
        <ReportDocumentBody
          preview={PREVIEW}
          reportType="stock-usage"
          preferredCurrency="INR"
          areaUnit="acres"
          panelStyle={{}}
        />
      </>,
    );

    expect(getByText('reports.stockDetails.title')).toBeTruthy();
    expect(getByText('reports.summary.stockUsageCount')).toBeTruthy();
    expect(queryByText('reports.summary.netProfit')).toBeNull();
  });

  it('renders section-level empty cards for expected sections', () => {
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

    const { getAllByText } = render(
      <ReportDocumentBody
        preview={emptyOperationsPreview}
        reportType="operations"
        preferredCurrency="INR"
        areaUnit="acres"
        panelStyle={{}}
      />,
    );

    expect(getAllByText('reports.formal.emptySection').length).toBeGreaterThan(0);
  });
});
