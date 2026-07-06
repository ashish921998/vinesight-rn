/**
 * Export coverage for the usage-lens sections the snapshot fixture does not
 * reach (issue #198): the plan-compliance table (verified vs approximate),
 * the rate-only verbatim bucket, and the per-acre "unavailable" message for
 * a farm with a missing/zero area — in both CSV and PDF HTML.
 */

import { ReportService } from '@/services/report-service';
import type { DateRange, ReportPlanItemInput } from '@/types/report';
import type { Farm, FertigationRecord } from '@/types/database';

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

const DATE_RANGE: DateRange = { from: '2026-01-01', to: '2026-12-31' };

function farmWithArea(area: number): Farm {
  return {
    id: 1,
    name: 'Lens Farm',
    area,
    region: 'Nashik',
    crop: 'Grape',
    crop_variety: 'Thompson',
    planting_date: '2020-01-01',
  };
}

function fertigation(
  fertilizers: NonNullable<FertigationRecord['fertilizers']>,
  overrides: Partial<FertigationRecord> = {},
): FertigationRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-03-01',
    area: 0,
    fertilizers,
    ...overrides,
  };
}

function generate(farm: Farm, fertigations: FertigationRecord[], planItems?: ReportPlanItemInput[]) {
  return ReportService.generateReportData(farm, [], [], fertigations, [], [], DATE_RANGE, [], {
    planItems,
  });
}

describe('plan compliance section in exports', () => {
  const PLAN_ITEMS: ReportPlanItemInput[] = [
    { id: 'pi-urea', name: 'Urea', quantity: 5, unit: 'kg/acre' },
    { id: 'pi-dap', name: 'DAP', quantity: 10, unit: 'kg' },
  ];

  const data = () =>
    generate(
      farmWithArea(2),
      [
        fertigation([
          { name: 'Urea', quantity: 8.4, unit: 'kg', plan_item_id: 'pi-urea' },
          { name: 'DAP', quantity: 9, unit: 'kg' },
        ]),
      ],
      PLAN_ITEMS,
    );

  it('CSV renders prescribed vs applied rows with verified/approximate match levels', () => {
    const csv = ReportService.generateCSV(data(), 'comprehensive', 'acres');
    expect(csv).toContain('PLAN COMPLIANCE (prescribed vs applied, per acre)');
    expect(csv).toContain('Product,Prescribed,Applied,Match');
    expect(csv).toContain('Urea,≈ 5 kg/acre,≈ 4.2 kg/acre,verified');
    expect(csv).toContain('DAP,≈ 5 kg/acre,≈ 4.5 kg/acre,approximate');
    expect(csv).toContain('never presented as verified');
  });

  it('CSV shows "not logged" and "-" for a plan item with nothing applied', () => {
    const csv = ReportService.generateCSV(
      generate(farmWithArea(2), [fertigation([{ name: 'SOP', quantity: 3, unit: 'kg' }])], [
        { id: 'pi-urea', name: 'Urea', quantity: 5, unit: 'kg/acre' },
      ]),
      'comprehensive',
      'acres',
    );
    expect(csv).toContain('Urea,≈ 5 kg/acre,not logged,-');
  });

  it('identity (catalog_product_id) matches through the full report pipeline (Phase W)', () => {
    // The logged item carries a DIFFERENT name than the plan row, so only the
    // product-id path can join them — proves report-service passes
    // catalog_product_id into the usage events end to end.
    const csv = ReportService.generateCSV(
      generate(
        farmWithArea(2),
        [fertigation([{ name: 'MAP 12:61:00', quantity: 8, unit: 'kg', catalog_product_id: 42 }])],
        [{ id: 'pi-map', name: 'MAP', quantity: 5, unit: 'kg/acre', productId: 42 }],
      ),
      'comprehensive',
      'acres',
    );
    expect(csv).toContain('MAP,≈ 5 kg/acre,≈ 4 kg/acre,approximate');
  });

  it('PDF renders the compliance table and the verified/approximate footnote', () => {
    const reportData = data();
    const summary = ReportService.calculateSummary(reportData, 'comprehensive');
    const html = ReportService.generatePDFHtml(reportData, summary, 'comprehensive', 'INR', 'acres');
    expect(html).toContain('📋 Plan Compliance (prescribed vs applied, per acre)');
    expect(html).toContain('<td>verified</td>');
    expect(html).toContain('<td>approximate</td>');
    expect(html).toContain('never presented as verified');
  });
});

describe('zero-area farm: rate-only bucket and per-acre unavailable message', () => {
  const data = () =>
    generate(farmWithArea(0), [
      fertigation([
        { name: 'Urea', quantity: 5, unit: 'kg/acre' },
        { name: 'DAP', quantity: 10, unit: 'kg' },
      ]),
    ]);

  it('CSV shows the rate as logged and never divides by a guessed area', () => {
    const csv = ReportService.generateCSV(data(), 'comprehensive', 'acres');
    expect(csv).toContain('RATE-ONLY (farm area unavailable - cannot resolve to a total)');
    expect(csv).toContain('Urea,fertilizer,5 kg/acre,1');
    expect(csv).toContain('APPLIED QUANTITIES - PER ACRE');
    expect(csv).toContain('Unavailable: farm area is missing or invalid - never divided by a guess.');
    expect(csv).not.toMatch(/≈ [^,\n]*\/acre/); // no derived per-acre figure rendered anywhere
  });

  it('PDF shows the rate-only table and the unavailable per-acre section', () => {
    const reportData = data();
    const summary = ReportService.calculateSummary(reportData, 'comprehensive');
    const html = ReportService.generatePDFHtml(reportData, summary, 'comprehensive', 'INR', 'acres');
    expect(html).toContain('Rate-Only (farm area unavailable)');
    expect(html).toContain('<td>5 kg/acre</td>');
    expect(html).toContain(
      'Unavailable: farm area is missing or invalid — never divided by a guess.',
    );
    expect(html).not.toContain('Applied Quantities — Per Acre (farm area:');
  });
});
