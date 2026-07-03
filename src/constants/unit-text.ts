/**
 * Lenient unit-text → quantity-kernel bridge shared by the fertigation and
 * spray resolvers (#192, #207). The kernel grammar (`parseUnit`) is strict:
 * `<base>[/<denominator>]`. Stored data additionally contains documented
 * legacy spellings that write the denominator as a word (`'kg per acre'`,
 * `'litre per acre'`); this module folds those into the kernel shape before
 * parsing, and answers the basis question for unit strings that forms carry
 * verbatim. Anything the kernel does not positively recognize stays null —
 * never a silent fallback.
 */

import { parseUnit, type ParsedUnit } from '@/lib/quantity';
import type { QuantityBasis } from '@/types/database';

/**
 * Fold legacy spellings into the kernel's `<base>/<denominator>` shape:
 * `'X per Y'` → `'X/Y'` (whitespace required around `per` so product names
 * like "copper" can never match) and spaced slashes `'X / Y'` → `'X/Y'`,
 * trimmed. The kernel strips whitespace itself, so the folds only matter
 * for consumers that inspect the TEXT: the per-acre sniff below must see
 * `'sacks / acre'` the same as `'sacks/acre'`, and dose-guard references
 * display the folded string verbatim (a DB unit of `' ml/L '` must not
 * render with stray spaces).
 */
export function toKernelSpelling(raw: string): string {
  return raw
    .trim()
    .replace(/\s+per\s+/gi, '/')
    .replace(/\s*\/\s*/g, '/');
}

/**
 * Parse a unit string through the quantity kernel, tolerating the legacy
 * `'X per acre'` spellings. Returns null for anything the kernel does not
 * positively recognize — NEVER a silent fallback.
 */
export function parseUnitText(raw: string | null | undefined): ParsedUnit | null {
  if (typeof raw !== 'string') return null;
  return parseUnit(toKernelSpelling(raw));
}

/**
 * True when the unit TEXT itself testifies a per-acre rate, covering both the
 * kernel spelling (`'kg/acre'`, plural `'acres'`) and the documented legacy
 * word form (`'kg per acre'`) — the same folding `parseUnitText` applies.
 * Word-boundary matched so `'foo/acreage'` can never false-positive.
 */
export function unitTextSaysPerAcre(unit: string | null | undefined): boolean {
  if (typeof unit !== 'string') return false;
  return /\/acres?\b/.test(toKernelSpelling(unit).toLowerCase());
}

/**
 * Basis fallback for units a form carries VERBATIM. Kernel-recognized strings
 * (ppm, g/L, kg/ha …) use the kernel's parsed basis — so `'kg/ha'` is a
 * per-acre-class rate, never a plot total (its ÷2.47105 conversion is the
 * kernel's job at fold time; the column only records that it IS a rate).
 * per_liter_water collapses to 'total' because the stored QuantityBasis enum
 * cannot express it and area-rescaling a concentration would corrupt it.
 * Kernel-unknown strings fall back to the per-acre text sniff.
 */
export function resolveVerbatimQuantityBasis(unit: string | null | undefined): QuantityBasis {
  const parsed = parseUnitText(unit);
  if (parsed) return parsed.basis === 'per_acre' ? 'per_acre' : 'total';
  return unitTextSaysPerAcre(unit) ? 'per_acre' : 'total';
}
