/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Lens rendering in the on-screen report document (issue #198): the per-plot
 * / per-acre / per-liter cards, the verbatim buckets, the compliance match
 * labels, the per-acre "unavailable" message, and the gating on the presence
 * of usage data (not on the stock section — see the note below).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReportPreview, ReportType } from '@/types/report';
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
  useIsDark: () => false,
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

const FPC_DAY = {
  date: '10 Jul 2026',
  isoDate: '2026-07-10',
  daysAfterPruning: 9,
  irrigationHours: 2,
  waterMm: 4,
  growthStage: 'Berry set',
  notes: null,
  products: [
    {
      key: 'p1',
      source: 'spray' as const,
      marketName: 'Fungicide X',
      technicalName: 'Mancozeb',
      qtyPerAcreDisplay: '1 kg',
      totalQtyDisplay: '2 kg',
      asLogged: '1 kg/acre',
      phiDays: 7,
      safeHarvestDate: null,
      mrl: 'EU: 0.5 mg/kg',
    },
  ],
};

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

function renderBody(preview: ReportPreview, reportType: ReportType = 'comprehensive') {
  return render(
    <ReportDocumentBody
      preview={preview}
      reportType={reportType}
      preferredCurrency="INR"
      panelStyle={{}}
    />,
  );
}

describe('usage lens cards in the report document', () => {
  it('renders per-plot, Other bucket, per-acre, compliance and per-liter cards', () => {
    const { getByText } = renderBody(previewWith(USAGE));

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
    const { getByText, queryByText } = renderBody(previewWith(usage));

    expect(getByText('reports.lenses.rateOnlyTitle')).toBeTruthy();
    expect(getByText('reports.lenses.perAcreUnavailable')).toBeTruthy();
    // Design review: the card keeps its titled header even when unavailable,
    // so the reader knows WHICH lens is unavailable — the message renders in
    // the block's empty-state slot instead of the rows.
    expect(getByText('reports.lenses.perAcreTitle')).toBeTruthy();
    expect(queryByText('reports.lenses.complianceTitle')).toBeNull();
  });

  // Replaces an earlier case asserting lenses render ONLY inside the stock
  // section. That gate was semantically wrong: these lenses are derived from
  // spray/fertigation APPLICATION logs, not warehouse stock movement, so gating
  // them on the stock section hid them from exactly the reports whose data
  // produced them. They are now gated on the presence of usage data.
  it('renders lens cards whenever usage data exists, independent of report type', () => {
    const { getByText } = renderBody(previewWith(USAGE));
    expect(getByText('reports.lenses.perPlotTitle')).toBeTruthy();
    expect(getByText('reports.lenses.perLiterTitle')).toBeTruthy();
    expect(getByText('reports.lenses.complianceTitle')).toBeTruthy();
  });

  it('renders no lens cards when usage is absent (hand-built preview data)', () => {
    const { queryByText } = renderBody(previewWith(undefined));
    expect(queryByText('reports.lenses.perPlotTitle')).toBeNull();
    expect(queryByText('reports.lenses.perAcreUnavailable')).toBeNull();
  });
});

describe("buyer's register separation", () => {
  function previewWithRegister(days: unknown[]): ReportPreview {
    const preview = previewWith(undefined);
    return {
      ...preview,
      data: { ...preview.data, fpcActivity: days as never },
    };
  }

  it('does not embed exporter data or controls in the farmer report', () => {
    const { queryByText } = renderBody(previewWithRegister([FPC_DAY]), 'comprehensive');

    expect(queryByText('reports.fpc.sectionTitle')).toBeNull();
    expect(queryByText('reports.fpc.detail.title')).toBeNull();
    expect(queryByText('reports.fpc.detail.simple.title')).toBeNull();
    expect(queryByText('reports.fpc.shareRegister')).toBeNull();
    expect(queryByText('Fungicide X (2 kg)')).toBeNull();
  });
});
