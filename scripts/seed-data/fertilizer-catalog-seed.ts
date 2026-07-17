/**
 * Fertilizer catalog seed source (units plan §10 Q7 — "Fertilizer catalog is a
 * seeding gap, not a schema gap"; dedup refined in issue #234).
 *
 * One row per DECLARED COMPOSITION SET — for fertilizers, product identity is
 * the quantified nutrient content, nothing else (issue #234 design stance).
 * Brand is NOT identity: a branded bag whose guaranteed analysis matches a
 * generic grade is the same product. Where a real label deviates from the round
 * grade, the exact number rides in `note`. A quantified difference (e.g. TANBOR
 * = calcium nitrate + declared B 0.2–0.3%) is a distinct product even when it
 * shares a base grade — the composition-set key (not the grade string) decides.
 *
 * Branded names that previously had their own rows survive as `aliases` on the
 * generic — search keywords only (typing "yara" finds MAP), never identity.
 *
 * Every entry SHIPS a composition — the nutrient ledger (§5) is identity-bound,
 * so a catalog fertilizer with no composition would be picked yet contribute
 * nothing. Grades are grounded in `WAREHOUSE_PRESETS` (nutrient-presets.ts, the
 * ready-made branded seed source) plus standard FCO fertilizer grades (urea
 * 46-0-0, MAP 12-61-0, SOP 0-0-50, …).
 *
 * Pure data — no Supabase/Deno imports — so it is importable by both the Node
 * seed runner (`scripts/seed-fertilizer-catalog.ts`) and Jest validation tests.
 * The runner is idempotent by product identity: (state_code, lower(name)),
 * mirroring the `chemical_products_state_name_unique` index. All rows are
 * marked `verification_tier: 'provisional'` and `verified: false` — seeded from
 * published grades, not lab-verified.
 */
import type { KnownNutrientCode } from '@/constants/nutrient-definitions';

/** A declared nutrient row for `chemical_product_compositions`. */
export interface SeedComposition {
  /** One of NUTRIENT_CODES; oxide codes (P2O5/K2O/…) convert to elemental downstream. */
  component_code: KnownNutrientCode;
  /** Declared guaranteed-analysis percentage (0..100). */
  percent: number;
  /** Optional provenance note when the label deviates from the round grade. */
  note?: string;
}

/** Published bulk density for a product sold or measured by volume. */
export interface SeedBulkDensity {
  densityKgPerL: number;
  sourceUrl: string;
}

/** A `chemical_products` row plus its nutrient compositions. */
export interface SeedDensityPatch {
  density_kg_per_l?: number | null;
  density_source_url?: string | null;
  density_verified?: false;
}

export function buildSeedDensityPatch(
  product: Pick<FertilizerSeedProduct, 'bulkDensity'>,
  preserveVerifiedDensity: boolean,
): SeedDensityPatch {
  if (preserveVerifiedDensity) return {};
  return {
    density_kg_per_l: product.bulkDensity?.densityKgPerL ?? null,
    density_source_url: product.bulkDensity?.sourceUrl ?? null,
    density_verified: false,
  };
}

export interface FertilizerSeedProduct {
  /**
   * Canonical product name — the string stamped verbatim on logged items until
   * plan items grow a product id (Phase W). Unique within a state (case-insensitive).
   */
  name: string;
  manufacturer: string;
  /** Grade shorthand (e.g. "46-0-0"), stored as `active_ingredient` for search. */
  grade: string | null;
  compositions: SeedComposition[];
  /** Omit when no reliable, product-specific published value is available. */
  bulkDensity?: SeedBulkDensity;
  /**
   * Brand/trade strings that previously had their own product rows but whose
   * declared composition matches this generic (issue #234). Survive as search
   * aliases on this row — typing the brand finds the generic — never identity.
   * Written to `chemical_product_aliases` (alias_kind='trade') by the seeder.
   */
  aliases?: string[];
}

/**
 * Stable identity key for a fertilizer product: its declared composition set,
 * case-insensitive on nutrient code and sorted so row order doesn't matter.
 * Two products with the same key are the SAME fertilizer (issue #234) — brand
 * is not identity. A quantified difference (different code or percent) yields a
 * different key, which is why TANBOR (Ca + B 0.3%) ≠ plain calcium nitrate.
 */
export function compositionKey(compositions: SeedComposition[]): string {
  return compositions
    .map((composition) => `${composition.component_code.toLowerCase()}=${composition.percent}`)
    .sort()
    .join('|');
}

