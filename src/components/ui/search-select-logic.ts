/**
 * Pure logic behind the SearchSelect product picker: option shapes, the emit
 * contract, query normalization/ranking, section assembly, and adapters from
 * domain data (recents, plan items, chemical catalog) to picker options.
 *
 * Kept free of React so ordering/filtering/prefill behavior is unit-testable.
 */
import type { NutrientCompositionItem, QuantityBasis } from '@/types/database';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { ChemicalMix } from '@/types/phi';
import type { MasterCatalogProduct } from '@/types/catalog';
import { normalizeMixComponentToPerLiterDose } from '@/services/phi-service';
import { resolveFertigationPrefill } from '@/constants/fertilizer-units';

// ============================================================
// MARK: - Emit contract
// ============================================================

export interface SearchSelectPrefill {
  quantity?: number | null;
  unit?: string | null;
  quantityBasis?: QuantityBasis;
  /** Catalog PHI pass-through (display only; PHI computation stays mix-based). */
  phiDays?: number | null;
}

/**
 * What SearchSelect emits on every selection.
 *
 * `kind: 'mix'` means the selection IS a whole catalog mix (no single-item
 * prefill; consumers resolve `catalogMixId` and apply all components).
 * `kind: 'item'` selections may still carry a `catalogMixId` (history rows
 * logged as part of a mix): consumers should prefer the whole-mix prefill when
 * the mix is resolvable and fall back to the single-item `prefill` otherwise.
 */
export interface SearchSelectSelection {
  kind: 'item' | 'mix';
  name: string;
  catalogProductId?: number | null;
  warehouseItemId?: number | null;
  planItemId?: string | null;
  catalogMixId?: number | null;
  isCustom: boolean;
  prefill?: SearchSelectPrefill;
  /**
   * Declared nutrient composition of the picked product (catalog fertilizer
   * picks). Consumers stamp it as `composition_snapshot` on the logged item —
   * the same path warehouse picks use — so the nutrient ledger sees
   * catalog-picked items too (issue #200).
   */
  composition?: NutrientCompositionItem[] | null;
}

// ============================================================
// MARK: - Option / section shapes
// ============================================================

export type SearchSelectSectionId = 'history' | 'plan' | 'catalog' | 'custom';

export interface SearchSelectOption {
  /** Stable list key, unique within the picker. */
  key: string;
  /** Primary row text; also what the query is matched against. */
  name: string;
  /** Secondary row text (last dose, prescribed dose, target problem…). */
  detail?: string | null;
  /** Extra matchable strings (active ingredients, mix component names…). */
  keywords?: string[];
  selection: SearchSelectSelection;
}

export interface SearchSelectSection {
  id: SearchSelectSectionId;
  options: SearchSelectOption[];
}

// ============================================================
// MARK: - Matching & ranking
// ============================================================

