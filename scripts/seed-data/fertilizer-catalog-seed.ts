/**
 * Fertilizer catalog seed source (units plan §10 Q7 — "Fertilizer catalog is a
 * seeding gap, not a schema gap").
 *
 * ~40 common Indian fertigation products as `chemical_products` rows
 * (input_type='fertilizer') plus their declared nutrient compositions as
 * `chemical_product_compositions` rows (component_type='nutrient'). Every entry
 * SHIPS a composition — that is the whole point: the nutrient ledger (§5) is
 * identity-bound, so a catalog fertilizer with no composition would be picked
 * yet contribute nothing. Grades are grounded in `WAREHOUSE_PRESETS`
 * (nutrient-presets.ts, the ready-made branded seed source) plus standard FCO
 * fertilizer grades (urea 46-0-0, MAP 12-61-0, SOP 0-0-50, …). Where a real
 * label deviates from the round grade, the exact number rides in `note`.
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

/** A `chemical_products` row plus its nutrient compositions. */
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
}

/** Convenience: an N-P₂O₅-K₂O grade in one call (skips zero components). */
function npk(n: number, p2o5: number, k2o: number, extra: SeedComposition[] = []): SeedComposition[] {
  const rows: SeedComposition[] = [];
  if (n > 0) rows.push({ component_code: 'N', percent: n });
  if (p2o5 > 0) rows.push({ component_code: 'P2O5', percent: p2o5 });
  if (k2o > 0) rows.push({ component_code: 'K2O', percent: k2o });
  return [...rows, ...extra];
}

/**
 * The seed set. Grades follow Indian FCO guaranteed-analysis (the numbers on the
 * bag) — water-soluble fertigation grades first, then straights/soil grades,
 * then micronutrient staples. Multiple brands per grade are intentional: farmers
 * type the brand they buy, and each carries the same composition so the ledger
 * is brand-agnostic.
 */
export const FERTILIZER_CATALOG_SEED: FertilizerSeedProduct[] = [
  // ── Water-soluble NPK fertigation grades ──────────────────────────────────
  {
    name: 'NPK 19:19:19',
    manufacturer: 'Generic FCO Grade',
    grade: '19-19-19',
    compositions: npk(19, 19, 19),
  },
  {
    name: 'NPK 20:20:20',
    manufacturer: 'Generic FCO Grade',
    grade: '20-20-20',
    compositions: npk(20, 20, 20),
  },
  {
    name: 'NPK 12:61:00 (MAP)',
    manufacturer: 'Generic FCO Grade',
    grade: '12-61-0',
    // Mono-ammonium phosphate — the standard fertigation MAP grade.
    compositions: npk(12, 61, 0),
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
  },
  {
    name: 'NPK 13:00:45 (KNO3)',
    manufacturer: 'Generic FCO Grade',
    grade: '13-0-45',
    // Potassium nitrate.
    compositions: npk(13, 0, 45),
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
  },

  // ── Phosphate straights / soil grades ─────────────────────────────────────
  {
    name: 'DAP (Di-Ammonium Phosphate)',
    manufacturer: 'Generic FCO Grade',
    grade: '18-46-0',
    compositions: npk(18, 46, 0),
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
    compositions: [{ component_code: 'Cu', percent: 24 }],
  },

  // ── Branded grades (from WAREHOUSE_PRESETS — the offline fallback source) ──
  {
    name: 'Mahadhan 19:19:19',
    manufacturer: 'Deepak Fertilisers (Mahadhan)',
    grade: '19-19-19',
    compositions: npk(19, 19, 19),
  },
  {
    name: 'Mahadhan 12:61:00',
    manufacturer: 'Deepak Fertilisers (Mahadhan)',
    grade: '12-61-0',
    compositions: npk(12, 61, 0),
  },
  {
    name: 'Mahadhan 00:52:34',
    manufacturer: 'Deepak Fertilisers (Mahadhan)',
    grade: '0-52-34',
    compositions: npk(0, 52, 34),
  },
  {
    name: 'Mahadhan DAP',
    manufacturer: 'Deepak Fertilisers (Mahadhan)',
    grade: '18-46-0',
    compositions: npk(18, 46, 0),
  },
  {
    name: 'YaraTera Krista MAP 12:61:00',
    manufacturer: 'Yara India',
    grade: '12-61-0',
    compositions: npk(12, 61, 0),
  },
  {
    name: 'YaraTera Krista K Plus 13:00:45',
    manufacturer: 'Yara India',
    grade: '13-0-45',
    compositions: npk(13, 0, 45),
  },
  {
    name: 'YaraTera Krista MKP 00:52:34',
    manufacturer: 'Yara India',
    grade: '0-52-34',
    compositions: npk(0, 52, 34),
  },
  {
    name: 'YaraTera Calcinit',
    manufacturer: 'Yara India',
    grade: null,
    // Calcium ammonium nitrate — 15.5% N + 19% Ca.
    compositions: [
      { component_code: 'N', percent: 15.5 },
      { component_code: 'Ca', percent: 19 },
    ],
  },
  {
    name: 'Vanita Aditya 20:20:20',
    manufacturer: 'Vanita Agro',
    grade: '20-20-20',
    compositions: npk(20, 20, 20),
  },
  {
    name: 'Vanita Aditya 00:00:50 (SOP)',
    manufacturer: 'Vanita Agro',
    grade: '0-0-50',
    compositions: npk(0, 0, 50),
  },
];

/** Shared state for all seeded rows — Maharashtra grape belt. */
export const SEED_STATE_CODE = 'MH';

/** Provenance stamped on every product: published grades, not lab-verified. */
export const SEED_SOURCE_REFERENCE = 'units-plan-q7-seed:published-fco-grades';

/** Provenance stamped on every composition row. */
export const SEED_COMPOSITION_SOURCE_NOTE =
  'Declared guaranteed-analysis grade (published/FCO); not lab-verified.';
