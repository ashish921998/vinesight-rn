/**
 * Input-source lists for the spray and fertigation product pickers.
 *
 * Extracted from EntryForm so every log composer (the full EntryForm and the
 * dashboard QuickLogSheet) feeds its pickers from identical merge/dedupe
 * logic — warehouse stock, this farm's recent inputs, and active plan items.
 */
import { useMemo } from 'react';

import type { SprayQuickAddItem, FertigationQuickAddItem } from '@/components/forms';
import { fertigationChipForEntry } from '@/components/forms/fertigation-unit-chips';
import { resolveFertigationPrefill, resolveFertigationUnit } from '@/constants/fertilizer-units';
import { useWarehouseItems } from './use-profile';
import { useRecentSprayChemicals, useRecentFertigationItems } from './use-records';
import { useFertilizerPlan } from './use-fertilizer-plan';
import { useMasterProducts } from './use-master-catalog';

// Fertigation unit resolution goes through the quantity kernel
// (`resolveFertigationUnit` / `resolveFertigationPrefill` in
// `@/constants/fertilizer-units`) — unknown unit strings stay verbatim and are
// never coerced to kg (issue #192).

function inferWarehouseFertilizerQuantityBasis(
  unit: string | null | undefined,
): 'per_acre' | undefined {
  if (typeof unit !== 'string') return undefined;
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.includes('/acre') || normalized.includes('per acre') ? 'per_acre' : undefined;
}

export function useSprayInputSources(farmId: number | undefined) {
  const { data: sprayWarehouseItems } = useWarehouseItems('spray');
  const { data: recentSprayChemicals } = useRecentSprayChemicals(farmId);
  const { data: fertilizerPlan } = useFertilizerPlan(farmId);

  const quickAddItems = useMemo<SprayQuickAddItem[]>(() => {
    const byWarehouse = (sprayWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: undefined,
      quantity: null,
      quantityBasis: undefined,
      warehouseItemId: item.id ?? null,
      catalogProductId: item.catalog_product_id ?? null,
      composition: item.composition ?? null,
      densityKgPerL: item.density_kg_per_l ?? null,
    }));
    const byRecent = (recentSprayChemicals ?? []).map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity ?? null,
      quantityBasis: undefined,
    }));
    const deduped = new Map<string, SprayQuickAddItem>();
    [...byWarehouse, ...byRecent].forEach((item) => {
      const key = `${item.name.trim().toLowerCase()}::${(item.unit ?? '').trim().toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, item);
        return;
      }
      if (
        (existing.quantity === null || existing.quantity === undefined) &&
        item.quantity != null
      ) {
        deduped.set(key, {
          ...existing,
          quantity: item.quantity,
          quantityBasis: item.quantityBasis ?? existing.quantityBasis,
        });
      }
    });
    return Array.from(deduped.values()).slice(0, 15);
  }, [sprayWarehouseItems, recentSprayChemicals]);

  const historyItems = useMemo(() => recentSprayChemicals ?? [], [recentSprayChemicals]);
  const planItems = useMemo(() => fertilizerPlan?.items ?? [], [fertilizerPlan]);

  return { quickAddItems, historyItems, planItems };
}

export function useFertigationInputSources(
  farmId: number | undefined,
  options?: {
    /** Gate the master-catalog fetch on a fertigation form actually being visible. */
    catalogEnabled?: boolean;
  },
) {
  const { data: fertilizerWarehouseItems } = useWarehouseItems('fertilizer');
  const { data: recentFertigationItems } = useRecentFertigationItems(farmId);
  const { data: fertilizerPlan } = useFertilizerPlan(farmId);
  // Fertilizer catalog for the picker's catalog section. Includes biostimulants
  // (fertigation-applied), matching the warehouse fertilizer grouping; the
  // section simply hides when the catalog has no rows.
  const { data: catalogProducts = [] } = useMasterProducts({
    inputTypes: ['fertilizer', 'biostimulant'],
    stateCode: null,
    enabled: options?.catalogEnabled ?? true,
  });

  const quickAddItems = useMemo<FertigationQuickAddItem[]>(() => {
    const byPlan = (fertilizerPlan?.items ?? []).map((item) => {
      // Plan doses are per-acre rates by contract: bare form units ('kg') keep
      // per_acre; unrepresentable/unknown units stay verbatim with the sniffed
      // basis (resolveFertigationPrefill — same path as plan one-tap prefill).
      const prefill = resolveFertigationPrefill(item.unit);
      return {
        name: item.name,
        unit: prefill.unit,
        quantity: item.quantity ?? null,
        quantityBasis: prefill.quantityBasis,
        warehouseItemId: null,
        catalogProductId: null,
        planItemId: item.id,
      };
    });
    const byWarehouse = (fertilizerWarehouseItems ?? []).map((item) => ({
      name: item.name,
      unit: resolveFertigationUnit(item.unit).unit,
      quantity: null,
      quantityBasis: inferWarehouseFertilizerQuantityBasis(item.unit),
      warehouseItemId: item.id ?? null,
      catalogProductId: item.catalog_product_id ?? null,
      composition: item.composition ?? null,
      densityKgPerL: item.density_kg_per_l ?? null,
    }));
    const byRecent = (recentFertigationItems ?? []).map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity ?? null,
      // History carries its own basis — a total logged as bare 'kg' must not
      // re-enter as a rate (or vice versa) now that chips fuse unit + basis.
      quantityBasis: item.quantityBasis,
    }));
    const deduped = new Map<string, FertigationQuickAddItem>();
    [...byPlan, ...byWarehouse, ...byRecent].forEach((item) => {
      // Dedupe on fused chip identity (unit + basis), not the unit string —
      // 'kg total' and 'kg/acre' both store unit 'kg' but are distinct chips.
      // Outside the chip vocabulary, fall back to unit + raw basis.
      const unitKey = (item.unit ?? '').trim().toLowerCase();
      const chipKey =
        fertigationChipForEntry(item.unit ?? '', item.quantityBasis)?.key ??
        `${unitKey}::${item.quantityBasis ?? ''}`;
      const key = `${item.name.trim().toLowerCase()}::${chipKey}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, item);
        return;
      }
      if (
        (existing.quantity === null || existing.quantity === undefined) &&
        item.quantity != null
      ) {
        deduped.set(key, {
          ...existing,
          quantity: item.quantity,
          quantityBasis: item.quantityBasis ?? existing.quantityBasis,
        });
      }
    });
    return Array.from(deduped.values()).slice(0, 15);
  }, [fertilizerPlan, fertilizerWarehouseItems, recentFertigationItems]);

  const historyItems = useMemo(() => recentFertigationItems ?? [], [recentFertigationItems]);
  const planItems = useMemo(() => fertilizerPlan?.items ?? [], [fertilizerPlan]);

  return { quickAddItems, historyItems, planItems, catalogProducts };
}
