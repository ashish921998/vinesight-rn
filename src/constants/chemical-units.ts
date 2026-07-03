/**
 * Kernel-backed resolution of chemical unit strings for the spray form
 * (issue #207) — the spray twin of the fertigation resolvers in
 * fertilizer-units.ts. Recognition happens in the quantity kernel via the
 * shared text bridge (unit-text.ts); this module only maps a parse onto the
 * spray picker vocabulary (`CHEMICAL_UNITS`). It replaces the spray form's
 * inline spelling-enumeration table, which silently fell back on any
 * spelling nobody had thought to list.
 *
 * Unlike fertigation rows, `ChemicalEntry.unit` is strictly typed
 * `ChemicalUnit`, so strings the vocabulary cannot represent (kg/L, mg
 * totals, counts, per-hectare rates whose ÷2.47105 factor a bare scale
 * cannot carry) resolve to the fallback rather than staying verbatim —
 * parity with the table this replaces.
 */

import type { ParsedUnit } from '@/lib/quantity';
import type { QuantityBasis } from '@/types/database';

import type { ChemicalUnit } from './calculator-models';
import { parseUnitText, unitTextSaysPerAcre } from './unit-text';

export const DEFAULT_CHEMICAL_UNIT: ChemicalUnit = 'gm/L';

/**
 * Map a kernel parse onto the spray picker vocabulary. Concentrations map to
 * the dose units (gm/L, ml/L) and ppm (≡ mg/L); rates and totals keep only
 * their scale — the per-acre basis survives via
 * `resolveChemicalQuantityBasis` on the original string.
 */
function toChemicalUnit(parsed: ParsedUnit): ChemicalUnit | null {
  if (parsed.basis === 'per_liter_water') {
    if (parsed.measure === 'mass' && parsed.factorToCanonical === 0.001) return 'gm/L';
    if (parsed.measure === 'mass' && parsed.factorToCanonical === 0.000001) return 'ppm';
    if (parsed.measure === 'volume' && parsed.factorToCanonical === 0.001) return 'ml/L';
    return null;
  }
  if (parsed.measure === 'mass' && parsed.factorToCanonical === 1) return 'kg';
  if (parsed.measure === 'mass' && parsed.factorToCanonical === 0.001) return 'gram';
  if (parsed.measure === 'volume' && parsed.factorToCanonical === 1) return 'liter';
  if (parsed.measure === 'volume' && parsed.factorToCanonical === 0.001) return 'ml';
  return null;
}

/**
 * Resolve a unit string arriving at the spray form (quick-add, suggestions,
 * plan prefills, warehouse items) to a picker unit. Kernel-recognized
 * spellings resolve to their true measure at picker scale; everything else
 * returns the fallback.
 */
export function resolveChemicalUnit(
  unit: string | null | undefined,
  fallback: ChemicalUnit = DEFAULT_CHEMICAL_UNIT,
): ChemicalUnit {
  const text = unit?.trim();
  if (!text) return fallback;
  const parsed = parseUnitText(text);
  if (parsed) {
    const chemicalUnit = toChemicalUnit(parsed);
    if (chemicalUnit) return chemicalUnit;
  }
  return fallback;
}

/**
 * Basis for a spray row: an explicit basis wins, otherwise the unit text
 * decides (`'kg/acre'` → per_acre, `'gm/L'`/bare `'kg'` → total).
 *
 * The kernel's basis is honored ONLY when the unit is representable in the
 * picker vocabulary. Unlike fertigation rows, which keep unrepresentable
 * unit text verbatim (so a kernel basis stays coherent with the stored
 * string), a spray row collapses to the fallback ChemicalUnit — pairing
 * that fallback with a kernel basis would store rows like
 * `{unit: 'gm/L', basis: 'per_acre'}` for a `'kg/ha'` input, which
 * report-service then area-multiplies as if the concentration were a rate.
 * Unrepresentable and kernel-unknown strings use the per-acre text sniff,
 * exactly like the enumeration table this module replaced.
 */
export function resolveChemicalQuantityBasis(
  unit: string | null | undefined,
  basis?: QuantityBasis,
): QuantityBasis {
  if (basis) return basis;
  const parsed = parseUnitText(unit);
  if (parsed && toChemicalUnit(parsed)) {
    return parsed.basis === 'per_acre' ? 'per_acre' : 'total';
  }
  return unitTextSaysPerAcre(unit) ? 'per_acre' : 'total';
}
