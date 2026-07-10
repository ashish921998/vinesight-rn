/**
 * FPC Activity Register (Fratelli format) — buildFpcActivity via
 * generateReportData, plus its CSV/PDF rendering.
 */

import { ReportService, type FpcReportLookups } from '@/services/report-service';
import { FPC_FULL_COLUMNS, FPC_LEAN_COLUMNS, type DateRange } from '@/types/report';
import type { Farm, FertigationRecord, IrrigationRecord, SprayRecord } from '@/types/database';

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
  from: '2026-06-01',
  to: '2026-06-30',
};

const FARM: Farm = {
  id: 1,
  name: 'Fratelli Plot',
  area: 3,
  region: 'Nashik',
  crop: 'Grape',
  crop_variety: 'Thompson',
  planting_date: '2020-01-01',
  date_of_pruning: '2026-05-06',
};

function createIrrigationRecord(overrides: Partial<IrrigationRecord> = {}): IrrigationRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-06-16',
    duration: 5,
    area: 3,
    growth_stage: '40cm shoot',
    moisture_status: 'ok',
    system_discharge: 6,
    ...overrides,
  };
}

function createSprayRecord(overrides: Partial<SprayRecord> = {}): SprayRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-06-16',
    chemical: '',
    dose: 'Water: 200L',
    area: 3,
    weather: '',
    operator: '',
    ...overrides,
  };
}

function createFertigationRecord(overrides: Partial<FertigationRecord> = {}): FertigationRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-06-16',
    fertilizers: [],
    area: 3,
    ...overrides,
  };
}

function generate(records: {
  irrigations?: IrrigationRecord[];
  sprays?: SprayRecord[];
  fertigations?: FertigationRecord[];
  fpcLookups?: FpcReportLookups;
}) {
  return ReportService.generateReportData(
    FARM,
    records.irrigations ?? [],
    records.sprays ?? [],
    records.fertigations ?? [],
    [],
    [],
    DATE_RANGE,
    [],
    { fpcLookups: records.fpcLookups },
  );
}

