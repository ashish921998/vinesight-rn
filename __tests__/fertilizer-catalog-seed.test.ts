/**
 * Seed-data validation for the fertilizer catalog (units plan §10 Q7). Guards
 * the invariants the nutrient ledger (§5) depends on: every product carries a
 * composition, every code is a known nutrient, percentages are valid and sum
 * sensibly, and no two products share an identity (state + lower(name)).
 */
import {
  NUTRIENT_CODES,
  OXIDE_TO_ELEMENTAL_FACTORS,
  normalizeNutrientCode,
  sanitizeComposition,
} from '@/constants/nutrient-definitions';
import {
  FERTILIZER_CATALOG_SEED,
  SEED_STATE_CODE,
  type SeedComposition,
} from '../scripts/seed-data/fertilizer-catalog-seed';

const KNOWN_CODES = new Set<string>(NUTRIENT_CODES);

describe('fertilizer catalog seed data', () => {
  it('seeds a meaningful catalog (~40 products) with the expected shared state', () => {
    // The plan asks for ~40 common fertigation products; guard the floor so a
    // regression that drops entries is caught.
    expect(FERTILIZER_CATALOG_SEED.length).toBeGreaterThanOrEqual(40);
    expect(SEED_STATE_CODE).toBe('MH');
  });

  it('covers the full micronutrient tier — Fe, Zn, Mn, Cu, B, Mo each have a source (issue #235)', () => {
    // "You applied 0 g of Zn this season" is only tellable if a Zn product a
    // farmer can pick exists with a composition. Guard every tier element.
    const seededCodes = new Set(
      FERTILIZER_CATALOG_SEED.flatMap((product) =>
        product.compositions.map((composition) => composition.component_code),
      ),
    );
    for (const element of ['Fe', 'Zn', 'Mn', 'Cu', 'B', 'Mo']) {
      expect(seededCodes.has(element as SeedComposition['component_code'])).toBe(true);
    }
    // Salt + chelate forms are distinct products (#234 identity rule): at
    // least two independent B sources and two chelate chemistries for Zn/Fe.
    const names = FERTILIZER_CATALOG_SEED.map((product) => product.name.toLowerCase());
    expect(names.some((name) => name.includes('borax'))).toBe(true);
    expect(names.some((name) => name.includes('boric acid'))).toBe(true);
    expect(names.some((name) => name.includes('molybdate'))).toBe(true);
    expect(names.some((name) => name.includes('zn-hedp'))).toBe(true);
    expect(names.some((name) => name.includes('fe-hedp'))).toBe(true);
    expect(names.some((name) => name.includes('cu-edta'))).toBe(true);
  });

  it('gives every product at least one composition row — the whole point of Q7', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      expect(product.compositions.length).toBeGreaterThan(0);
    }
  });

  it('uses only known nutrient codes so the ledger recognises every row', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      for (const composition of product.compositions) {
        expect(KNOWN_CODES.has(composition.component_code)).toBe(true);
      }
    }
  });

  it('keeps every declared percentage a finite number in (0, 100]', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      for (const composition of product.compositions) {
        expect(Number.isFinite(composition.percent)).toBe(true);
        expect(composition.percent).toBeGreaterThan(0);
        expect(composition.percent).toBeLessThanOrEqual(100);
      }
    }
  });

  it('survives the app-side sanitizer unchanged (units are ledger-valid)', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      const asItems = product.compositions.map((composition: SeedComposition) => ({
        nutrient_code: composition.component_code,
        percent: composition.percent,
      }));
      // sanitizeComposition drops any invalid row; a valid seed loses nothing.
      expect(sanitizeComposition(asItems)).toHaveLength(product.compositions.length);
    }
  });

  it('resolves every sanitized code in the ledger — oxide factor hit or known elemental', () => {
    // The ledger looks codes up POST-sanitize (uppercased). A code that is
    // neither an OXIDE_TO_ELEMENTAL_FACTORS key nor a known elemental in that
    // form silently falls back to factor 1 under an unconverted bucket —
    // exactly how 'MgO' once overstated Mg ~1.66× when the map was mixed-case.
    const elementalCodes = new Set(
      NUTRIENT_CODES.filter((code) => !(code in { P2O5: 1, K2O: 1, CaO: 1, MgO: 1, SO3: 1 })).map(
        (code) => normalizeNutrientCode(code),
      ),
    );
    for (const product of FERTILIZER_CATALOG_SEED) {
      for (const composition of product.compositions) {
        const sanitized = normalizeNutrientCode(composition.component_code);
        const resolves = sanitized in OXIDE_TO_ELEMENTAL_FACTORS || elementalCodes.has(sanitized);
        if (!resolves) {
          throw new Error(
            `${product.name}: code '${composition.component_code}' (sanitized '${sanitized}') ` +
              'resolves to neither an oxide conversion nor a known elemental — the ledger would ' +
              'silently apply factor 1',
          );
        }
      }
    }
  });

  it('sums each product to a sensible total — positive, and within salt double-counting reality', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      const total = product.compositions.reduce((sum, composition) => sum + composition.percent, 0);
      expect(total).toBeGreaterThan(0);
      // Declared totals can legitimately exceed 100% because oxide forms
      // (P₂O₅/K₂O/MgO) over-count vs elemental mass and salts declare both the
      // cation-oxide and its anion — e.g. MOP is 60% K₂O + 46% Cl = 106%. What
      // is NOT physical is a straight salt declaring far past its molecular
      // mass, so cap at 150% to catch a fat-fingered grade.
      expect(total).toBeLessThanOrEqual(150);
    }
  });

  it('declares no duplicate nutrient code within a single product', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      const codes = product.compositions.map((composition) => composition.component_code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('gives every product of the same grade an identical composition set (brand-agnostic)', () => {
    // The header comment promises multiple brands per grade carry the same
    // composition so the nutrient ledger is brand-agnostic — enforce it.
    const byGrade = new Map<string, { name: string; key: string }[]>();
    for (const product of FERTILIZER_CATALOG_SEED) {
      // Null grades are straights/micronutrients — distinct products, exempt.
      if (product.grade == null) continue;
      const key = product.compositions
        .map((composition) => `${composition.component_code.toLowerCase()}=${composition.percent}`)
        .sort()
        .join('|');
      const entries = byGrade.get(product.grade) ?? [];
      entries.push({ name: product.name, key });
      byGrade.set(product.grade, entries);
    }
    for (const [grade, entries] of byGrade) {
      const keys = new Set(entries.map((entry) => entry.key));
      if (keys.size > 1) {
        throw new Error(
          `grade ${grade} has diverging compositions: ${entries
            .map((entry) => `${entry.name} → ${entry.key}`)
            .join(' ; ')}`,
        );
      }
    }
  });

  it('has no duplicate product identity (state + lower(name))', () => {
    const identities = FERTILIZER_CATALOG_SEED.map(
      (product) => `${SEED_STATE_CODE}:${product.name.toLowerCase()}`,
    );
    expect(new Set(identities).size).toBe(identities.length);
  });

  it('names every product non-empty and free of leading/trailing whitespace', () => {
    for (const product of FERTILIZER_CATALOG_SEED) {
      expect(product.name.trim().length).toBeGreaterThan(0);
      expect(product.name).toBe(product.name.trim());
      expect(product.manufacturer.trim().length).toBeGreaterThan(0);
    }
  });
});
