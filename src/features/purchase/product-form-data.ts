import type { WarehouseItem } from '@/types';

export interface BulkDensityPreset {
  densityKgPerL: number;
  sourceUrl: string;
}

const BULK_DENSITY_PRESETS: Record<string, BulkDensityPreset> = {
  urea: {
    densityKgPerL: 0.75,
    sourceUrl:
      'https://www.yara.com/siteassets/crop-nutrition/our-global-fertilizer-brands/yaravita/yaravita-foliar-nutrition/documents/factory-to-field.pdf/',
  },
  'can (calcium ammonium nitrate)': {
    densityKgPerL: 1.05,
    sourceUrl:
      'https://www.yara.com/siteassets/crop-nutrition/our-global-fertilizer-brands/yaravita/yaravita-foliar-nutrition/documents/factory-to-field.pdf/',
  },
  'calcium nitrate': {
    densityKgPerL: 1.1,
    sourceUrl: 'https://www.haifa-group.com/haifa-calo',
  },
  'npk 00:52:34 (mkp)': {
    densityKgPerL: 1.2,
    sourceUrl: 'https://www.haifa-group.com/haifa-mkp',
  },
  'npk 13:00:45 (kno3)': {
    densityKgPerL: 1.1,
    sourceUrl:
      'https://www.haifa-group.com/sites/default/files/2024-06/Haifa_Australia_Product_Guide.pdf',
  },
};

export function getPublishedBulkDensity(productName: string): BulkDensityPreset | null {
  return BULK_DENSITY_PRESETS[productName.trim().toLowerCase()] ?? null;
}

export function listExistingManufacturers(items: WarehouseItem[] | undefined): string[] {
  const manufacturers = new Map<string, string>();

  for (const item of items ?? []) {
    const value = item.manufacturer?.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (!manufacturers.has(key)) manufacturers.set(key, value);
  }

  return [...manufacturers.values()].sort((left, right) => left.localeCompare(right));
}

export function isValidExpiryDate(value: string): boolean {
  if (!value.trim()) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
