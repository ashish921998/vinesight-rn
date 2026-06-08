import type { NutrientCompositionItem, QuantityBasis } from '@/types';

/**
 * Pure mappers that turn the form-side "applied input" rows (spray chemicals,
 * fertigation fertilizers) into the persisted record shape and its presentation
 * strings. Shared by the create path ({@link file://./entry-log-submission.ts})
 * and the edit path (`activity-edit-form.tsx`) so a single, tested transform
 * governs how an applied input is written to the database.
 */

/** A chemical/fertilizer row as held in form state, before persistence. */
export interface AppliedFormItem<U extends string = string> {
  name: string;
  quantity?: number;
  unit: U;
  quantityBasis?: QuantityBasis;
  warehouseItemId?: number | null;
  catalogProductId?: number | null;
  compositionSnapshot?: NutrientCompositionItem[] | null;
  densityKgPerL?: number | null;
}

/** The persisted applied-item shape (spray `chemical_items` / fertigation `fertilizers`). */
export interface MappedAppliedItem<U extends string = string> {
  name: string;
  unit: U;
  quantity: number;
  quantity_basis: QuantityBasis;
  warehouse_item_id: number | null;
  catalog_product_id: number | null;
  composition_snapshot: NutrientCompositionItem[] | null;
  density_kg_per_l: number | null;
}

export interface MapAppliedItemsOptions {
  /**
   * Multiplier applied to `per_acre`-basis quantities to normalize them onto the
   * canonical per-acre unit. Derived from the farm's area unit on the create path
   * (`hectares` -> 0.404686, otherwise 1). Pass `1` to store quantities verbatim
   * (e.g. the edit path, whose form is hydrated from already-normalized values).
   */
  perAreaToPerAcreFactor: number;
}

/**
 * Drops blank/zero rows, normalizes `per_acre` quantities by
 * `perAreaToPerAcreFactor`, and projects each row onto the persisted column
 * names. Generic over the unit type so `ChemicalUnit` / fertilizer units are
 * preserved (not widened to `string`) for the caller's record-insert type.
 */
export function mapAppliedItems<U extends string>(
  items: AppliedFormItem<U>[],
  { perAreaToPerAcreFactor }: MapAppliedItemsOptions,
): MappedAppliedItem<U>[] {
  return items
    .filter((item) => item.name.trim() && item.quantity !== undefined && item.quantity > 0)
    .map((item) => {
      const quantityBasis = item.quantityBasis ?? 'total';
      const quantity =
        quantityBasis === 'per_acre' ? item.quantity! * perAreaToPerAcreFactor : item.quantity!;
      return {
        name: item.name.trim(),
        unit: item.unit,
        quantity,
        quantity_basis: quantityBasis,
        warehouse_item_id: item.warehouseItemId ?? null,
        catalog_product_id: item.catalogProductId ?? null,
        composition_snapshot: item.compositionSnapshot ?? null,
        density_kg_per_l: item.densityKgPerL ?? null,
      };
    });
}

/**
 * Human-readable "Name (qty unit), ..." summary over **all** chemical rows
 * (no filtering — matches the legacy `chemical` column contents).
 */
export function buildChemicalSummary(
  chemicals: { name: string; quantity?: number; unit: string }[],
): string {
  return chemicals.map((c) => `${c.name} (${c.quantity} ${c.unit})`).join(', ');
}

/** The spray `dose` label. */
export function buildWaterDoseString(waterVolumeL: number | null | undefined): string {
  return `Water: ${waterVolumeL}L`;
}
