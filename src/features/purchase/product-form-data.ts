import type { WarehouseItem } from '@/types';

interface ResolveCatalogBulkDensityValueParams {
  currentValue: string;
  isCurrentValueCatalogApplied: boolean;
  nextDensityKgPerL?: number | null;
}

export interface CatalogBulkDensityResolution {
  value: string;
  isCatalogApplied: boolean;
}

export function resolveCatalogBulkDensityValue({
  currentValue,
  isCurrentValueCatalogApplied,
  nextDensityKgPerL,
}: ResolveCatalogBulkDensityValueParams): CatalogBulkDensityResolution {
  const canReplaceValue = !currentValue.trim() || isCurrentValueCatalogApplied;

  if (!canReplaceValue) {
    return { value: currentValue, isCatalogApplied: false };
  }

  return {
    value: nextDensityKgPerL == null ? '' : String(nextDensityKgPerL),
    isCatalogApplied: nextDensityKgPerL != null,
  };
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