/**
 * Case/whitespace-tolerant normalization that works for Latin and Devanagari:
 * NFC unifies composed/decomposed Devanagari forms, lowercase handles Latin
 * (a no-op for Devanagari), and inner whitespace collapses to single spaces.
 * `:` and `-` fold to spaces so NPK-grade spellings converge — a query of
 * "19:19:19" must match a "19-19-19" option (and vice versa, issue #196).
 */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/[:-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Prefix > token-prefix > substring, per field. 0 = no match. */
function fieldScore(haystack: string, normalizedQuery: string): number {
  const value = normalizeSearchText(haystack);
  if (!value) return 0;
  if (value.startsWith(normalizedQuery)) return 3;
  if (value.split(' ').some((token) => token.startsWith(normalizedQuery))) return 2;
  if (value.includes(normalizedQuery)) return 1;
  return 0;
}

/**
 * Name matches always outrank keyword matches; within each, prefix beats
 * substring. Returns 0 when nothing matches.
 */
export function scoreOption(option: SearchSelectOption, normalizedQuery: string): number {
  const nameScore = fieldScore(option.name, normalizedQuery);
  if (nameScore > 0) return nameScore * 10;
  let best = 0;
  for (const keyword of option.keywords ?? []) {
    const score = fieldScore(keyword, normalizedQuery);
    if (score > best) best = score;
  }
  return best;
}

/** Filters to matching options, ranked by score (stable for ties). */
export function filterAndRankOptions(
  options: SearchSelectOption[],
  query: string,
): SearchSelectOption[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return options;
  return options
    .map((option, index) => ({ option, index, score: scoreOption(option, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.option);
}

// ============================================================
// MARK: - Section assembly
// ============================================================

export interface BuildSearchSelectSectionsInput {
  query: string;
  history?: SearchSelectOption[];
  plan?: SearchSelectOption[];
  catalog?: SearchSelectOption[];
  /** When true (default) a trailing "Add '<query>' as custom" row is appended. */
  allowCustom?: boolean;
}

/** The always-available escape hatch: logs the typed name with no identity. */
export function customOptionForQuery(query: string): SearchSelectOption {
  const name = query.replace(/\s+/g, ' ').trim();
  return {
    key: 'custom',
    name,
    selection: { kind: 'item', name, isCustom: true },
  };
}

/**
 * Sections in priority order — history, plan items, catalog — each filtered by
 * the query and dropped entirely when empty, plus the custom escape-hatch row
 * whenever the query is non-empty. Custom never depends on network or catalog
 * state, so logging is never blocked.
 */
export function buildSearchSelectSections(
  input: BuildSearchSelectSectionsInput,
): SearchSelectSection[] {
  const sections: SearchSelectSection[] = [];
  const append = (id: SearchSelectSectionId, options: SearchSelectOption[] | undefined) => {
    const filtered = filterAndRankOptions(options ?? [], input.query);
    if (filtered.length > 0) sections.push({ id, options: filtered });
  };
  append('history', input.history);
  append('plan', input.plan);
  append('catalog', input.catalog);
  if ((input.allowCustom ?? true) && normalizeSearchText(input.query)) {
    sections.push({ id: 'custom', options: [customOptionForQuery(input.query)] });
  }
  return sections;
}

// ============================================================
// MARK: - Domain adapters
// ============================================================

function formatDoseDetail(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  const unitText = unit?.trim() ?? '';
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    return unitText ? `${quantity} ${unitText}` : String(quantity);
  }
  return unitText || null;
}

export interface RecentItemsToOptionsConfig {
  /** Localized marker appended to rows that restore a whole mix ("Mix"/"मिश्रण"). */
  mixLabel?: string;
}

/**
 * History rows: name + last dose, fully prefilled selection carrying identity.
 * Rows logged as part of a catalog mix carry `catalogMixId` so tapping them can
 * restore the whole mix (record-level mix identity), with the single-item
 * prefill as offline/missing-mix fallback.
 */
/**
 * Stable per-item key that survives list reordering/filtering. Distinct
 * prefixes (`p`/`w`/`n`) keep the id-space and name-space from colliding.
 * Uniqueness within one recents list is guaranteed upstream by
 * `dedupeRecentItems` (use-records.ts): identity rows are deduped by
 * catalogProductId / warehouseItemId, identityless rows by name::unit.
 */
function recentItemKey(item: RecentInputItem): string {
  if (item.catalogProductId != null) return `history:p${item.catalogProductId}`;
  if (item.warehouseItemId != null) return `history:w${item.warehouseItemId}`;
  return `history:n${item.name}::${item.unit}`;
}

export function recentItemsToOptions(
  items: RecentInputItem[],
  config?: RecentItemsToOptionsConfig,
): SearchSelectOption[] {
  return items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => {
      const dose = formatDoseDetail(item.quantity, item.unit);
      const detail =
        [dose, item.catalogMixId != null ? config?.mixLabel : null]
          .filter((part): part is string => Boolean(part))
          .join(' · ') || null;
      return {
        key: recentItemKey(item),
        name: item.name,
        detail,
        selection: {
          kind: 'item' as const,
          name: item.name,
          catalogProductId: item.catalogProductId ?? null,
          warehouseItemId: item.warehouseItemId ?? null,
          catalogMixId: item.catalogMixId ?? null,
          isCustom: false,
          prefill: {
            quantity: item.quantity ?? null,
            unit: item.unit,
            quantityBasis: item.quantityBasis,
          },
        },
      };
    });
}

/**
 * Active plan items: prescribed dose shown, selection stamps `planItemId`.
 * This is how a consultant's custom (non-catalog) prescription reaches the
 * farmer's picker verbatim.
 *
 * Quantity is prefilled only when the item carries a unit AND a positive
 * finite quantity: without a unit the form would fall back to its default
 * ('gm/L'), silently changing the prescribed meaning of the number, and a
 * zero/negative quantity would create a row that instantly fails the form's
 * `quantity > 0` validation. The unit alone still prefills when present.
 */
export function planItemsToOptions(items: FertilizerPlanItem[]): SearchSelectOption[] {
  return items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => {
      const unit = item.unit?.trim() ? item.unit : null;
      const quantity =
        unit != null &&
        typeof item.quantity === 'number' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : null;
      return {
        key: `plan:${item.id}`,
        name: item.name,
        detail: formatDoseDetail(item.quantity, item.unit),
        selection: {
          kind: 'item' as const,
          name: item.name,
          planItemId: item.id,
          isCustom: false,
          prefill: { quantity, unit },
        },
      };
    });
}

/**
 * Active plan items for the FERTIGATION picker. Unlike the generic
 * `planItemsToOptions`, the prefill goes through `resolveFertigationPrefill`:
 * plan doses are per-acre rates by contract, so form-representable units keep
 * per_acre even when spelled bare (`'kg'` ≡ `'kg/acre'` on a plan item), and
 * verbatim/unknown units are never coerced to kg (issue #192). Selecting a row
 * stamps `planItemId` on the logged fertigation item.
 */
export function fertigationPlanItemsToOptions(items: FertilizerPlanItem[]): SearchSelectOption[] {
  return items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => {
      const prefill = resolveFertigationPrefill(item.unit);
      const quantity =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
          ? item.quantity
          : null;
      return {
        key: `plan:${item.id}`,
        name: item.name,
        detail: formatDoseDetail(item.quantity, item.unit),
        selection: {
          kind: 'item' as const,
          name: item.name,
          planItemId: item.id,
          isCustom: false,
          prefill: {
            quantity,
            unit: prefill.unit,
            quantityBasis: prefill.quantityBasis,
          },
        },
      };
    });
}