describe('buildFpcActivity (via generateReportData)', () => {
  it('groups records by date ascending, with day-level irrigation figures', () => {
    const data = generate({
      irrigations: [
        createIrrigationRecord({ date: '2026-06-16' }),
        createIrrigationRecord({ id: 2, date: '2026-06-15', duration: 4 }),
      ],
      sprays: [
        createSprayRecord({
          date: '2026-06-15',
          chemical_items: [{ name: 'Proclaim', quantity: 60, unit: 'gm', quantity_basis: 'total' }],
        }),
      ],
    });

    const days = data.fpcActivity!;
    expect(days.map((d) => d.isoDate)).toEqual(['2026-06-15', '2026-06-16']);

    const day15 = days[0];
    // Day counter from pruning: 2026-05-06 → 2026-06-15 = 40 days.
    expect(day15.daysAfterPruning).toBe(40);
    expect(day15.irrigationHours).toBe(4);
    // mm = duration × discharge (mm/hr): 4 × 6 = 24.
    expect(day15.waterMm).toBe(24);
    expect(day15.growthStage).toBe('40cm shoot');
    expect(day15.products).toHaveLength(1);

    const day16 = days[1];
    expect(day16.irrigationHours).toBe(5);
    expect(day16.waterMm).toBe(30);
    expect(day16.products).toHaveLength(0);
  });

  it('computes per-acre and per-plot totals in both directions', () => {
    const data = generate({
      fertigations: [
        createFertigationRecord({
          fertilizers: [
            // Rate → total: 3 kg/acre on 3 acres = 9 kg total.
            { name: '0-52-34', quantity: 3, unit: 'kg', quantity_basis: 'per_acre' },
            // Total → rate: 12 kg on 3 acres = 4 kg/acre.
            { name: '12-61-00', quantity: 12, unit: 'kg', quantity_basis: 'total' },
          ],
        }),
      ],
    });

    const [day] = data.fpcActivity!;
    const [mkp, map] = day.products;

    expect(mkp.marketName).toBe('0-52-34');
    expect(mkp.qtyPerAcreDisplay).toBe('3 kg');
    expect(mkp.totalQtyDisplay).toBe('9 kg');
    expect(mkp.asLogged).toBe('3 kg/acre');

    expect(map.qtyPerAcreDisplay).toBe('4 kg');
    expect(map.totalQtyDisplay).toBe('12 kg');
  });

  it('leaves quantities null (asLogged preserved) when the unit is unresolvable', () => {
    const data = generate({
      fertigations: [
        createFertigationRecord({
          fertilizers: [
            { name: 'Seaweed', quantity: 1.1, unit: 'bottles', quantity_basis: 'total' },
          ],
        }),
      ],
    });

    const [product] = data.fpcActivity![0].products;
    expect(product.qtyPerAcreDisplay).toBeNull();
    expect(product.totalQtyDisplay).toBeNull();
    expect(product.asLogged).toBe('1.1 bottles');
  });

  it('resolves technical name, claim PHI and MRL through catalog lookups', () => {
    const data = generate({
      sprays: [
        createSprayRecord({
          chemical_items: [
            {
              name: 'Proclaim',
              quantity: 60,
              unit: 'gm',
              quantity_basis: 'total',
              catalog_product_id: 7,
            },
          ],
        }),
      ],
      fpcLookups: {
        technicalNameByProductId: { 7: 'Emamectin benzoate 5% SG' },
        phiDaysByProductId: { 7: 7 },
        mrlByProductId: { 7: 'EU: 0.05 mg/kg' },
      },
    });

    const [product] = data.fpcActivity![0].products;
    expect(product.technicalName).toBe('Emamectin benzoate 5% SG');
    expect(product.phiDays).toBe(7);
    expect(product.mrl).toBe('EU: 0.05 mg/kg');
  });

  it('falls back to the governing PHI only when attributable to the item', () => {
    const singleItem = generate({
      sprays: [
        createSprayRecord({
          governing_phi_days: 10,
          safe_harvest_date: '2026-06-26',
          chemical_items: [{ name: 'Ranman', quantity: 60, unit: 'ml', quantity_basis: 'total' }],
        }),
      ],
    });
    expect(singleItem.fpcActivity![0].products[0].phiDays).toBe(10);
    // Exact date (not just truthy) so a formatting/null regression is caught.
    expect(singleItem.fpcActivity![0].products[0].safeHarvestDate).toBe('26-06-2026');

    const mix = generate({
      sprays: [
        createSprayRecord({
          governing_phi_days: 10,
          phi_blocking_component: 'Ranman',
          safe_harvest_date: '2026-06-26',
          chemical_items: [
            { name: 'Ranman', quantity: 60, unit: 'ml', quantity_basis: 'total' },
            { name: 'Proclaim', quantity: 60, unit: 'gm', quantity_basis: 'total' },
          ],
        }),
      ],
    });
    const [ranman, proclaim] = mix.fpcActivity![0].products;
    expect(ranman.phiDays).toBe(10);
    expect(ranman.safeHarvestDate).toBe('26-06-2026');
    // Co-mixed, non-blocking, no claim data: PHI must not be overstated — and
    // the record-level Safe Harvest must NOT ride along on this row either.
    expect(proclaim.phiDays).toBeNull();
    expect(proclaim.safeHarvestDate).toBeNull();
  });

  it('merges unique notes from all records on the date', () => {
    const data = generate({
      irrigations: [createIrrigationRecord({ notes: 'morning cycle' })],
      sprays: [
        createSprayRecord({
          notes: 'evening spray',
          chemical_items: [{ name: 'Proclaim', quantity: 60, unit: 'gm', quantity_basis: 'total' }],
        }),
      ],
    });
    expect(data.fpcActivity![0].notes).toBe('morning cycle; evening spray');
  });
});

