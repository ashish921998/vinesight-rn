export type CatalogInputType = 'spray' | 'fertilizer' | 'biostimulant' | 'adjuvant' | 'other';
export type CatalogVerificationTier = 'verified' | 'provisional';
export type CatalogAliasKind = 'trade' | 'ocr' | 'common' | 'legacy';
export type CatalogComponentType = 'nutrient' | 'active_ingredient' | 'other';
export type CatalogMappingStatus = 'mapped_verified' | 'mapped_provisional' | 'unmapped';
export type CatalogMappingSource = 'manual' | 'preset' | 'auto';

export interface MasterCatalogProductAlias {
  id: number;
  product_id: number;
  alias: string;
  locale: string;
  alias_kind: CatalogAliasKind;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MasterCatalogProductComposition {
  id: number;
  product_id: number;
  component_code: string;
  component_type: CatalogComponentType;
  percent: number;
  basis: string;
  verified: boolean;
  source_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Application route for a recommended-dose row. Foliar guidance carries a
 * per_liter_water concentration (canonical g/L); drip/soil guidance carries a
 * per_acre rate (canonical kg/ha — the kernel folds ÷2.47105 → kg/acre at the
 * read boundary). Issue #236.
 */
export type DoseApplicationRoute = 'foliar' | 'drip' | 'soil';

/**
 * Optional agronomic recommended-dose guidance for one product + route
 * (issue #236). Advisory only — never regulatory. The picker prefills the
 * foliar midpoint (plan item > last-used > recommendation) and the magnitude
 * guardrail fires a 2×-outside-the-range warning against this range.
 *
 * Provenance discipline mirrors compositions (source_note marker) and the
 * label-claim layer (source_url + effective window + review_status), but there
 * is NO compliance semantics here — review_status is editorial, not legal.
 */
export interface CatalogDoseGuidance {
  applicationRoute: DoseApplicationRoute;
  /** Lower bound of the recommended range, in `unit` canonical units (>0). */
  minValue: number;
  /** Upper bound of the recommended range (>= minValue). */
  maxValue: number;
  /** Canonical unit spelling the quantity kernel parses: 'g/L', 'kg/ha'. */
  unit: string;
  /** Optional label frequency ("1–2 sprays/month" → 2). */
  applicationsPerMonth?: number | null;
  /** Provenance marker (seeder ownership-rule keys on the prefix). */
  sourceNote: string;
  /** Label / manufacturer-site URL. */
  sourceUrl?: string | null;
}

export interface MasterCatalogProduct {
  id: number;
  name: string;
  manufacturer?: string | null;
  active_ingredient?: string | null;
  input_type: CatalogInputType;
  verification_tier: CatalogVerificationTier;
  formulation?: string | null;
  /** Optional manufacturer/published bulk density for volume-based purchases. */
  density_kg_per_l?: number | null;
  density_source_url?: string | null;
  density_verified?: boolean;
  state_code: string;
  source_reference?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  aliases?: MasterCatalogProductAlias[];
  compositions?: MasterCatalogProductComposition[];
  /** Optional recommended-dose rows (0..N, one per route). Null/missing = no guidance. */
  doseGuidance?: CatalogDoseGuidance[] | null;
}