/**
 * Map a catalog product's declared compositions onto the stored
 * `composition_snapshot` shape. Only `nutrient` rows qualify — active
 * ingredients / other component types are not nutrient declarations and must
 * not enter the nutrient ledger. Returns null when nothing qualifies so
 * consumers stamp the same "no composition" value legacy items carry.
 */
export function catalogCompositionToSnapshot(
  product: MasterCatalogProduct,
): NutrientCompositionItem[] | null {
  const rows = (product.compositions ?? [])
    .filter((composition) => composition.component_type === 'nutrient')
    .map((composition) => ({
      nutrient_code: composition.component_code,
      percent: composition.percent,
      basis: 'declared' as const,
    }));
  return rows.length > 0 ? rows : null;
}

/**
 * Fertilizer catalog section (master `chemical_products` rows): selecting a
 * row stores the CANONICAL catalog name verbatim — that string-level
 * convergence is the contract until plan items grow a product id (Phase W) —
 * plus `catalogProductId` and the declared nutrient composition where present.
 * Aliases/active ingredient/manufacturer are matchable but never stored.
 * No dose prefill: the catalog carries no dose.
 */
export function fertilizerCatalogToOptions(products: MasterCatalogProduct[]): SearchSelectOption[] {
  return products
    .filter((product) => product.name.trim().length > 0)
    .map((product) => {
      const keywords = [
        ...(product.aliases ?? []).map((alias) => alias.alias),
        product.active_ingredient ?? '',
        product.manufacturer ?? '',
      ].filter((keyword) => keyword.length > 0);
      return {
        key: `product:${product.id}`,
        name: product.name,
        detail:
          [product.manufacturer, product.active_ingredient]
            .filter((part): part is string => Boolean(part))
            .join(' · ') || null,
        keywords: keywords.length > 0 ? keywords : undefined,
        selection: {
          kind: 'item' as const,
          name: product.name,
          catalogProductId: product.id,
          isCustom: false,
          composition: catalogCompositionToSnapshot(product),
        },
      };
    });
}