describe('FPC register rendering', () => {
  const data = generate({
    irrigations: [createIrrigationRecord()],
    fertigations: [
      createFertigationRecord({
        fertilizers: [
          { name: '0-52-34', quantity: 3, unit: 'kg', quantity_basis: 'per_acre' },
          { name: '12-61-00', quantity: 4, unit: 'kg', quantity_basis: 'per_acre' },
        ],
      }),
    ],
  });

  it('CSV (full preset): writes day cells once and one row per product, uncapped', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity', 'acres', FPC_FULL_COLUMNS);
    expect(csv).toContain('FPC ACTIVITY REGISTER (1 days, 2 product applications)');
    const lines = csv.split('\n');
    const headerIndex = lines.findIndex((line) => line.startsWith('Date,Day,Irrigation'));
    expect(headerIndex).toBeGreaterThan(-1);
    const first = lines[headerIndex + 1];
    const second = lines[headerIndex + 2];
    expect(first).toContain('0-52-34');
    expect(first).toContain('5'); // irrigation hours
    expect(first).toContain('30'); // mm
    // Full preset day cells: Date,Day,Irrigation,Water,Stage → 5 blanks on row 2.
    expect(second.startsWith(',,,,,')).toBe(true); // day cells written once
    expect(second).toContain('12-61-00');
    // FPC report shows only the register section.
    expect(csv).not.toContain('IRRIGATION RECORDS');
    expect(csv).not.toContain('STOCK USAGE SUMMARY');
  });

  it('CSV (lean default): drops irrigation, technical name, PHI, safe harvest and MRL', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity');
    const header = csv.split('\n').find((line) => line.startsWith('Date,Day,')) ?? '';
    expect(header).toBe('Date,Day,Stage,Market Name,Qty/Acre,Total Qty/Plot,As Logged,Details');
    expect(header).not.toContain('Irrigation');
    expect(header).not.toContain('Technical Name');
    expect(header).not.toContain('PHI');
    expect(header).not.toContain('MRL');
    // The spine still renders every product.
    expect(csv).toContain('0-52-34');
    expect(csv).toContain('12-61-00');
  });

  it('PDF (full preset): renders every product row with day rowspan, no truncation note', () => {
    const html = ReportService.generatePDFHtml(
      data,
      ReportService.calculateSummary(data, 'fpc-activity'),
      'fpc-activity',
      undefined,
      undefined,
      FPC_FULL_COLUMNS,
    );
    expect(html).toContain('FPC Activity Register (1 days, 2 product applications)');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('Irrigation (hrs)');
    expect(html).toContain('MRL');
    expect(html).toContain('0-52-34');
    expect(html).toContain('12-61-00');
    expect(html).not.toContain('more records');
  });

  it('PDF (lean default): omits toggled-off column headers', () => {
    const html = ReportService.generatePDFHtml(
      data,
      ReportService.calculateSummary(data, 'fpc-activity'),
      'fpc-activity',
    );
    expect(html).toContain('<th>Stage</th>');
    expect(html).toContain('<th>Market Name</th>');
    expect(html).not.toContain('Irrigation (hrs)');
    expect(html).not.toContain('<th>Technical Name</th>');
    expect(html).not.toContain('<th>PHI (days)</th>');
    expect(html).not.toContain('<th>MRL</th>');
    // rowspan grouping still works with the reduced column set.
    expect(html).toContain('rowspan="2"');
  });

  it('CSV (partial toggle): a single enabled column appears, others stay hidden', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity', 'acres', {
      ...FPC_LEAN_COLUMNS,
      irrigation: true,
    });
    const header = csv.split('\n').find((line) => line.startsWith('Date,Day,')) ?? '';
    expect(header).toContain('Irrigation (hrs)');
    expect(header).toContain('Water (mm)');
    expect(header).not.toContain('Technical Name');
    expect(header).not.toContain('MRL');
  });

  it('appends an N-P-K nutrient summary after the register (CSV + PDF)', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity');
    expect(csv).toContain('NUTRIENT LEDGER - NUTRIENTS APPLIED');
    // Register comes first, nutrient summary after it.
    expect(csv.indexOf('FPC ACTIVITY REGISTER')).toBeLessThan(
      csv.indexOf('NUTRIENT LEDGER - NUTRIENTS APPLIED'),
    );

    const html = ReportService.generatePDFHtml(
      data,
      ReportService.calculateSummary(data, 'fpc-activity'),
      'fpc-activity',
    );
    expect(html).toContain('Nutrient Ledger');
    expect(html.indexOf('FPC Activity Register')).toBeLessThan(html.indexOf('Nutrient Ledger'));
  });

  it('CSV: renders the empty state when no activity exists', () => {
    const empty = generate({});
    const csv = ReportService.generateCSV(empty, 'fpc-activity');
    expect(csv).toContain('FPC ACTIVITY REGISTER');
    expect(csv).toContain('No records in selected range');
  });
});
