/**
 * format — farmer-natural rendering of canonical values (plan §2/§5).
 *
 * Scale pick: mass < 1 g → mg, < 1 kg → g, else kg; volume < 1 L → ml, else L.
 * 0.75 kg renders as "750 g", never "0.75 kg". Count has no unit label — the
 * item's own word (pcs/packet/bag) belongs to the caller.
 *
 * Rounding happens here and only here (the pipeline upstream is full
 * precision). Precision is derived from the plan's rendered vectors
 * (11.4 g · 708 ml · 202 ml · 3.43 kg):
 *   - kg / L / count → ≤ 2 trimmed decimals ("3.43 kg", "12 kg")
 *   - mg / g / ml (always < 1000 by construction) → ~3 significant figures:
 *     < 10 → 2 decimals, < 100 → 1 decimal, ≥ 100 → integer
 * so 11.428571… g → "11.4 g" and 708.2009… ml → "708 ml", exactly as §5 shows.
 */

import type { DisplayScale, FormatOptions, FormatParts, Measure } from './types';

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function displayRound(value: number, scale: DisplayScale): number {
  if (scale === 'mg' || scale === 'g' || scale === 'ml') {
    const abs = Math.abs(value);
    if (abs < 10) return roundTo(value, 2);
    if (abs < 100) return roundTo(value, 1);
    return roundTo(value, 0);
  }
  return roundTo(value, 2);
}

/**
 * Pick the farmer-natural display scale for a canonical value (kg / L / count)
 * and return the display-rounded number with it, so the UI can localize the
 * scale label (किलो / ग्रॅम / लिटर / मिली) and render the same figure everywhere.
 */
export function formatParts(value: number, measure: Measure): FormatParts {
  if (!Number.isFinite(value)) {
    // Keep the scale measure-consistent even for garbage input: a non-finite
    // count must not come back labeled "kg" (review finding on #201).
    const scale: DisplayScale = measure === 'count' ? 'count' : measure === 'volume' ? 'L' : 'kg';
    return { value, scale };
  }

  const abs = Math.abs(value);

  if (measure === 'count') return { value: displayRound(value, 'count'), scale: 'count' };

  if (measure === 'mass') {
    if (abs === 0 || abs >= 1) return { value: displayRound(value, 'kg'), scale: 'kg' };
    if (abs >= 0.001) return { value: displayRound(value * 1000, 'g'), scale: 'g' };
    return { value: displayRound(value * 1_000_000, 'mg'), scale: 'mg' };
  }

  // volume
  if (abs === 0 || abs >= 1) return { value: displayRound(value, 'L'), scale: 'L' };
  return { value: displayRound(value * 1000, 'ml'), scale: 'ml' };
}

/**
 * Render a canonical value as a display string, e.g. format(0.75, 'mass') →
 * "750 g". Count values render as a bare number. Pass { approx: true } for
 * derived (multiplied) figures to get the "≈ " prefix — never for values the
 * farmer entered.
 */
export function format(value: number, measure: Measure, opts: FormatOptions = {}): string {
  const parts = formatParts(value, measure);
  const prefix = opts.approx ? '≈ ' : '';
  const label = parts.scale === 'count' ? '' : ` ${parts.scale}`;
  return `${prefix}${parts.value}${label}`;
}
