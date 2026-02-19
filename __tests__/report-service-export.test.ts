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
    documentDirectory: '/tmp/',
    writeAsStringAsync: jest.fn(),
    copyAsync: jest.fn(),
    getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: true }),
    makeDirectoryAsync: jest.fn(),
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
      daysAfterPruning: 9,
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
      daysAfterPruning: 8,
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
      daysAfterPruning: 7,
      seasonId: 22,
      seasonName: 'Season 2026 (Grapes)',
      fertilizers: 'Calcium Nitrate (20 kg)',
      area: 1,
    },
  ],
  harvest: [
    {
      date: '2026-07-07',
      daysAfterPruning: 6,
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
      daysAfterPruning: 5,
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
    expect(csv).toContain('Season Window: 01-01-2026 to 31-12-2026');
    expect(csv).toContain('IRRIGATION RECORDS');
    expect(csv).toContain('FERTIGATION RECORDS');
    expect(csv).not.toContain('EXPENSE RECORDS');
    expect(csv).not.toContain('STOCK USAGE SUMMARY');
  });

  it('uses a single season column in CSV rows', () => {
    const csv = ReportService.generateCSV(SAMPLE_DATA, 'comprehensive');

    expect(csv).toContain('Date,Days After Pruning,Season,Duration (hrs)');
    expect(csv).toContain('2026-07-10,9,Season 2026 (Grapes),2');
  });

  it('includes fertigation records in operations PDF', () => {
    const html = ReportService.generatePDFHtml(SAMPLE_DATA, SAMPLE_SUMMARY, 'operations', 'INR');
    expect(html).toContain('Fertigation Records');
    expect(html).toContain('Calcium Nitrate');
    expect(html).toContain('<th>DAP</th>');
    expect(html).toContain('<td>7d</td>');
  });

  it('renders valid closed expense table in financial PDF', () => {
    const html = ReportService.generatePDFHtml(SAMPLE_DATA, SAMPLE_SUMMARY, 'financial', 'INR');
    expect(html).toContain('Expense Records');
    expect(html).toContain('</table>');
    const openTables = (html.match(/<table>/g) ?? []).length;
    const closeTables = (html.match(/<\/table>/g) ?? []).length;
    expect(closeTables).toBe(openTables);
  });

  it('renders "-" when DAP is unavailable in CSV and PDF', () => {
    const dataWithoutDap: ReportData = {
      ...SAMPLE_DATA,
      expense: [
        {
          ...SAMPLE_DATA.expense[0],
          daysAfterPruning: null,
        },
      ],
    };

    const csv = ReportService.generateCSV(dataWithoutDap, 'financial');
    expect(csv).toContain('Date,Days After Pruning,Season,Type,Cost,Remarks');
    expect(csv).toContain('2026-07-06,-,Season 2026 (Grapes),Labor,1500,Weekly');

    const html = ReportService.generatePDFHtml(dataWithoutDap, SAMPLE_SUMMARY, 'financial', 'INR');
    expect(html).toContain('<th>DAP</th>');
    expect(html).toContain('<td>-</td>');
  });

  it('shows season window in season column for all-season reports', () => {
    const allSeasonData: ReportData = {
      ...SAMPLE_DATA,
      seasonContext: {
        mode: 'all',
      },
      spray: [
        {
          ...SAMPLE_DATA.spray[0],
          seasonWindow: '2026-01-01 to 2026-12-31',
        },
      ],
    };

    const csv = ReportService.generateCSV(allSeasonData, 'operations');
    expect(csv).toContain('Date,Days After Pruning,Season,Chemical,Dose,Operator,Notes');
    expect(csv).toContain('2026-07-09,8,2026-01-01 to 2026-12-31,M45,10 kg,Ravi,');
  });

  it('shows matched stock rows in stock summary and moves unmatched rows to unmatched section', () => {
    const stockFocusedData: ReportData = {
      ...SAMPLE_DATA,
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
        {
          itemName: 'Unknown Mix',
          type: 'spray',
          quantityUsed: 3,
          unit: 'unit',
          areaTreated: 1,
          usageCount: 1,
          warehouseItemId: null,
          currentStockQuantity: null,
          estimatedOpeningStockQuantity: null,
          estimatedConsumedPercent: null,
          matchStrategy: 'unmatched',
        },
      ],
    };

    const csv = ReportService.generateCSV(stockFocusedData, 'stock-usage');
    expect(csv).toContain('STOCK USAGE SUMMARY (Matched 1 of 2)');
    expect(csv).toContain('M45,spray,10,kg,1,1,40,50,20,warehouse_item_id');
    expect(csv).toContain('UNMATCHED LOG ITEMS (1)');
    expect(csv).toContain(
      'Unknown Mix,spray,3,unit,1,1,No warehouse match or missing water volume',
    );

    const html = ReportService.generatePDFHtml(
      stockFocusedData,
      SAMPLE_SUMMARY,
      'stock-usage',
      'INR',
    );
    expect(html).toContain('Stock Usage Summary (Matched 1 of 2)');
    expect(html).toContain('Unmatched Log Items (1)');
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
    date_of_pruning: '2026-01-01',
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

    expect(report.irrigation.map((r) => r.date)).toEqual(['10-02-2026', '10-01-2026']);
  });

  it('prefers record pruning snapshot when computing daysAfterPruning', () => {
    const report = ReportService.generateReportData(
      FARM,
      [
        {
          ...newerIrrigation,
          date: '2026-02-10',
          date_of_pruning: '2026-02-01',
        },
      ],
      [],
      [],
      [],
      [],
      DATE_RANGE,
      [],
    );

    expect(report.irrigation[0]?.daysAfterPruning).toBe(9);
  });

  it('falls back to farm pruning date when record snapshot is missing', () => {
    const report = ReportService.generateReportData(
      FARM,
      [{ ...newerIrrigation, date: '2026-01-15', date_of_pruning: null }],
      [],
      [],
      [],
      [],
      DATE_RANGE,
      [],
    );

    expect(report.irrigation[0]?.daysAfterPruning).toBe(14);
  });

  it('returns null daysAfterPruning when record date is before pruning date', () => {
    const report = ReportService.generateReportData(
      FARM,
      [{ ...newerIrrigation, date: '2026-01-10', date_of_pruning: '2026-01-20' }],
      [],
      [],
      [],
      [],
      DATE_RANGE,
      [],
    );

    expect(report.irrigation[0]?.daysAfterPruning).toBeNull();
  });

  it('derives spray chemical and dosage from chemical_items when available', () => {
    const report = ReportService.generateReportData(
      FARM,
      [],
      [
        {
          farm_id: FARM.id!,
          date: '2026-02-10',
          chemical: 'Legacy Chemical Text',
          chemical_items: [
            {
              name: 'M45',
              quantity: 2,
              unit: 'kg',
              quantity_basis: 'total',
            },
            {
              name: 'Sticker',
              quantity: 500,
              unit: 'ml',
              quantity_basis: 'per_acre',
            },
          ],
          dose: 'Water: 200L',
          area: 1,
          weather: 'Sunny',
          operator: 'Ravi',
        },
      ],
      [],
      [],
      [],
      DATE_RANGE,
      [],
    );

    expect(report.spray[0]?.chemical).toBe('M45, Sticker');
    expect(report.spray[0]?.dose).toBe('2 kg, 500 ml/acre; Water: 200L');
  });
});
