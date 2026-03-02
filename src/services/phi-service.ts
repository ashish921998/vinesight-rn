import { addDays, formatLocalDate, parseDbDateToLocalDate } from '@/utils/date';
import { supabase } from '@/lib/supabase';
import { TABLES } from '@/types/database';
import type {
  ChemicalMix,
  ChemicalMixComponent,
  DoseUnit,
  PhiComputationResult,
  SafeToSprayStatus,
} from '@/types/phi';

export const PHI_CALC_VERSION = 'v1';
export const SAFE_TO_SPRAY_YELLOW_BUFFER_DAYS = 3;

export interface TankMixQuantityRow {
  componentId: number;
  productName: string;
  activeIngredient: string | null;
  doseValue: number;
  doseUnit: DoseUnit;
  doseBasis: ChemicalMixComponent['dose_basis'];
  totalQuantity: number;
  packagingSize: string | null;
  packageCount: number | null;
  componentCost: number | null;
  currency: string | null;
}

export interface TankMixCostSummary {
  rows: TankMixQuantityRow[];
  totalCost: number | null;
  currency: string | null;
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayStartUtc(dateString: string): number | null {
  const parsed = parseDbDateToLocalDate(dateString);
  if (!parsed) return null;
  return Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function dayDiff(targetDate: string, baseDate: string): number {
  const target = dayStartUtc(targetDate);
  const base = dayStartUtc(baseDate);
  if (target === null || base === null) return 0;
  return Math.floor((target - base) / (24 * 60 * 60 * 1000));
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parsePackagingSize(packagingSize: string | null | undefined): {
  quantity: number;
  unit: 'gm' | 'ml';
} | null {
  if (!packagingSize) return null;
  const normalized = packagingSize.toLowerCase().replace(/\s+/g, '');
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)(kg|gm|g|ml|li|l)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(value) || value <= 0) return null;
  const unitToken = match[2] ?? '';
  if (unitToken === 'kg') return { quantity: value * 1000, unit: 'gm' };
  if (unitToken === 'g' || unitToken === 'gm') return { quantity: value, unit: 'gm' };
  if (unitToken === 'l' || unitToken === 'li') return { quantity: value * 1000, unit: 'ml' };
  if (unitToken === 'ml') return { quantity: value, unit: 'ml' };
  return null;
}

export function normalizeMixComponentToPerLiterDose(
  component: ChemicalMixComponent,
): { quantity: number; unit: 'gm/L' | 'ml/L' } | null {
  const unit = component.dose_unit === 'ml' ? 'ml/L' : 'gm/L';

  if (component.dose_basis === 'per_liter') {
    return { quantity: component.dose_value, unit };
  }

  if (component.dose_basis === 'per_100_liter') {
    return { quantity: component.dose_value / 100, unit };
  }

  if (component.base_tank_liters == null || component.base_tank_liters <= 0) {
    console.warn(
      `[phi-service] Invalid fixed_per_tank base_tank_liters for component ${component.id} (${component.product_name})`,
    );
    return null;
  }

  return { quantity: component.dose_value / component.base_tank_liters, unit };
}

export function computeTankMixQuantities(
  mix: ChemicalMix,
  tankLiters: number,
  digits = 3,
): TankMixQuantityRow[] {
  if (!Number.isFinite(tankLiters) || tankLiters <= 0) return [];
  const rows: TankMixQuantityRow[] = [];
  for (const component of mix.components) {
    let total = 0;
    if (component.dose_basis === 'per_liter') {
      total = component.dose_value * tankLiters;
    } else if (component.dose_basis === 'per_100_liter') {
      total = component.dose_value * (tankLiters / 100);
    } else {
      if (component.base_tank_liters == null || component.base_tank_liters <= 0) {
        console.warn(
          `[phi-service] Skipping fixed_per_tank component ${component.id} (${component.product_name}) due to invalid base_tank_liters`,
        );
        continue;
      }
      total = component.dose_value * (tankLiters / component.base_tank_liters);
    }
    rows.push({
      componentId: component.id,
      productName: component.product_name,
      activeIngredient: component.active_ingredient ?? null,
      doseValue: component.dose_value,
      doseUnit: component.dose_unit,
      doseBasis: component.dose_basis,
      totalQuantity: round(total, digits),
      packagingSize: component.packaging_size ?? null,
      packageCount: null,
      componentCost: null,
      currency: component.price_currency ?? null,
    });
  }
  return rows;
}

export function computeTankMixCostSummary(
  mix: ChemicalMix,
  tankLiters: number,
  digits = 3,
): TankMixCostSummary {
  const rows = computeTankMixQuantities(mix, tankLiters, digits).map((row) => {
    const component = mix.components.find((c) => c.id === row.componentId);
    if (!component) return row;
    if (component.price_per_package == null || component.price_per_package < 0) return row;
    const parsedPackaging = parsePackagingSize(component.packaging_size);
    if (!parsedPackaging) return row;
    const targetUnit: 'gm' | 'ml' = row.doseUnit === 'ml' ? 'ml' : 'gm';
    if (parsedPackaging.unit !== targetUnit) return row;
    const packageCount = row.totalQuantity / parsedPackaging.quantity;
    return {
      ...row,
      packageCount: round(packageCount, digits),
      componentCost: round(packageCount * component.price_per_package, digits),
      currency: component.price_currency ?? 'INR',
    };
  });

  const validCosts = rows
    .map((row) => row.componentCost)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const totalCost =
    validCosts.length > 0
      ? round(
          validCosts.reduce((sum, current) => sum + current, 0),
          digits,
        )
      : null;
  const currency = rows.find((row) => row.currency)?.currency ?? null;
  return { rows, totalCost, currency };
}

export function computeGoverningPhiComponent(mix: ChemicalMix): ChemicalMixComponent | null {
  if (mix.components.length === 0) return null;
  return mix.components.reduce((max, current) => (current.phi_days > max.phi_days ? current : max));
}

export function computePhiForMix(mix: ChemicalMix, sprayDate: string): PhiComputationResult | null {
  if (!isValidDateString(sprayDate)) return null;
  const governing = computeGoverningPhiComponent(mix);
  if (!governing) return null;
  const safeHarvestDate = addDays(sprayDate, governing.phi_days);
  if (!safeHarvestDate) return null;
  return {
    catalogMixId: mix.id,
    sprayDate,
    governingPhiDays: governing.phi_days,
    safeHarvestDate,
    blockingComponentName: governing.product_name,
    phiStatus: 'verified',
  };
}

export interface PhiRecord {
  safe_harvest_date?: string | null;
  phi_blocking_component?: string | null;
  chemical?: string | null;
  date?: string | null;
}

export function computeEarliestSafeHarvest(records: PhiRecord[]): {
  earliestDate: string | null;
  reason: string | null;
} {
  const valid = records
    .map((record) => record.safe_harvest_date)
    .filter((value): value is string => typeof value === 'string' && isValidDateString(value));
  if (valid.length === 0) {
    return { earliestDate: null, reason: null };
  }
  const earliestDate = valid.sort((a, b) => dayDiff(b, a))[0];
  const blocker = records.find((record) => record.safe_harvest_date === earliestDate);
  if (!blocker) {
    return { earliestDate, reason: null };
  }
  const component = blocker.phi_blocking_component ?? 'Unknown component';
  const chemical = blocker.chemical ?? 'Unknown spray';
  const sprayDate = blocker.date ?? 'unknown date';
  return {
    earliestDate,
    reason: `${component} (${chemical}, ${sprayDate})`,
  };
}

export interface BuildSafeToSprayArgs {
  mixes: ChemicalMix[];
  targetHarvestDate: string;
  today?: string;
  yellowBufferDays?: number;
}

export function buildSafeToSprayStatus(args: BuildSafeToSprayArgs): SafeToSprayStatus[] {
  const { mixes, targetHarvestDate, yellowBufferDays = SAFE_TO_SPRAY_YELLOW_BUFFER_DAYS } = args;
  if (!isValidDateString(targetHarvestDate)) return [];
  const today =
    args.today && isValidDateString(args.today) ? args.today : formatLocalDate(new Date());
  return mixes
    .map((mix) => {
      const governing = computeGoverningPhiComponent(mix);
      if (!governing) return null;
      const latestSafeSprayDate = addDays(targetHarvestDate, -governing.phi_days);
      if (!latestSafeSprayDate) return null;
      const daysUntilWindowEnds = dayDiff(latestSafeSprayDate, today);
      const status =
        daysUntilWindowEnds < 0
          ? 'red'
          : daysUntilWindowEnds <= yellowBufferDays
            ? 'yellow'
            : 'green';
      return {
        mixId: mix.id,
        mixName: mix.name,
        status,
        latestSafeSprayDate,
        daysUntilWindowEnds,
        governingPhiDays: governing.phi_days,
        blockingComponentName: governing.product_name,
      } as SafeToSprayStatus;
    })
    .filter((item): item is SafeToSprayStatus => item !== null)
    .sort((a, b) => {
      if (a.status === b.status) return a.mixName.localeCompare(b.mixName);
      const order = { red: 0, yellow: 1, green: 2 };
      return order[a.status] - order[b.status];
    });
}

export interface PhiConflictArgs {
  safeHarvestDate?: string | null;
  targetHarvestDate?: string | null;
}

export function isPhiConflict(args: PhiConflictArgs): boolean {
  const { safeHarvestDate, targetHarvestDate } = args;
  if (!safeHarvestDate || !targetHarvestDate) return false;
  if (!isValidDateString(safeHarvestDate) || !isValidDateString(targetHarvestDate)) return false;
  return dayDiff(safeHarvestDate, targetHarvestDate) > 0;
}

export interface SprayPhiRow {
  safe_harvest_date: string | null;
  phi_blocking_component: string | null;
  chemical: string | null;
  date: string;
}

export async function fetchSprayPhiRows(
  farmId: number,
  seasonId?: number | null,
): Promise<SprayPhiRow[]> {
  let query = supabase
    .from(TABLES.SPRAY_RECORDS)
    .select('safe_harvest_date,phi_blocking_component,chemical,date')
    .eq('farm_id', farmId)
    .order('date', { ascending: false });
  if (seasonId !== undefined && seasonId !== null) {
    query = query.eq('season_id', seasonId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SprayPhiRow[];
}
