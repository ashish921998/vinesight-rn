import { ReportService } from '@/services/report-service';
import type { DateRange } from '@/types/report';
import type { Farm, FertigationRecord, SprayRecord, WarehouseItem } from '@/types/database';

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

const FARM: Farm = {
  id: 1,
  name: 'Test Farm',
  area: 2,
  region: 'Nashik',
  crop: 'Grape',
  crop_variety: 'Thompson',
  planting_date: '2020-01-01',
};

function createSprayRecord(overrides: Partial<SprayRecord> = {}): SprayRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-02-01',
    chemical: '',
    dose: 'Water: 200L',
    area: 2,
    weather: '',
    operator: '',
    ...overrides,
  };
}

function createFertigationRecord(overrides: Partial<FertigationRecord> = {}): FertigationRecord {
  return {
    id: 1,
    farm_id: 1,
    date: '2026-02-01',
    area: 2,
    fertilizers: [],
    ...overrides,
  };
}

function generateStockUsage(params: {
  sprays?: SprayRecord[];
  fertigations?: FertigationRecord[];
  warehouseItems?: WarehouseItem[];
}) {
  return ReportService.generateReportData(
    FARM,
    [],
    params.sprays ?? [],
    params.fertigations ?? [],
    [],
    [],
    DATE_RANGE,
    params.warehouseItems ?? [],
  ).stock;
}

describe('ReportService stock usage aggregation', () => {
  it('aggregates spray usage from chemical_items when present', () => {
    const stock = generateStockUsage({
      sprays: [
        createSprayRecord({
          chemical_items: [{ name: 'Calcium Nitrate', quantity: 20, unit: 'kg' }],
        }),
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      itemName: 'Calcium Nitrate',
      type: 'spray',
      unit: 'kg',
      quantityUsed: 20,
    });
  });

  it('falls back to parsing legacy spray chemical string', () => {
    const stock = generateStockUsage({
      sprays: [createSprayRecord({ chemical: 'M45 (10 kg)' })],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      itemName: 'M45',
      type: 'spray',
      unit: 'kg',
      quantityUsed: 10,
    });
  });

  it('converts per-acre quantities to total used amount', () => {
    const stock = generateStockUsage({
      fertigations: [
        createFertigationRecord({
          area: 2,
          fertilizers: [{ name: 'Urea', quantity: 5, unit: 'kg/acre' }],
        }),
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      itemName: 'Urea',
      type: 'fertilizer',
      unit: 'kg',
      quantityUsed: 10,
    });
  });

  it('normalizes gram and kg into a single kg total', () => {
    const stock = generateStockUsage({
      fertigations: [
        createFertigationRecord({
          id: 1,
          fertilizers: [{ name: 'Urea', quantity: 500, unit: 'gram' }],
        }),
        createFertigationRecord({
          id: 2,
          fertilizers: [{ name: 'Urea', quantity: 1, unit: 'kg' }],
        }),
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      itemName: 'Urea',
      unit: 'kg',
      quantityUsed: 1.5,
      usageCount: 2,
    });
  });

  it('keeps incompatible units separate for the same item', () => {
    const stock = generateStockUsage({
      fertigations: [
        createFertigationRecord({
          id: 1,
          fertilizers: [{ name: 'Calcium Nitrate', quantity: 1, unit: 'kg' }],
        }),
        createFertigationRecord({
          id: 2,
          fertilizers: [{ name: 'Calcium Nitrate', quantity: 2, unit: 'unit' }],
        }),
      ],
    });

    expect(stock).toHaveLength(2);
    const units = stock.map((item) => item.unit).sort();
    expect(units).toEqual(['kg', 'unit']);
  });

  it('matches warehouse item by warehouse_item_id and computes estimated consumption', () => {
    const stock = generateStockUsage({
      sprays: [
        createSprayRecord({
          chemical_items: [{ name: 'M45', quantity: 20, unit: 'kg', warehouse_item_id: 7 }],
        }),
      ],
      warehouseItems: [
        {
          id: 7,
          name: 'M45',
          type: 'spray',
          quantity: 30,
          unit: 'kg',
          unit_price: 10,
        },
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      warehouseItemId: 7,
      matchStrategy: 'warehouse_item_id',
      currentStockQuantity: 30,
      estimatedOpeningStockQuantity: 50,
      estimatedConsumedPercent: 40,
    });
  });

  it('matches warehouse item by normalized name and unit fallback', () => {
    const stock = generateStockUsage({
      sprays: [createSprayRecord({ chemical: 'M45 (10 KG)' })],
      warehouseItems: [
        {
          id: 8,
          name: 'm45',
          type: 'spray',
          quantity: 90,
          unit: 'kg',
          unit_price: 10,
        },
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      warehouseItemId: 8,
      matchStrategy: 'name_unit_fallback',
      currentStockQuantity: 90,
      estimatedOpeningStockQuantity: 100,
      estimatedConsumedPercent: 10,
    });
  });

  it('uses used/(current+used) formula for estimated consumed percent', () => {
    const stock = generateStockUsage({
      fertigations: [
        createFertigationRecord({
          fertilizers: [{ name: 'Calcium Nitrate', quantity: 15, unit: 'kg' }],
        }),
      ],
      warehouseItems: [
        {
          id: 10,
          name: 'Calcium Nitrate',
          type: 'fertilizer',
          quantity: 45,
          unit: 'kg',
          unit_price: 10,
        },
      ],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0].estimatedConsumedPercent).toBe(25);
  });

  it('returns null estimation fields for unmatched rows', () => {
    const stock = generateStockUsage({
      sprays: [createSprayRecord({ chemical: 'Unknown Mix (3 unit)' })],
    });

    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({
      warehouseItemId: null,
      currentStockQuantity: null,
      estimatedOpeningStockQuantity: null,
      estimatedConsumedPercent: null,
      matchStrategy: 'unmatched',
    });
  });
});
