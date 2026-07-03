/**
 * Headless product-row core shared by the spray and fertigation forms
 * (issue #208). The forms' own suites cover their composed behavior; this
 * pins the engine semantics both rely on.
 */

import {
  MAX_PRODUCT_ROWS,
  allProductRowsComplete,
  applyQuickAdd,
  filterNameSuggestions,
  isProductRowComplete,
  sanitizeQuantityInput,
} from '@/components/forms/product-rows';

interface Row {
  name: string;
  quantity?: number;
  unit: string;
}

const row = (name: string, quantity?: number, unit = 'kg'): Row => ({ name, quantity, unit });

describe('isProductRowComplete / allProductRowsComplete', () => {
  it('requires a non-blank name and a positive quantity', () => {
    expect(isProductRowComplete(row('Urea', 5))).toBe(true);
    expect(isProductRowComplete(row('', 5))).toBe(false);
    expect(isProductRowComplete(row('   ', 5))).toBe(false);
    expect(isProductRowComplete(row('Urea', 0))).toBe(false);
    expect(isProductRowComplete(row('Urea', undefined))).toBe(false);
  });

  it('form readiness needs at least one row and all rows complete', () => {
    expect(allProductRowsComplete([])).toBe(false);
    expect(allProductRowsComplete([row('Urea', 5)])).toBe(true);
    expect(allProductRowsComplete([row('Urea', 5), row('', undefined)])).toBe(false);
  });
});

describe('filterNameSuggestions', () => {
  const items = [row('Zinc sulphate'), row('Urea'), row('Copper oxychloride'), row('urea plus')];

  it('matches case-insensitive substrings, alphabetized', () => {
    expect(filterNameSuggestions(items, 'ure').map((i) => i.name)).toEqual(['Urea', 'urea plus']);
    expect(filterNameSuggestions(items, ' COPPER ').map((i) => i.name)).toEqual([
      'Copper oxychloride',
    ]);
  });

  it('blank queries suggest nothing; the cap holds', () => {
    expect(filterNameSuggestions(items, '   ')).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => row(`Urea ${i}`));
    expect(filterNameSuggestions(many, 'urea')).toHaveLength(6);
  });
});

describe('sanitizeQuantityInput', () => {
  it('keeps digits and one decimal point, capping at two decimals', () => {
    expect(sanitizeQuantityInput('12.345')).toEqual({ text: '12.34', quantity: 12.34 });
    expect(sanitizeQuantityInput('1a2b.5c')).toEqual({ text: '12.5', quantity: 12.5 });
    expect(sanitizeQuantityInput('')).toEqual({ text: '', quantity: undefined });
    expect(sanitizeQuantityInput('abc')).toEqual({ text: '', quantity: undefined });
  });
});

describe('applyQuickAdd', () => {
  const opts = (name: string) => ({
    isDuplicate: (r: Row) => r.name === name,
    fillRow: (current: Row) => ({ ...current, name, quantity: 1 }),
    appendRow: () => row(name, 1),
  });

  it('returns null for duplicates — caller must not emit a change', () => {
    expect(applyQuickAdd([row('Urea', 5)], opts('Urea'))).toBeNull();
  });

  it('fills the first incomplete row in place', () => {
    const rows = [row('Urea', 5), row('', undefined), row('', undefined)];
    const next = applyQuickAdd(rows, opts('Zinc'));
    expect(next?.map((r) => r.name)).toEqual(['Urea', 'Zinc', '']);
    expect(rows[1].name).toBe(''); // input untouched
  });

  it('appends when every row is complete and capacity remains', () => {
    const next = applyQuickAdd([row('Urea', 5)], opts('Zinc'));
    expect(next?.map((r) => r.name)).toEqual(['Urea', 'Zinc']);
  });

  it('returns null at capacity', () => {
    const full = Array.from({ length: MAX_PRODUCT_ROWS }, (_, i) => row(`P${i}`, 1));
    expect(applyQuickAdd(full, opts('Zinc'))).toBeNull();
    expect(applyQuickAdd(full.slice(0, 2), { ...opts('Zinc'), maxRows: 2 })).toBeNull();
  });

  it('an incomplete row is filled even at capacity (fill wins over append)', () => {
    const full = [
      ...Array.from({ length: MAX_PRODUCT_ROWS - 1 }, (_, i) => row(`P${i}`, 1)),
      row('', undefined),
    ];
    const next = applyQuickAdd(full, opts('Zinc'));
    expect(next?.[MAX_PRODUCT_ROWS - 1].name).toBe('Zinc');
  });
});
