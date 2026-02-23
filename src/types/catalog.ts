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

export interface MasterCatalogProduct {
  id: number;
  name: string;
  manufacturer?: string | null;
  active_ingredient?: string | null;
  input_type: CatalogInputType;
  verification_tier: CatalogVerificationTier;
  formulation?: string | null;
  state_code: string;
  source_reference?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  aliases?: MasterCatalogProductAlias[];
  compositions?: MasterCatalogProductComposition[];
}
