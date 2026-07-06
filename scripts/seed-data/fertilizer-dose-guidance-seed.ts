/**
 * Recommended-dose guidance seed (issue #236 — the Annexure-5 analogue for
 * fertilizers, MINUS THE LAW).
 *
 * Optional agronomic dose rows for the ~42 seeded fertilizer products where a
 * manufacturer label publishes a foliar / drip range. Purely advisory — never
 * regulatory, never blocks (testimony rule). Null is fine: products without a
 * published range are simply omitted, and every consumer treats the layer as
 * optional.
 *
 * Pure data — no Supabase/Deno imports — so it is importable by both the Node
 * seed runner (`scripts/seed-fertilizer-dose-guidance.ts`) and Jest validation
 * tests. The runner resolves each entry to a `chemical_products` row by
 * (state_code, lower(name)) and is idempotent per (product, application_route).
 *
 * SOURCES (verified 2026-07-06 across Vanita Agro / Yara / Mahadhan labels and
 * ICAR NRC for Grapes agronomy bulletins — grape-belt Maharashtra ranges):
 *   - Water-soluble NPK foliar: 3–6 g/L (Vanita ADITYA, Mahadhan, Yara labels).
 *   - MKP / KNO3 foliar: 1–2.5 g/L (lower — high solubility / salt index).
 *   - MAP foliar: 2–5 g/L.
 *   - Micronutrient foliar: per FCO/label (Zn-EDTA 0.5–1 g/L, B 1–1.5 g/L, …).
 *   - Drip rates: 1.25–2.5 kg/ha per application (canonical kg/ha — the kernel
 *     folds ÷2.47105 → kg/acre at the read boundary; the farmer sees per-acre).
 *
 * All values are advisory and region-scoped (Maharashtra grape belt). A real
 * consultant/plan overrides them; this is the floor of "no dose knowledge".
 */
import type { DoseApplicationRoute } from '@/types/catalog';

/** A `chemical_product_dose_guidance` row, keyed by product name for the runner. */
export interface FertilizerDoseGuidanceSeed {
  /** Canonical product name — MUST match a `FERTILIZER_CATALOG_SEED` entry verbatim. */
  productName: string;
  applicationRoute: DoseApplicationRoute;
  minValue: number;
  maxValue: number;
  /** Canonical unit spelling the quantity kernel parses: 'g/L', 'kg/ha'. */
  unit: string;
  applicationsPerMonth?: number;
  /** Per-row provenance note appended to SEED_DOSE_GUIDANCE_SOURCE_NOTE. */
  sourceNoteSuffix?: string;
}

/**
 * The seed set. Only products with a PUBLISHED label range appear — the rest
 * stay null (the layer is optional by design). Foliar rows are what the picker
 * prefills (midpoint) and the range guardrail checks against.
 */
export const FERTILIZER_DOSE_GUIDANCE_SEED: FertilizerDoseGuidanceSeed[] = [
  // ── Water-soluble NPK foliar (3–6 g/L is the universal label range) ─────────
  {
    productName: 'NPK 19:19:19',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 20:20:20',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 13:40:13',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 16:08:24',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 13:05:26',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 16:16:16',
    applicationRoute: 'foliar',
    minValue: 3,
    maxValue: 6,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },

  // ── MAP / MKP / KNO3 — lower foliar ranges (salt index / solubility) ────────
  {
    productName: 'NPK 12:61:00 (MAP)',
    applicationRoute: 'foliar',
    minValue: 2,
    maxValue: 5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 00:52:34 (MKP)',
    applicationRoute: 'foliar',
    minValue: 1,
    maxValue: 2.5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'NPK 13:00:45 (KNO3)',
    applicationRoute: 'foliar',
    minValue: 1,
    maxValue: 2.5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },

  // ── Potash straights ────────────────────────────────────────────────────────
  {
    productName: 'NPK 00:00:50 (SOP)',
    applicationRoute: 'foliar',
    minValue: 2,
    maxValue: 5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },

  // ── Drip ranges for the high-volume fertigation grades (1.25–2.5 kg/ha) ─────
  {
    productName: 'NPK 19:19:19',
    applicationRoute: 'drip',
    minValue: 1.25,
    maxValue: 2.5,
    unit: 'kg/ha',
  },
  {
    productName: 'NPK 13:00:45 (KNO3)',
    applicationRoute: 'drip',
    minValue: 1.25,
    maxValue: 2.5,
    unit: 'kg/ha',
  },
  {
    productName: 'Calcium Nitrate',
    applicationRoute: 'drip',
    minValue: 1.25,
    maxValue: 2.5,
    unit: 'kg/ha',
  },

  // ── Micronutrient foliar (per FCO / label — tight ranges) ───────────────────
  {
    productName: 'Chelated Zinc (Zn-EDTA 12%)',
    applicationRoute: 'foliar',
    minValue: 0.5,
    maxValue: 1,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Chelated Iron (Fe-EDTA 12%)',
    applicationRoute: 'foliar',
    minValue: 0.5,
    maxValue: 1,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Chelated Manganese (Mn-EDTA 12%)',
    applicationRoute: 'foliar',
    minValue: 0.5,
    maxValue: 1,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Zinc Sulphate (33%)',
    applicationRoute: 'foliar',
    minValue: 2,
    maxValue: 5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Zinc Sulphate (21%)',
    applicationRoute: 'foliar',
    minValue: 2,
    maxValue: 5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Ferrous Sulphate (19%)',
    applicationRoute: 'foliar',
    minValue: 2,
    maxValue: 5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Boron (20%)',
    applicationRoute: 'foliar',
    minValue: 1,
    maxValue: 1.5,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },
  {
    productName: 'Copper Sulphate (24%)',
    applicationRoute: 'foliar',
    minValue: 1,
    maxValue: 2,
    unit: 'g/L',
    applicationsPerMonth: 1,
  },

  // ── Secondary nutrients ─────────────────────────────────────────────────────
  {
    productName: 'Magnesium Sulphate (Epsom Salt)',
    applicationRoute: 'foliar',
    minValue: 5,
    maxValue: 10,
    unit: 'g/L',
    applicationsPerMonth: 2,
  },

  // NO branded rows by design: #234/#239 collapse branded fertilizer products
  // into their generic grades (brand = alias, not identity), so guidance keyed
  // to a branded name would dangle after that cleanup. Every branded label
  // range above is identical to its generic grade's row, which already covers
  // it (brand picks resolve to the generic product id).
];

/** Shared state for all seeded rows — Maharashtra grape belt (matches the catalog seed). */
export const SEED_DOSE_GUIDANCE_STATE_CODE = 'MH';

/** Provenance stamped on every dose-guidance row: advisory, not regulatory. */
export const SEED_DOSE_GUIDANCE_SOURCE_NOTE =
  'Manufacturer label recommended dose (published); advisory, not regulatory.';

/** Revision date for this seed batch (the label-verification pass, 2026-07-06). */
export const SEED_DOSE_GUIDANCE_REVISION_DATE = '2026-07-06';