/** Convenience: an N-P₂O₅-K₂O grade in one call (skips zero components). */
function npk(
  n: number,
  p2o5: number,
  k2o: number,
  extra: SeedComposition[] = [],
): SeedComposition[] {
  const rows: SeedComposition[] = [];
  if (n > 0) rows.push({ component_code: 'N', percent: n });
  if (p2o5 > 0) rows.push({ component_code: 'P2O5', percent: p2o5 });
  if (k2o > 0) rows.push({ component_code: 'K2O', percent: k2o });
  return [...rows, ...extra];
}

/**
 * The seed set. Grades follow Indian FCO guaranteed-analysis (the numbers on the
 * bag) — water-soluble fertigation grades first, then straights/soil grades,
 * then micronutrient staples. One row per declared composition set (issue #234):
 * a brand whose guaranteed analysis matches a generic is folded into it and
 * kept as an `aliases` keyword — the farmer can still type the brand they buy,
 * but the catalog (and thus the ledger) is brand-agnostic.
 */
export const FERTILIZER_CATALOG_SEED: FertilizerSeedProduct[] = [
  // ── Water-soluble NPK fertigation grades ──────────────────────────────────
  {
    name: 'NPK 19:19:19',
    manufacturer: 'Generic FCO Grade',
    grade: '19-19-19',
    compositions: npk(19, 19, 19),
    aliases: ['Mahadhan 19:19:19'],
  },
  {
    name: 'NPK 20:20:20',
    manufacturer: 'Generic FCO Grade',
    grade: '20-20-20',
    compositions: npk(20, 20, 20),
    aliases: ['Vanita Aditya 20:20:20'],
  },
  {
    name: 'NPK 12:61:00 (MAP)',
    manufacturer: 'Generic FCO Grade',
    grade: '12-61-0',
    // Mono-ammonium phosphate — the standard fertigation MAP grade.
    compositions: npk(12, 61, 0),
    aliases: ['Mahadhan 12:61:00', 'YaraTera Krista MAP 12:61:00'],
  },
  {
    name: 'NPK 13:40:13',
    manufacturer: 'Generic FCO Grade',
    grade: '13-40-13',
    compositions: npk(13, 40, 13),
  },
  {
    name: 'NPK 00:52:34 (MKP)',
    manufacturer: 'Generic FCO Grade',
    grade: '0-52-34',
    // Mono-potassium phosphate.
    compositions: npk(0, 52, 34),
    bulkDensity: {
      densityKgPerL: 1.2,
      sourceUrl: 'https://www.haifa-group.com/haifa-mkp',
    },
    aliases: ['Mahadhan 00:52:34', 'YaraTera Krista MKP 00:52:34'],
  },
  {
    name: 'NPK 13:00:45 (KNO3)',
    manufacturer: 'Generic FCO Grade',
    grade: '13-0-45',
    // Potassium nitrate.
    compositions: npk(13, 0, 45),
    bulkDensity: {
      densityKgPerL: 1.1,
      sourceUrl: 'https://www.haifa-group.com/files/Products/Haifa_Group_Catlog.pdf',
    },
    aliases: ['YaraTera Krista K Plus 13:00:45'],
  },
  {
    name: 'NPK 00:00:50 (SOP)',
    manufacturer: 'Generic FCO Grade',
    grade: '0-0-50',
    // Sulphate of potash — soluble grade also carries ~17.5% S.
    compositions: [
      { component_code: 'K2O', percent: 50 },
      { component_code: 'S', percent: 17.5, note: 'Soluble SOP typically declares ~17-18% S' },
    ],
    aliases: ['Vanita Aditya 00:00:50 (SOP)'],
  },
  {
    name: 'NPK 00:60:20',
    manufacturer: 'Generic FCO Grade',
    grade: '0-60-20',
    compositions: npk(0, 60, 20),
  },
  {
    name: 'NPK 16:08:24',
    manufacturer: 'Generic FCO Grade',
    grade: '16-8-24',
    compositions: npk(16, 8, 24),
  },
  {
    name: 'NPK 13:05:26',
    manufacturer: 'Generic FCO Grade',
    grade: '13-5-26',
    compositions: npk(13, 5, 26),
  },
  {
    name: 'NPK 24:24:00',
    manufacturer: 'Generic FCO Grade',
    grade: '24-24-0',
    // Common ammonium-phosphate basal grade (Mahadhan SMART/Power-type).
    compositions: npk(24, 24, 0),
  },
  {
    name: 'NPK 16:16:16',
    manufacturer: 'Generic FCO Grade',
    grade: '16-16-16',
    compositions: npk(16, 16, 16),
  },

  // ── Nitrogen straights ────────────────────────────────────────────────────
  {
    name: 'Urea',
    manufacturer: 'Generic FCO Grade',
    grade: '46-0-0',
    // The canonical replacement for the typed "Urea" string (Q7).
    compositions: npk(46, 0, 0),
    bulkDensity: {
      densityKgPerL: 0.75,
      sourceUrl:
        'https://www.yara.com/siteassets/health-safety-and-environment/factory-to-field.pdf',
    },
  },
  {
    name: 'Ammonium Sulphate',
    manufacturer: 'Generic FCO Grade',
    grade: '20.5-0-0',
    // 21% N nominal; 20.5% N + 23-24% S is the standard declared analysis.
    compositions: [
      { component_code: 'N', percent: 20.5 },
      { component_code: 'S', percent: 23 },
    ],
  },
  {
    name: 'Calcium Nitrate',
    manufacturer: 'Generic FCO Grade',
    grade: '15.5-0-0',
    // Calcium ammonium nitrate (Calcinit-type): 15.5% N + 19% Ca.
    compositions: [
      { component_code: 'N', percent: 15.5 },
      { component_code: 'Ca', percent: 19 },
    ],
    bulkDensity: {
      densityKgPerL: 1.1,
      sourceUrl: 'https://www.haifa-group.com/haifa-cal%E2%84%A2-ng',
    },
    aliases: ['YaraTera Calcinit'],
  },
  {
    name: 'CAN (Calcium Ammonium Nitrate)',
    manufacturer: 'Generic FCO Grade',
    grade: '26-0-0',
    // Soil-grade CAN: 26% N (half nitrate, half ammoniacal) + ~10% Ca.
    compositions: [
      { component_code: 'N', percent: 26 },
      { component_code: 'Ca', percent: 10, note: 'Ca varies 8-11% by source; 10% typical' },
    ],
    bulkDensity: {
      densityKgPerL: 1.05,
      sourceUrl:
        'https://www.yara.com/siteassets/health-safety-and-environment/factory-to-field.pdf',
    },
  },

  // ── Phosphate straights / soil grades ─────────────────────────────────────
  {
    name: 'DAP (Di-Ammonium Phosphate)',
    manufacturer: 'Generic FCO Grade',
    grade: '18-46-0',
    compositions: npk(18, 46, 0),
    aliases: ['Mahadhan DAP'],
  },
  {
    name: 'SSP (Single Super Phosphate)',
    manufacturer: 'Generic FCO Grade',
    grade: '0-16-0',
    // 16% P₂O₅ + 11% S + 21% Ca — SSP's sulphur/calcium is why growers pick it.
    compositions: [
      { component_code: 'P2O5', percent: 16 },
      { component_code: 'S', percent: 11 },
      { component_code: 'Ca', percent: 21 },
    ],
  },

  // ── Potash straights / soil grades ────────────────────────────────────────
  {
    name: 'MOP (Muriate of Potash)',
    manufacturer: 'Generic FCO Grade',
    grade: '0-0-60',
    // Potassium chloride — the standard 60% K₂O soil potash.
    compositions: [
      { component_code: 'K2O', percent: 60 },
      { component_code: 'Cl', percent: 46, note: 'KCl is ~46-47% chloride' },
    ],
  },
  {
    name: 'Potassium Schoenite',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Sulphate of potash magnesia — K₂O + MgO + S.
    compositions: [
      { component_code: 'K2O', percent: 23 },
      { component_code: 'MgO', percent: 18 },
      { component_code: 'S', percent: 20 },
    ],
  },

  // ── Secondary-nutrient / calcium-magnesium-sulphur staples ────────────────
  {
    name: 'Magnesium Sulphate (Epsom Salt)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // MgSO₄·7H₂O: 9.5% Mg (≈16% MgO) + 12% S.
    compositions: [
      { component_code: 'MgO', percent: 16 },
      { component_code: 'S', percent: 12 },
    ],
  },
  {
    name: 'Bentonite Sulphur (90% S)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'S', percent: 90, note: '90% S + 10% bentonite carrier' }],
  },
  {
    name: 'Calcium Nitrate + Boron',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Calcium nitrate with boron — common set/skin-quality feed on grapes.
    compositions: [
      { component_code: 'N', percent: 15.5 },
      { component_code: 'Ca', percent: 18 },
      { component_code: 'B', percent: 0.3, note: 'Boron typically 0.2-0.3%' },
    ],
  },

  // ── Micronutrient staples (chelated + sulphate forms) ─────────────────────
  {
    name: 'Zinc Sulphate (33%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Zinc sulphate monohydrate — FCO 33% Zn grade.
    compositions: [{ component_code: 'Zn', percent: 33 }],
  },
  {
    name: 'Zinc Sulphate (21%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Zinc sulphate heptahydrate — FCO 21% Zn grade.
    compositions: [{ component_code: 'Zn', percent: 21 }],
  },
  {
    name: 'Chelated Zinc (Zn-EDTA 12%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'Zn', percent: 12 }],
  },
  {
    name: 'Chelated Iron (Fe-EDTA 12%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'Fe', percent: 12 }],
  },
  {
    name: 'Ferrous Sulphate (19%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Ferrous sulphate heptahydrate — FCO 19% Fe grade.
    compositions: [{ component_code: 'Fe', percent: 19 }],
  },
  {
    name: 'Boron (20%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Disodium octaborate / borax-derived soluble boron — FCO 20% B grade.
    compositions: [{ component_code: 'B', percent: 20 }],
  },
  {
    name: 'Chelated Manganese (Mn-EDTA 12%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'Mn', percent: 12 }],
  },
  {
    name: 'Manganese Sulphate (30.5%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'Mn', percent: 30.5 }],
  },
  {
    name: 'Copper Sulphate (24%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Copper sulphate pentahydrate — FCO 24% Cu grade.
    compositions: [
      { component_code: 'Cu', percent: 24 },
      { component_code: 'S', percent: 12, note: 'Pentahydrate carries ~12-12.8% S' },
    ],
  },
  {
    name: 'Borax (10.5%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // Sodium tetraborate decahydrate — FCO 10.5% B grade.
    compositions: [{ component_code: 'B', percent: 10.5 }],
  },
  {
    name: 'Boric Acid (17%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // FCO 17% B grade.
    compositions: [{ component_code: 'B', percent: 17 }],
  },
  {
    name: 'Ammonium Molybdate (52%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    // FCO 52% Mo grade — the only Mo source commonly sold as a straight.
    compositions: [{ component_code: 'Mo', percent: 52 }],
  },
  // HEDP-chelate forms are distinct products from the EDTA forms (#234
  // identity rule: different chelate form / percent = different product).
  // Grades per Vanita Agro Synergy Plus labels (reviewed 2026-07-06).
  {
    name: 'Chelated Iron (Fe-HEDP 17%)',
    manufacturer: 'Generic Grade',
    grade: null,
    compositions: [{ component_code: 'Fe', percent: 17 }],
  },
  {
    name: 'Chelated Zinc (Zn-HEDP 17%)',
    manufacturer: 'Generic Grade',
    grade: null,
    compositions: [{ component_code: 'Zn', percent: 17 }],
  },
  {
    name: 'Chelated Copper (Cu-EDTA 12%)',
    manufacturer: 'Generic FCO Grade',
    grade: null,
    compositions: [{ component_code: 'Cu', percent: 12 }],
  },

  // ── Branded grades removed (issue #234) ────────────────────────────────────
  // Branded bags (Mahadhan / YaraTera / Vanita) whose declared composition
  // matched a generic grade were collapsed INTO that generic and now survive
  // only as `aliases` above — typing the brand still finds the product, but the
  // catalog models one row per composition set. Live rows previously seeded
  // under these brand names are deactivated by the catalog dedup migration
  // (supabase/migrations/20260707120000_fertilizer_catalog_dedup.sql) and by
  // the seeder's convergence step on re-run.
];

/** Shared state for all seeded rows — Maharashtra grape belt. */
export const SEED_STATE_CODE = 'MH';

/** Provenance stamped on every product: published grades, not lab-verified. */
export const SEED_SOURCE_REFERENCE = 'units-plan-q7-seed:published-fco-grades';

/** Provenance stamped on every composition row. */
export const SEED_COMPOSITION_SOURCE_NOTE =
  'Declared guaranteed-analysis grade (published/FCO); not lab-verified.';