/** A past plan item as fetched for the org's prescription history. */
export interface OrgPlanHistoryItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * Consultant plan authoring's history section ("what you prescribe often"):
 * distinct product names across the org's past plan items, newest first.
 * Dedupe uses `normalizeSearchText`, so separator spellings collapse too —
 * one row for "19:19:19"/"19-19-19", keeping the most recent spelling and
 * dose. Selections carry no identity (plan items are strings by contract);
 * the last prescribed dose rides along as prefill.
 */
export function orgPlanHistoryToOptions(items: OrgPlanHistoryItem[]): SearchSelectOption[] {
  const seen = new Set<string>();
  const options: SearchSelectOption[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const dedupeKey = normalizeSearchText(name);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
        ? item.quantity
        : null;
    options.push({
      key: `org:${dedupeKey}`,
      name,
      detail: formatDoseDetail(item.quantity, item.unit),
      selection: {
        kind: 'item',
        name,
        isCustom: false,
        prefill: { quantity, unit: item.unit ?? null },
      },
    });
  }
  return options;
}

export interface ChemicalCatalogToOptionsConfig {
  /** When false only mixes are offered (e.g. catalog-only delegated logging). */
  includeProducts?: boolean;
}

/**
 * Catalog section: mixes first (selection = whole mix), then the distinct
 * products appearing across mix components, prefilled with their label dose
 * normalized to per-liter (matching how `applyCatalogMix` fills rows) and PHI
 * pass-through where verified.
 */
export function chemicalCatalogToOptions(
  mixes: ChemicalMix[],
  config?: ChemicalCatalogToOptionsConfig,
): SearchSelectOption[] {
  const mixOptions = mixes.map((mix) => ({
    key: `mix:${mix.id}`,
    name: mix.name,
    detail: mix.target_problem ?? null,
    keywords: mix.components
      .flatMap((component) => [component.product_name, component.active_ingredient ?? ''])
      .filter((keyword) => keyword.length > 0),
    selection: {
      kind: 'mix' as const,
      name: mix.name,
      catalogMixId: mix.id,
      isCustom: false,
    },
  }));

  if (config?.includeProducts === false) return mixOptions;

  const seenProductIds = new Set<number>();
  const productOptions: SearchSelectOption[] = [];
  for (const mix of mixes) {
    for (const component of mix.components) {
      if (seenProductIds.has(component.product_id)) continue;
      seenProductIds.add(component.product_id);
      const perLiter = normalizeMixComponentToPerLiterDose(component);
      const labelDose = perLiter
        ? { quantity: Number(perLiter.quantity.toFixed(4)), unit: perLiter.unit }
        : null;
      productOptions.push({
        key: `product:${component.product_id}`,
        name: component.product_name,
        detail: labelDose
          ? `${labelDose.quantity} ${labelDose.unit}`
          : (component.active_ingredient ?? null),
        keywords: component.active_ingredient ? [component.active_ingredient] : undefined,
        selection: {
          kind: 'item' as const,
          name: component.product_name,
          catalogProductId: component.product_id,
          isCustom: false,
          prefill: {
            // Per-liter label doses are concentration-style: basis 'total'
            // with the concentration carried by the unit string, exactly as
            // applyCatalogMix stores mix components today.
            quantity: labelDose?.quantity ?? null,
            unit: labelDose?.unit ?? null,
            quantityBasis: labelDose ? 'total' : undefined,
            phiDays: component.phi_days ?? null,
          },
        },
      });
    }
  }
  return [...mixOptions, ...productOptions];
}
