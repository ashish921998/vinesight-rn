#!/usr/bin/env node
/**
 * Idempotent seeder for the fertilizer catalog (units plan §10 Q7).
 *
 * Upserts every product in `scripts/seed-data/fertilizer-catalog-seed.ts` into
 * `chemical_products` (input_type='fertilizer') plus its declared nutrient rows
 * into `chemical_product_compositions`. Identity is (state_code, lower(name)) —
 * the `chemical_products_state_name_unique` index — so re-running never dupes.
 *
 * DRY-RUN BY DEFAULT: prints the plan and touches nothing. Pass `--write` to
 * apply. Writes use a service-role Supabase client (RLS grants authenticated
 * SELECT only; writes are service-role per the catalog migration's security
 * model), configured from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Run (Node ≥ 22.18 strips the TypeScript natively):
 *   node --env-file=.env scripts/seed-fertilizer-catalog.ts            # dry run
 *   node --env-file=.env scripts/seed-fertilizer-catalog.ts --write    # apply
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FERTILIZER_CATALOG_SEED,
  SEED_COMPOSITION_SOURCE_NOTE,
  SEED_SOURCE_REFERENCE,
  SEED_STATE_CODE,
  type FertilizerSeedProduct,
} from './seed-data/fertilizer-catalog-seed.ts';

const WRITE = process.argv.includes('--write');

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

function log(message: string): void {
  console.log(message);
}

/** Existing row shape we read back for identity resolution. */
interface ExistingProductRow {
  id: number;
  name: string;
  verification_tier: string | null;
  source_reference: string | null;
}

/**
 * Same ownership rule as compositions, one level up: the seeder may only
 * rewrite product rows it created (seed source_reference) that are still
 * provisional. A curated production row — human-upgraded tier, or one another
 * writer created under the same (state, name) identity — wins over the seed:
 * touching it would reset manufacturer/tier/is_active to provisional values.
 */
function seederOwnsProduct(row: ExistingProductRow): boolean {
  return (
    row.verification_tier === 'provisional' &&
    (row.source_reference ?? '').startsWith(SEED_SOURCE_REFERENCE)
  );
}

type ProductResolution = { id: number; action: 'inserted' | 'updated' | 'skipped' };

/**
 * Ensure a product row exists (by state + lower(name)) and return its id.
 * Seed-owned rows get their descriptive fields refreshed so corrections
 * propagate; curated/foreign rows are left untouched (action 'skipped').
 */
async function upsertProduct(
  supabase: SupabaseClient,
  product: FertilizerSeedProduct,
  existingByLowerName: Map<string, ExistingProductRow>,
): Promise<ProductResolution> {
  const row = {
    name: product.name,
    manufacturer: product.manufacturer,
    active_ingredient: product.grade,
    input_type: 'fertilizer',
    verification_tier: 'provisional',
    state_code: SEED_STATE_CODE,
    source_reference: SEED_SOURCE_REFERENCE,
    is_active: true,
  };

  const existing = existingByLowerName.get(product.name.toLowerCase());
  if (existing) {
    if (!seederOwnsProduct(existing)) {
      return { id: existing.id, action: 'skipped' };
    }
    const { error } = await supabase
      .from('chemical_products')
      .update(row)
      .eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, action: 'updated' };
  }

  const { data, error } = await supabase
    .from('chemical_products')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return { id: (data as { id: number }).id, action: 'inserted' };
}

/**
 * Sync the product's nutrient compositions. The unique index is the EXPRESSION
 * index (product_id, lower(component_code), basis), which PostgREST's
 * onConflict column list cannot target (Postgres won't infer an expression
 * index from raw column names) — an upsert would fail on the very first write.
 * So: read the product's existing 'declared' rows, then update matches (keyed
 * on lower(component_code)) and insert the rest. Re-runs stay idempotent and
 * grade corrections land.
 */
