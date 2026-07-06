/**
 * Seed-data validation for fertilizer recommended-dose guidance (issue #236).
 * Guards the invariants the prefill + range guardrail depend on: every entry
 * references a real catalog product, ranges are valid (min ≤ max > 0), units are
 * canonical (kernel-parseable), and there are no duplicate (product, route) rows.
 */
import { parseUnit } from '@/lib/quantity';
import {
  FERTILIZER_CATALOG_SEED,
  SEED_STATE_CODE,
} from '../scripts/seed-data/fertilizer-catalog-seed';
import {
  FERTILIZER_DOSE_GUIDANCE_SEED,
  SEED_DOSE_GUIDANCE_SOURCE_NOTE,
  SEED_DOSE_GUIDANCE_STATE_CODE,
} from '../scripts/seed-data/fertilizer-dose-guidance-seed';

const CATALOG_NAMES = new Set(FERTILIZER_CATALOG_SEED.map((product) => product.name.toLowerCase()));

describe('fertilizer dose-guidance seed data (issue #236)', () => {
  it('seeds a meaningful set of rows (the layer is optional, but non-empty)', () => {
    expect(FERTILIZER_DOSE_GUIDANCE_SEED.length).toBeGreaterThanOrEqual(15);
  });

  it('references only catalog products that actually exist', () => {
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      expect(CATALOG_NAMES.has(seed.productName.toLowerCase())).toBe(true);
    }
  });

  it('keeps every range valid: min > 0 and max >= min', () => {
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      expect(seed.minValue).toBeGreaterThan(0);
      expect(seed.maxValue).toBeGreaterThanOrEqual(seed.minValue);
    }
  });

  it('uses only canonical units the quantity kernel parses (g/L, kg/ha)', () => {
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      const parsed = parseUnit(seed.unit);
      if (parsed === null) {
        throw new Error(`unit '${seed.unit}' for ${seed.productName} is not kernel-parseable`);
      }
    }
  });

  it('has no duplicate (product, route) rows', () => {
    const keys = FERTILIZER_DOSE_GUIDANCE_SEED.map(
      (seed) => `${seed.productName.toLowerCase()}:${seed.applicationRoute}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses the shared state + provenance marker (grape-belt MH, advisory-not-regulatory)', () => {
    expect(SEED_DOSE_GUIDANCE_STATE_CODE).toBe(SEED_STATE_CODE);
    expect(SEED_DOSE_GUIDANCE_SOURCE_NOTE).toContain('advisory');
    // The marker explicitly disclaims regulatory semantics — the word "regulatory"
    // appears only as the negation "not regulatory", never as a claim.
    expect(SEED_DOSE_GUIDANCE_SOURCE_NOTE).toContain('not regulatory');
  });

  it('names every entry non-empty and routes to the allowed enum', () => {
    const routes = new Set(['foliar', 'drip', 'soil']);
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      expect(seed.productName.trim().length).toBeGreaterThan(0);
      expect(routes.has(seed.applicationRoute)).toBe(true);
    }
  });

  it('keeps applications-per-month (when present) a positive integer', () => {
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      if (seed.applicationsPerMonth !== undefined) {
        expect(Number.isInteger(seed.applicationsPerMonth)).toBe(true);
        expect(seed.applicationsPerMonth).toBeGreaterThan(0);
      }
    }
  });
});
