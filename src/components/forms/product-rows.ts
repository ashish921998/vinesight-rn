/**
 * Headless core shared by the spray and fertigation product-row forms
 * (issue #208). Both forms are row lists over the same entry shape
 * (name + quantity + unit + basis + provenance ids) and duplicated every
 * piece of row-level machinery; this module owns the logic that is truly
 * form-agnostic. Unit/basis resolution, chip behavior, and all UI chrome
 * stay in the forms — callers express their semantics through the
 * closures they pass in.
 */

/** Both forms cap their row list at ten products. */
export const MAX_PRODUCT_ROWS = 10;

/** The fields the shared row logic reads. Form entries are supersets. */
export interface ProductRowLike {
  name: string;
  quantity?: number;
}

/** A row counts as complete once it has a name and a positive quantity. */
export function isProductRowComplete(row: ProductRowLike): boolean {
  return Boolean(row.name.trim()) && (row.quantity ?? 0) > 0;
}

/** Form-level readiness: at least one row, and every row complete. */
export function allProductRowsComplete(rows: readonly ProductRowLike[]): boolean {
  return rows.length > 0 && rows.every(isProductRowComplete);
}

/**
 * Name-typeahead suggestions: case-insensitive substring match over the
 * quick-add items, alphabetized, capped. Blank queries suggest nothing.
 */
export function filterNameSuggestions<T extends { name: string }>(
  items: readonly T[],
  rawQuery: string,
  limit = 6,
): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  return items
    .filter((item) => item.name.trim().toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Sanitize a quantity keystroke: digits and one decimal point, at most two
 * decimal places. Returns the text to render and the numeric value to store
 * (undefined for an empty field).
 */
export function sanitizeQuantityInput(text: string): {
  text: string;
  quantity: number | undefined;
} {
  const cleanText = text.replace(/[^0-9.]/g, '');
  const parts = cleanText.split('.');
  let sanitizedText = parts[0];
  if (parts.length > 1) {
    sanitizedText += '.' + parts[1].slice(0, 2);
  }
  return {
    text: sanitizedText,
    quantity: sanitizedText === '' ? undefined : parseFloat(sanitizedText),
  };
}

export interface QuickAddOptions<TRow extends ProductRowLike> {
  /** Duplicate detection — the incoming item's identity is closed over. */
  isDuplicate: (row: TRow) => boolean;
  /** Merge the incoming item into the first incomplete row. */
  fillRow: (current: TRow) => TRow;
  /** Build a fresh row for the incoming item. */
  appendRow: () => TRow;
  maxRows?: number;
}

/**
 * The quick-add engine both forms share: skip duplicates, fill the first
 * incomplete row in place, otherwise append while there is capacity.
 * Returns the next row list, or null when nothing should change (duplicate
 * or at capacity) — callers no-op on null instead of emitting an onChange.
 */
export function applyQuickAdd<TRow extends ProductRowLike>(
  rows: readonly TRow[],
  { isDuplicate, fillRow, appendRow, maxRows = MAX_PRODUCT_ROWS }: QuickAddOptions<TRow>,
): TRow[] | null {
  if (rows.some(isDuplicate)) return null;

  const firstIncompleteIndex = rows.findIndex((row) => !isProductRowComplete(row));
  if (firstIncompleteIndex >= 0) {
    const current = rows[firstIncompleteIndex];
    if (!current) return null;
    const next = [...rows];
    next[firstIncompleteIndex] = fillRow(current);
    return next;
  }

  if (rows.length >= maxRows) return null;
  return [...rows, appendRow()];
}
