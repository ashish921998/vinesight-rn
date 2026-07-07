/**
 * Unit tests for the fertilizer composition-dedup identity key (issue #234).
 *
 * The design stance: for fertilizers, product identity is the DECLARED
 * COMPOSITION SET — a quantified difference is the only thing that makes two
 * products distinct. Brand is NOT identity. These tests pin the rule the
 * dedup migration and the seed invariant both rely on, with the exact
 * TANBOR / SEQUEL-Fe / Synergy edge cases the issue calls out.
 */
import { compositionKey, type SeedComposition } from '../scripts/seed-data/fertilizer-catalog-seed';
import type { KnownNutrientCode } from '@/constants/nutrient-definitions';

const comp = (rows: Array<[KnownNutrientCode, number]>): SeedComposition[] =>
  rows.map(([component_code, percent]) => ({ component_code, percent }));

describe('compositionKey (fertilizer identity — issue #234)', () => {
  it('treats brand-differentiated bags of the same grade as identical', () => {
    // Mahadhan 19:19:19, YaraTera 19:19:19, generic 19:19:19 — same NPK set.
    const generic = comp([
      ['N', 19],
      ['P2O5', 19],
      ['K2O', 19],
    ]);
    const branded = comp([
      ['N', 19],
      ['P2O5', 19],
      ['K2O', 19],
    ]);
    expect(compositionKey(branded)).toBe(compositionKey(generic));
  });

  it('is order-independent (a product is a SET, not a sequence)', () => {
    const a = comp([
      ['N', 12],
      ['P2O5', 61],
    ]);
    const b = comp([
      ['P2O5', 61],
      ['N', 12],
    ]);
    expect(compositionKey(a)).toBe(compositionKey(b));
  });

  it('lowercases the nutrient code in the key (canonical bucket)', () => {
    // compositionKey lowercases component_code internally so 'P2O5' becomes
    // 'p2o5' in the key — the same canonical bucket the ledger uses.
    expect(compositionKey(comp([['P2O5', 52]]))).toBe('p2o5=52');
    expect(compositionKey(comp([['K2O', 50]]))).toBe('k2o=50');
  });

  it('distinguishes a quantified micronutrient variant from its base grade', () => {
    // TANBOR = calcium nitrate + declared B 0.2–0.3% → NOT generic calcium
    // nitrate → own row. The issue's headline example: a quantified difference
    // is a different product even when the base grade is shared.
    const calciumNitrate = comp([
      ['N', 15.5],
      ['Ca', 19],
    ]);
    const tanbor = comp([
      ['N', 15.5],
      ['Ca', 19],
      ['B', 0.3],
    ]);
    expect(compositionKey(tanbor)).not.toBe(compositionKey(calciumNitrate));
  });

  it('distinguishes products by chelate form / content (SEQUEL-Fe vs Synergy Plus Fe)', () => {
    // SEQUEL-Fe (Fe 12% EDTA) vs Synergy Plus Fe (Fe 17% HEDP): different
    // content AND chelate form → distinct rows. The percent alone separates
    // them here; the chelate form rides in the product name/composition note.
    const sequel = comp([['Fe', 12]]);
    const synergy = comp([['Fe', 17]]);
    expect(compositionKey(sequel)).not.toBe(compositionKey(synergy));
  });

  it('distinguishes the SOP-with-sulphur set from plain SOP', () => {
    // Generic water-soluble SOP declares K₂O 50% + S ~17.5%. A hypothetical
    // MOP-style 50% K₂O with no sulphur is a different composition set.
    const sop = comp([
      ['K2O', 50],
      ['S', 17.5],
    ]);
    const kcl50 = comp([['K2O', 50]]);
    expect(compositionKey(sop)).not.toBe(compositionKey(kcl50));
  });

  it('distinguishes zinc sulphate grades by percent (33% vs 21% vs 12% Zn)', () => {
    // Mono- vs hepta-hydrate vs chelated — all zinc, all different products.
    const keys = new Set(
      [comp([['Zn', 33]]), comp([['Zn', 21]]), comp([['Zn', 12]])].map((c) => compositionKey(c)),
    );
    expect(keys.size).toBe(3);
  });

  it('produces a stable, human-readable key', () => {
    // The key is the contract — snapshots/debug logs read it. Pin its shape so
    // a refactor doesn't silently change identity across versions.
    expect(compositionKey(comp([['N', 46]]))).toBe('n=46');
    expect(
      compositionKey(
        comp([
          ['K2O', 50],
          ['S', 17.5],
        ]),
      ),
    ).toBe('k2o=50|s=17.5');
  });
});
