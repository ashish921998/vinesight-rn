import type { NutrientCompositionItem } from '@/types';

export const DEFAULT_DENSITY_KG_PER_L = 1;

export const NUTRIENT_CODES = [
  'N',
  'P',
  'P2O5',
  'K',
  'K2O',
  'Ca',
  'CaO',
  'Mg',
  'MgO',
  'S',
  'SO3',
  'Fe',
  'Mn',
  'Zn',
  'Cu',
  'B',
  'Mo',
  'Na',
  'Cl',
] as const;

export type KnownNutrientCode = (typeof NUTRIENT_CODES)[number];

// Keys are in normalizeNutrientCode() form (trimmed, UPPERCASED): the only
// lookup happens after sanitizeComposition, which normalizes every code —
// mixed-case keys ('MgO', 'CaO') would silently miss and fall back to
// factor 1, overstating Mg ~1.66× / Ca ~1.4× under an unconverted bucket.
export const OXIDE_TO_ELEMENTAL_FACTORS: Record<string, { elemental: string; factor: number }> = {
  P2O5: { elemental: 'P', factor: 0.4364 },
  K2O: { elemental: 'K', factor: 0.8301 },
  CAO: { elemental: 'Ca', factor: 0.7147 },
  MGO: { elemental: 'Mg', factor: 0.6031 },
  SO3: { elemental: 'S', factor: 0.4005 },
};

export function normalizeNutrientCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function sanitizeComposition(
  composition: NutrientCompositionItem[] | null | undefined,
): NutrientCompositionItem[] {
  if (!composition || composition.length === 0) return [];
  return composition
    .map((entry) => ({
      nutrient_code: normalizeNutrientCode(entry.nutrient_code),
      percent: Number(entry.percent),
      basis: 'declared' as const,
      notes: entry.notes ?? null,
    }))
    .filter(
      (entry) =>
        entry.nutrient_code.length > 0 &&
        Number.isFinite(entry.percent) &&
        entry.percent >= 0 &&
        entry.percent <= 100,
    );
}