async function syncCompositions(
  supabase: SupabaseClient,
  productId: number,
  product: FertilizerSeedProduct,
): Promise<void> {
  const { data: existingRows, error: fetchError } = await supabase
    .from('chemical_product_compositions')
    .select('id, component_code, verified, source_note')
    .eq('product_id', productId)
    .eq('basis', 'declared');
  if (fetchError) throw fetchError;

  type ExistingCompositionRow = {
    id: number;
    component_code: string;
    verified: boolean | null;
    source_note: string | null;
  };
  const existing = (existingRows ?? []) as ExistingCompositionRow[];
  const existingByCode = new Map(existing.map((row) => [row.component_code.toLowerCase(), row]));
  // Ownership rule, applied to UPDATE and DELETE alike: the seeder may only
  // touch rows it wrote (seed source-note marker) that no human has verified.
  // Without the verified guard a re-run would silently downgrade a reviewed
  // composition back to provisional seed data.
  const seederOwns = (row: ExistingCompositionRow): boolean =>
    row.verified !== true && (row.source_note ?? '').startsWith(SEED_COMPOSITION_SOURCE_NOTE);

  // A grade correction can DROP a component between seed revisions; without a
  // delete the stale row keeps feeding the nutrient ledger.
  const seedCodes = new Set(
    product.compositions.map((composition) => composition.component_code.toLowerCase()),
  );
  const staleSeedRowIds = existing
    .filter((row) => !seedCodes.has(row.component_code.toLowerCase()) && seederOwns(row))
    .map((row) => row.id);
  if (staleSeedRowIds.length > 0) {
    const { error } = await supabase
      .from('chemical_product_compositions')
      .delete()
      .in('id', staleSeedRowIds);
    if (error) throw error;
  }

  for (const composition of product.compositions) {
    const row = {
      product_id: productId,
      component_code: composition.component_code,
      component_type: 'nutrient',
      percent: composition.percent,
      basis: 'declared',
      verified: false,
      source_note: composition.note
        ? `${SEED_COMPOSITION_SOURCE_NOTE} ${composition.note}`
        : SEED_COMPOSITION_SOURCE_NOTE,
    };
    const existingRow = existingByCode.get(composition.component_code.toLowerCase());
    if (existingRow != null) {
      // Verified or foreign rows win over the seed — skip, never downgrade.
      if (!seederOwns(existingRow)) continue;
      const { error } = await supabase
        .from('chemical_product_compositions')
        .update(row)
        .eq('id', existingRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('chemical_product_compositions').insert(row);
      if (error) throw error;
    }
  }
}

async function main(): Promise<void> {
  const productCount = FERTILIZER_CATALOG_SEED.length;
  const compositionCount = FERTILIZER_CATALOG_SEED.reduce(
    (sum, product) => sum + product.compositions.length,
    0,
  );

  log(
    `Fertilizer catalog seed — ${productCount} products, ${compositionCount} composition rows ` +
      `(state ${SEED_STATE_CODE}).`,
  );

  if (!WRITE) {
    log('DRY RUN (no --write): nothing will be written. Planned rows:');
    for (const product of FERTILIZER_CATALOG_SEED) {
      const grade = product.compositions
        .map((composition) => `${composition.component_code} ${composition.percent}%`)
        .join(', ');
      log(`  • ${product.name} [${product.manufacturer}] → ${grade}`);
    }
    log('Re-run with --write to apply.');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to --write. ' +
        'Provide them via the environment (e.g. node --env-file=.env …).',
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One read resolves every identity up front, so the write loop never dupes.
  // Ownership fields ride along so curated/foreign rows can be skipped whole.
  const { data: existingRows, error: fetchError } = await supabase
    .from('chemical_products')
    .select('id,name,verification_tier,source_reference')
    .eq('state_code', SEED_STATE_CODE)
    .eq('input_type', 'fertilizer');
  if (fetchError) throw fetchError;

  const existingByLowerName = new Map<string, ExistingProductRow>();
  for (const existing of (existingRows ?? []) as ExistingProductRow[]) {
    existingByLowerName.set(existing.name.toLowerCase(), existing);
  }

  const counts = { inserted: 0, updated: 0, skipped: 0 };
  for (const product of FERTILIZER_CATALOG_SEED) {
    const resolution = await upsertProduct(supabase, product, existingByLowerName);
    if (resolution.action === 'skipped') {
      // Not seed-owned: leave its compositions alone too — a curated product's
      // nutrient rows are exactly what the skip is protecting.
      counts.skipped += 1;
      log(`  skipped (curated, not seed-owned): ${product.name} (#${resolution.id})`);
      continue;
    }
    await syncCompositions(supabase, resolution.id, product);
    counts[resolution.action] += 1;
    log(`  ${resolution.action}: ${product.name} (#${resolution.id})`);
  }

  log(
    `Done. Inserted ${counts.inserted}, updated ${counts.updated}, skipped ${counts.skipped} (curated).`,
  );
}

main().catch((error: unknown) => {
  // Writes are per-row (no client-side transaction in supabase-js); a mid-run
  // failure leaves a partial but valid state that the next --write converges.
  console.error('Seed failed (safe to re-run --write to converge):', error);
  process.exit(1);
});
