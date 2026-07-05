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
}

/**
 * Ensure a product row exists (by state + lower(name)) and return its id.
 * Updates the mutable descriptive fields on re-run so corrections propagate
 * without ever creating a duplicate identity.
 */
async function upsertProduct(
  supabase: SupabaseClient,
  product: FertilizerSeedProduct,
  existingByLowerName: Map<string, ExistingProductRow>,
): Promise<number> {
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
    const { error } = await supabase
      .from('chemical_products')
      .update(row)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('chemical_products')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: number }).id;
}

/**
 * Upsert the product's nutrient compositions. The unique index is
 * (product_id, lower(component_code), basis) — all rows use basis 'declared' —
 * so onConflict upsert makes re-runs idempotent and lets grade corrections land.
 */
async function upsertCompositions(
  supabase: SupabaseClient,
  productId: number,
  product: FertilizerSeedProduct,
): Promise<void> {
  const rows = product.compositions.map((composition) => ({
    product_id: productId,
    component_code: composition.component_code,
    component_type: 'nutrient',
    percent: composition.percent,
    basis: 'declared',
    verified: false,
    source_note: composition.note
      ? `${SEED_COMPOSITION_SOURCE_NOTE} ${composition.note}`
      : SEED_COMPOSITION_SOURCE_NOTE,
  }));

  const { error } = await supabase
    .from('chemical_product_compositions')
    .upsert(rows, { onConflict: 'product_id,component_code,basis' });
  if (error) throw error;
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
  const { data: existingRows, error: fetchError } = await supabase
    .from('chemical_products')
    .select('id,name')
    .eq('state_code', SEED_STATE_CODE)
    .eq('input_type', 'fertilizer');
  if (fetchError) throw fetchError;

  const existingByLowerName = new Map<string, ExistingProductRow>();
  for (const existing of (existingRows ?? []) as ExistingProductRow[]) {
    existingByLowerName.set(existing.name.toLowerCase(), existing);
  }

  let inserted = 0;
  let updated = 0;
  for (const product of FERTILIZER_CATALOG_SEED) {
    const isUpdate = existingByLowerName.has(product.name.toLowerCase());
    const productId = await upsertProduct(supabase, product, existingByLowerName);
    await upsertCompositions(supabase, productId, product);
    if (isUpdate) updated += 1;
    else inserted += 1;
    log(`  ${isUpdate ? 'updated' : 'inserted'}: ${product.name} (#${productId})`);
  }

  log(`Done. Inserted ${inserted}, updated ${updated}, ${compositionCount} composition rows synced.`);
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
