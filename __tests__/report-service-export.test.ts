import { ReportService } from '@/services/report-service';
import {
  getSectionsForReportType,
  type DateRange,
  type ReportData,
  type ReportSummary,
} from '@/types/report';
import type { Farm, IrrigationRecord } from '@/types/database';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn(),
}));

jest.mock(
  'expo-file-system/legacy',
  () => ({
    cacheDirectory: '/tmp/',
    writeAsStringAsync: jest.fn(),
  }),
  { virtual: true },
);

const DATE_RANGE: DateRange = {
  from: '2026-01-01',
  to: '2026-12-31',
};

const SAMPLE_DATA: ReportData = {
  farmName: 'Vine Farm',
  farmRegion: 'Nashik',
  farmArea: 12,
  dateRange: DATE_RANGE,
  seasonContext: {
    mode: 'season',
    seasonId: 22,
    seasonName: 'Season 2026 (Grapes)',
    seasonStart: '2026-01-01',
    seasonEnd: '2026-12-31',
    includeUnassigned: false,
  },
  irrigation: [
    {
      date: '2026-07-10',
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
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
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
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
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
      fertilizers: 'Calcium Nitrate (20 kg)',
      area: 1,
    },
  ],
  harvest: [
    {
      date: '2026-07-07',
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
      quantity: 100,
      grade: 'A',
      price: 50,
      buyer: 'Local Market',
    },
  ],
  expense: [
    {
      date: '2026-07-06',
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
      type: 'Labor',
      cost: 1500,
      remarks: 'Weekly',
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
};

const SAMPLE_SUMMARY: ReportSummary = {
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
};

describe('report section visibility contract', () => {
  it('returns operations sections in deterministic order', () => {
    expect(getSectionsForReportType('operations')).toEqual([
      'meta',
      'executive',
      'irrigation',
      'spray',
      'fertigation',
      'harvest',
    ]);
  });

  it('returns strict sections for financial and stock-usage', () => {
    expect(getSectionsForReportType('financial')).toEqual(['meta', 'executive', 'expense']);
    expect(getSectionsForReportType('stock-usage')).toEqual(['meta', 'executive', 'stock']);
  });
});

describe('report export parity', () => {
  it('includes report type metadata and excludes non-selected sections in CSV', () => {
    const csv = ReportService.generateCSV(SAMPLE_DATA, 'operations');

    expect(csv).toContain('Report Type: Operations');
    expect(csv).toContain('Season: Season 2026 (Grapes)');
    expect(csv).toContain('Season Window: 2026-01-01 to 2026-12-31');
    expect(csv).toContain('IRRIGATION RECORDS');
    expect(csv).toContain('FERTIGATION RECORDS');
    expect(csv).not.toContain('EXPENSE RECORDS');
    expect(csv).not.toContain('STOCK USAGE SUMMARY');
  });

  it('includes season_id and season_name columns in CSV rows', () => {
    const csv = ReportService.generateCSV(SAMPLE_DATA, 'comprehensive');

    expect(csv).toContain('Date,Season ID,Season Name,Duration (hrs)');
    expect(csv).toContain('2026-07-10,22,Season 2026 (Grapes),2');
  });

  it('includes fertigation records in operations PDF', () => {
    const html = ReportService.generatePDFHtml(SAMPLE_DATA, SAMPLE_SUMMARY, 'operations', 'INR');
    expect(html).toContain('Fertigation Records');
    expect(html).toContain('Calcium Nitrate');
  });

  it('renders valid closed expense table in financial PDF', () => {
    const html = ReportService.generatePDFHtml(SAMPLE_DATA, SAMPLE_SUMMARY, 'financial', 'INR');
    expect(html).toContain('Expense Records');
    expect(html).toContain('</table>');
    const openTables = (html.match(/<table>/g) ?? []).length;
    const closeTables = (html.match(/<\/table>/g) ?? []).length;
    expect(closeTables).toBe(openTables);
  });
});

describe('report data ordering', () => {
  const FARM: Farm = {
    id: 99,
    name: 'Order Farm',
    area: 2,
    region: 'Nashik',
    crop: 'Grape',
    crop_variety: 'Thompson',
    planting_date: '2020-01-01',
  };

  const olderIrrigation: IrrigationRecord = {
    id: 1,
    farm_id: 99,
    date: '2026-01-10',
    duration: 1,
    area: 1,
    growth_stage: 'Flowering',
    moisture_status: 'Normal',
    system_discharge: 200,
  };

  const newerIrrigation: IrrigationRecord = {
    ...olderIrrigation,
    id: 2,
    date: '2026-02-10',
  };

  it('sorts section records newest-first during report data generation', () => {
    const report = ReportService.generateReportData(
      FARM,
      [olderIrrigation, newerIrrigation],
      [],
      [],
      [],
      [],
      DATE_RANGE,
      [],
    );

    expect(report.irrigation.map((r) => r.date)).toEqual(['2026-02-10', '2026-01-10']);
  });
});
