/**
 * FPC Activity Register (Fratelli format) — buildFpcActivity via
 * generateReportData, plus its CSV/PDF rendering.
 */

import { ReportService, type FpcReportLookups } from '@/services/report-service';
import { FPC_FULL_COLUMNS, FPC_LEAN_COLUMNS, type DateRange } from '@/types/report';
import type { Farm, FertigationRecord, IrrigationRecord, SprayRecord } from '@/types/database';
import { generateFpcWorkbook } from '@/services/report/report-xlsx';
import { strFromU8, unzipSync } from 'fflate';

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

  it('CSV (simple default): matches Fratelli’s eight-column register', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity');
    expect(csv).toContain('Farmer Name: Fratelli Plot');
    expect(csv).toContain('Variety: Thompson');
    expect(csv).toContain('Pruning Date: 06-05-2026');
    expect(csv).not.toContain('Report Type:');
    const header = csv.split('\n').find((line) => line.startsWith('Sr.No,Days,')) ?? '';
    expect(header).toBe('Sr.No,Days,Date,Product Name,Technical Name,Qty Per Liter,PHI,MRL');
    expect(header).not.toContain('Irrigation');
    expect(header).not.toContain('Safe Harvest');
    expect(header).not.toContain('Stage');
    expect(csv).toContain('0-52-34');
    expect(csv).toContain('12-61-00');
    const rows = csv.split('\n');
    const firstProduct = rows.find((line) => line.includes('0-52-34')) ?? '';
    const continuation = rows.find((line) => line.includes('12-61-00')) ?? '';
    expect(firstProduct.startsWith('1,41,16-06-2026,')).toBe(true);
    expect(continuation.startsWith(',,,')).toBe(true);
    expect(csv).not.toContain('NUTRIENT LEDGER');
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

  it('PDF (simple default): matches Fratelli’s eight-column register', () => {
    const html = ReportService.generatePDFHtml(
      data,
      ReportService.calculateSummary(data, 'fpc-activity'),
      'fpc-activity',
    );
    expect(html).toContain('<th>Sr.No</th>');
    expect(html).toContain('<th>Days</th>');
    expect(html).toContain('<th>Product Name</th>');
    expect(html).toContain('<th>Technical Name</th>');
    expect(html).toContain('<th>Qty Per Liter</th>');
    expect(html).toContain('<th>PHI</th>');
    expect(html).toContain('<th>MRL</th>');
    expect(html).toContain('Farmer Name: Fratelli Plot');
    expect(html).toContain('Variety: Thompson');
    expect(html).toContain('Pruning Date: 06-05-2026');
    expect(html).not.toContain('Report Type: FPC Activity');
    expect(html).not.toContain('<h3 style="margin-top: 0;">Summary</h3>');
    expect(html).toContain('<td>-</td><td>-</td><td>-</td><td>12-61-00</td>');
    expect(html).not.toContain('Irrigation (hrs)');
    expect(html).not.toContain('<th>Stage</th>');
    expect(html).not.toContain('Nutrient Ledger');
  });

  it('XLSX: creates a Fratelli workbook with merged identity rows and grouped products', () => {
    const workbook = generateFpcWorkbook(data);
    const files = unzipSync(Uint8Array.from(Buffer.from(workbook, 'base64')));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);

    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['xl/workbook.xml']).toBeDefined();
    expect(sheet).toContain('Farmer Name: Fratelli Plot');
    expect(sheet).toContain('Variety: Thompson');
    expect(sheet).toContain('Pruning Date: 06-05-2026');
    expect(sheet).toContain('<mergeCell ref="A1:H1"/>');
    expect(sheet).toContain('<t xml:space="preserve">1</t>');
    expect(sheet).toContain('<t xml:space="preserve">0-52-34</t>');
    expect(sheet).toContain('<t xml:space="preserve">12-61-00</t>');
  });

  it('XLSX: repeats the exporter identity and header block on long registers', () => {
    const manyDays = Array.from({ length: 73 }, (_, index) => ({
      date: `Day ${index + 1}`,
      isoDate: `2026-06-${String((index % 28) + 1).padStart(2, '0')}`,
      daysAfterPruning: index + 1,
      irrigationHours: null,
      waterMm: null,
      growthStage: 'stage',
      products: [
        {
          key: `product-${index}`,
          source: 'spray' as const,
          marketName: `Product ${index + 1}`,
          technicalName: `Technical ${index + 1}`,
          qtyPerAcreDisplay: null,
          totalQtyDisplay: null,
          asLogged: '1 ml',
          phiDays: null,
          safeHarvestDate: null,
          mrl: null,
        },
      ],
      notes: '',
    }));

    const workbook = generateFpcWorkbook({ ...data, fpcActivity: manyDays });
    const files = unzipSync(Uint8Array.from(Buffer.from(workbook, 'base64')));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);

    expect(sheet).toContain('<mergeCell ref="A1:H1"/>');
    expect(sheet).toContain('<mergeCell ref="A77:H77"/>');
    expect(sheet).toContain('<row r="80">');
    expect(sheet).toContain('<t xml:space="preserve">Sr.No</t>');
    expect(sheet).toContain('<t xml:space="preserve">Qty Per Liter </t>');
    expect(sheet).toContain('<rowBreaks count="1" manualBreakCount="1">');
    expect(sheet).toContain('<brk id="76" min="0" max="16383" man="1"/>');
  });

  it('CSV (simple): keeps the Days cell raw "-" when the pruning date is missing', () => {
    // No date_of_pruning → daysAfterPruning is null → Days renders as "-".
    // escapeCSV's formula guard would prefix a leading "-" with a force-text
    // apostrophe ("'-"), surfacing a stray '- in Excel; the Days cell must stay
    // raw, matching the detailed register path.
    const noPruningData = ReportService.generateReportData(
      { ...FARM, date_of_pruning: null },
      [],
      [],
      [
        createFertigationRecord({
          fertilizers: [{ name: '0-52-34', quantity: 3, unit: 'kg', quantity_basis: 'per_acre' }],
        }),
      ],
      [],
      [],
      DATE_RANGE,
      [],
    );
    const csv = ReportService.generateCSV(noPruningData, 'fpc-activity');
    const row = csv.split('\n').find((line) => line.includes('0-52-34')) ?? '';
    // Days is the 2nd column: serial 1, then "-", never "'-".
    expect(row.startsWith('1,-,')).toBe(true);
    expect(row).not.toContain("'-");
  });

  it('CSV (partial toggle): a single enabled column appears, others stay hidden', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity', 'acres', {
      ...FPC_LEAN_COLUMNS,
      irrigation: true,
    });
    const header = csv.split('\n').find((line) => line.startsWith('Date,Day,')) ?? '';
    expect(header).toContain('Irrigation (hrs)');
    expect(header).toContain('Water (mm)');
    expect(header).toContain('Technical Name');
    expect(header).toContain('MRL');
  });

  it('appends an N-P-K nutrient summary after the register (CSV + PDF)', () => {
    const csv = ReportService.generateCSV(data, 'fpc-activity', 'acres', FPC_FULL_COLUMNS);
    expect(csv).toContain('NUTRIENT LEDGER - NUTRIENTS APPLIED');
    // Register comes first, nutrient summary after it.
    expect(csv.indexOf('FPC ACTIVITY REGISTER')).toBeLessThan(
      csv.indexOf('NUTRIENT LEDGER - NUTRIENTS APPLIED'),
    );

    const html = ReportService.generatePDFHtml(
      data,
      ReportService.calculateSummary(data, 'fpc-activity'),
      'fpc-activity',
      undefined,
      undefined,
      FPC_FULL_COLUMNS,
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
