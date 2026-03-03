import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/hooks/query-keys';
import { TABLES } from '@/types/database';
import type { ChemicalMix, ChemicalMixComponent } from '@/types/phi';

interface ChemicalMixRow {
  id: number;
  name: string;
  target_problem: string | null;
  application_mode: 'preventive' | 'curative' | 'both' | 'unspecified' | null;
  source_page: number | null;
  is_active: boolean;
}

interface ChemicalMixComponentRow {
  id: number;
  mix_id: number;
  product_id: number;
  product_name_snapshot: string | null;
  active_ingredient_snapshot: string | null;
  dose_value: number;
  dose_unit: 'gm' | 'ml';
  dose_basis: 'per_liter' | 'per_100_liter' | 'fixed_per_tank';
  base_tank_liters: number | null;
  sequence_no: number | null;
}

interface ChemicalPhiRuleRow {
  product_id: number;
  crop: string;
  phi_days: number;
  verified: boolean;
  source_note: string | null;
}

function mapCatalogData(
  mixes: ChemicalMixRow[],
  components: ChemicalMixComponentRow[],
  phiRules: ChemicalPhiRuleRow[],
): ChemicalMix[] {
  const componentByMix = new Map<number, ChemicalMixComponentRow[]>();
  components.forEach((component) => {
    const current = componentByMix.get(component.mix_id) ?? [];
    current.push(component);
    componentByMix.set(component.mix_id, current);
  });

  const phiRuleByProduct = new Map<number, ChemicalPhiRuleRow>();
  phiRules.forEach((rule) => {
    const existing = phiRuleByProduct.get(rule.product_id);
    if (!existing) {
      phiRuleByProduct.set(rule.product_id, rule);
      return;
    }
    if (!existing.verified && rule.verified) {
      phiRuleByProduct.set(rule.product_id, rule);
    }
  });

  return mixes.map((mix) => {
    const mappedComponents = (componentByMix.get(mix.id) ?? [])
      .sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0))
      .map((component) => {
        const phiRule = phiRuleByProduct.get(component.product_id);
        const rawPhiDays = phiRule?.phi_days;
        const parsedPhiDays = typeof rawPhiDays === 'number' ? rawPhiDays : Number(rawPhiDays);
        const hasValidPhiDays =
          Number.isFinite(parsedPhiDays) && Number.isInteger(parsedPhiDays) && parsedPhiDays >= 0;
        const isVerifiedPhi = Boolean(phiRule?.verified) && hasValidPhiDays;
        return {
          id: component.id,
          mix_id: component.mix_id,
          product_id: component.product_id,
          product_name: component.product_name_snapshot ?? 'Unknown product',
          active_ingredient: component.active_ingredient_snapshot,
          dose_value: component.dose_value,
          dose_unit: component.dose_unit,
          dose_basis: component.dose_basis,
          base_tank_liters: component.base_tank_liters,
          phi_days: isVerifiedPhi ? parsedPhiDays : null,
          phi_verified: isVerifiedPhi,
          phi_source: phiRule
            ? isVerifiedPhi
              ? (phiRule.source_note ?? 'Unknown source')
              : phiRule.verified && !hasValidPhiDays
                ? `Invalid phi_days: ${String(rawPhiDays ?? 'unknown')}`
                : `Unverified: ${phiRule.source_note ?? 'Unknown source'}`
            : 'Unknown source',
        } satisfies ChemicalMixComponent;
      });

    return {
      id: mix.id,
      name: mix.name,
      target_problem: mix.target_problem,
      application_mode: mix.application_mode,
      source_page: mix.source_page,
      is_active: mix.is_active,
      components: mappedComponents,
    } satisfies ChemicalMix;
  });
}

async function fetchChemicalCatalog(): Promise<ChemicalMix[]> {
  const mixesResult = await supabase
    .from(TABLES.CHEMICAL_MIXES)
    .select('id,name,target_problem,application_mode,source_page,is_active')
    .eq('is_active', true)
    .eq('crop', 'grape')
    .order('name', { ascending: true });
  const possibleMissingCode = '42P01';
  if (mixesResult.error?.code === possibleMissingCode) return [];
  if (mixesResult.error) throw mixesResult.error;

  const mixRows = (mixesResult.data ?? []) as ChemicalMixRow[];
  const mixIds = mixRows.map((mix) => mix.id);

  const componentsPromise =
    mixIds.length > 0
      ? supabase
          .from(TABLES.CHEMICAL_MIX_COMPONENTS)
          .select(
            'id,mix_id,product_id,product_name_snapshot,active_ingredient_snapshot,dose_value,dose_unit,dose_basis,base_tank_liters,sequence_no',
          )
          .in('mix_id', mixIds)
          .order('sequence_no', { ascending: true })
      : Promise.resolve({
          data: [] as ChemicalMixComponentRow[],
          error: null,
        });
  const componentsResult = await componentsPromise;
  if (componentsResult.error?.code === possibleMissingCode) return [];
  if (componentsResult.error) throw componentsResult.error;

  const productIds = Array.from(
    new Set(
      ((componentsResult.data ?? []) as ChemicalMixComponentRow[])
        .map((component) => component.product_id)
        .filter((productId): productId is number => typeof productId === 'number'),
    ),
  );
  const phiPromise =
    productIds.length > 0
      ? supabase
          .from(TABLES.CHEMICAL_PHI_RULES)
          .select('product_id,crop,phi_days,verified,source_note')
          .in('product_id', productIds)
          .eq('crop', 'grape')
      : Promise.resolve({
          data: [] as ChemicalPhiRuleRow[],
          error: null,
        });
  const phiResult = await phiPromise;

  if (phiResult.error?.code === possibleMissingCode) return [];
  if (phiResult.error) throw phiResult.error;

  return mapCatalogData(
    mixRows,
    (componentsResult.data ?? []) as ChemicalMixComponentRow[],
    (phiResult.data ?? []) as ChemicalPhiRuleRow[],
  );
}

export function useChemicalCatalog(enabled = true) {
  return useQuery({
    queryKey: queryKeys.chemicalCatalog.mixes(),
    queryFn: fetchChemicalCatalog,
    staleTime: 60_000,
    enabled,
  });
}

export function useChemicalMixSearch(query: string, enabled = true) {
  const normalized = query.trim().toLowerCase();
  const catalogQuery = useChemicalCatalog(enabled);

  const data = useMemo(() => {
    const mixes = catalogQuery.data ?? [];
    if (!normalized) return mixes;
    return mixes.filter((mix) => {
      if (mix.name.toLowerCase().includes(normalized)) return true;
      if ((mix.target_problem ?? '').toLowerCase().includes(normalized)) return true;
      return mix.components.some(
        (component) =>
          component.product_name.toLowerCase().includes(normalized) ||
          (component.active_ingredient ?? '').toLowerCase().includes(normalized),
      );
    });
  }, [catalogQuery.data, normalized]);

  return {
    ...catalogQuery,
    data,
  };
}

export function useChemicalMixById(mixId: number | null | undefined) {
  const catalogQuery = useChemicalCatalog();
  const data = useMemo(
    () => (catalogQuery.data ?? []).find((mix) => mix.id === mixId) ?? null,
    [catalogQuery.data, mixId],
  );
  return {
    ...catalogQuery,
    data,
  };
}
