#!/usr/bin/env node
/**
 * Idempotent seeder for fertilizer recommended-dose guidance (issue #236).
 *
 * Upserts every entry in `scripts/seed-data/fertilizer-dose-guidance-seed.ts`
 * into `chemical_product_dose_guidance`, resolved to a `chemical_products` row
 * by (state_code, lower(name)). One active row per (product, application_route)
 * — the table's partial unique index enforces it. Null is fine: products
 * without a published range are simply never seeded, and every consumer treats
 * the layer as optional.
 *
 * DRY-RUN BY DEFAULT: prints the plan and touches nothing. Pass `--write` to
 * apply. Writes use a service-role Supabase client (RLS grants authenticated
 * SELECT only), configured from SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Ownership rule (mirrors the composition seeder): the seeder may only rewrite
 * rows it created (seed source-note marker) that are still `provisional`. A
 * curated/verified row wins over the seed — touching it would reset a reviewed
 * range back to provisional values.
 *
 * Run (Node ≥ 22.18 strips the TypeScript natively):
 *   node --env-file=.env scripts/seed-fertilizer-dose-guidance.ts            # dry run
 *   node --env-file=.env scripts/seed-fertilizer-dose-guidance.ts --write    # apply
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FERTILIZER_DOSE_GUIDANCE_SEED,
  SEED_DOSE_GUIDANCE_REVISION_DATE,
  SEED_DOSE_GUIDANCE_SOURCE_NOTE,
  SEED_DOSE_GUIDANCE_STATE_CODE,
  type FertilizerDoseGuidanceSeed,
} from './seed-data/fertilizer-dose-guidance-seed.ts';

const WRITE = process.argv.includes('--write');

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

function log(message: string): void {
  console.log(message);
}

/** Existing guidance row shape we read back for ownership resolution. */
interface ExistingGuidanceRow {
  id: number;
  product_id: number;
  application_route: string;
  review_status: string | null;
  source_note: string | null;
  is_active: boolean | null;
}

/** Existing product row shape for name → id resolution. */
interface ExistingProductRow {
  id: number;
  name: string;
  input_type: string | null;
}

/**
 * Ownership rule (mirrors compositions): the seeder may only touch rows it wrote
 * (seed source-note marker) that no human has reviewed. Without the review_status
 * guard a re-run would silently downgrade a verified range back to provisional.
 */
function seederOwnsGuidance(row: ExistingGuidanceRow): boolean {
  return (
    (row.review_status ?? 'provisional') !== 'verified' &&
    (row.source_note ?? '').startsWith(SEED_DOSE_GUIDANCE_SOURCE_NOTE)
  );
}

type Resolution = { id: number; action: 'inserted' | 'updated' | 'skipped' | 'no_product' };

/**
 * Ensure a guidance row exists for (product, route). Seed-owned rows get their
 * range refreshed so corrections propagate; curated/verified rows are left
 * untouched (action 'skipped'). Returns 'no_product' when the named product
 * is absent from the catalog (the seeder never creates products).
 */
async function upsertGuidance(
  supabase: SupabaseClient,
  seed: FertilizerDoseGuidanceSeed,
  productId: number,
  existingByRoute: Map<string, ExistingGuidanceRow>,
): Promise<Resolution> {
  const sourceNote = seed.sourceNoteSuffix
    ? `${SEED_DOSE_GUIDANCE_SOURCE_NOTE} ${seed.sourceNoteSuffix}`
    : SEED_DOSE_GUIDANCE_SOURCE_NOTE;
  const row = {
    product_id: productId,
    application_route: seed.applicationRoute,
    min_value: seed.minValue,
    max_value: seed.maxValue,
    unit: seed.unit,
    applications_per_month: seed.applicationsPerMonth ?? null,
    source_note: sourceNote,
    source_url: null,
    revision_date: SEED_DOSE_GUIDANCE_REVISION_DATE,
    effective_from: SEED_DOSE_GUIDANCE_REVISION_DATE,
    review_status: 'provisional',
    is_active: true,
  };

  const routeKey = `${productId}:${seed.applicationRoute}`;
  const existing = existingByRoute.get(routeKey);
  if (existing) {
    if (!seederOwnsGuidance(existing)) {
      return { id: existing.id, action: 'skipped' };
    }
    const { error } = await supabase
      .from('chemical_product_dose_guidance')
      .update(row)
      .eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, action: 'updated' };
  }

  const { data, error } = await supabase
    .from('chemical_product_dose_guidance')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return { id: (data as { id: number }).id, action: 'inserted' };
}

async function main(): Promise<void> {
  const count = FERTILIZER_DOSE_GUIDANCE_SEED.length;
  log(
    `Fertilizer dose-guidance seed — ${count} rows (state ${SEED_DOSE_GUIDANCE_STATE_CODE}). ` +
      `Advisory only, never regulatory (issue #236).`,
  );

  if (!WRITE) {
    log('DRY RUN (no --write): nothing will be written. Planned rows:');
    for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
      log(
        `  • ${seed.productName} [${seed.applicationRoute}] → ` +
          `${seed.minValue}–${seed.maxValue} ${seed.unit}` +
          (seed.applicationsPerMonth ? ` (${seed.applicationsPerMonth}×/month)` : ''),
      );
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

  // Resolve every product name → id up front (one read). Only fertilizer rows
  // qualify — a non-fertilizer row holding the name is not our product.
  const { data: productRows, error: productError } = supabase
    ? await supabase
        .from('chemical_products')
        .select('id,name,input_type')
        .eq('state_code', SEED_DOSE_GUIDANCE_STATE_CODE)
    : { data: null, error: null };
  if (productError) throw productError;
  const productsByLowerName = new Map<string, ExistingProductRow>();
  for (const product of (productRows ?? []) as ExistingProductRow[]) {
    productsByLowerName.set(product.name.toLowerCase(), product);
  }

  // Read all existing guidance rows for these products so the write loop is
  // idempotent per (product, route).
  const productIds = [...productsByLowerName.values()].map((product) => product.id);
  const existingByRoute = new Map<string, ExistingGuidanceRow>();
  if (productIds.length > 0) {
    const { data: guidanceRows, error: guidanceError } = await supabase
      .from('chemical_product_dose_guidance')
      .select('id,product_id,application_route,review_status,source_note,is_active')
      .in('product_id', productIds);
    if (guidanceError?.code !== '42P01' && guidanceError) throw guidanceError;
    for (const row of (guidanceRows ?? []) as ExistingGuidanceRow[]) {
      existingByRoute.set(`${row.product_id}:${row.application_route}`, row);
    }
  }

  const counts = { inserted: 0, updated: 0, skipped: 0, no_product: 0 };
  for (const seed of FERTILIZER_DOSE_GUIDANCE_SEED) {
    const product = productsByLowerName.get(seed.productName.toLowerCase());
    if (!product || product.input_type !== 'fertilizer') {
      counts.no_product += 1;
      log(`  NO PRODUCT in catalog (skipped): ${seed.productName}`);
      continue;
    }
    const resolution = await upsertGuidance(supabase, seed, product.id, existingByRoute);
    counts[resolution.action] += 1;
    log(
      `  ${resolution.action}: ${seed.productName} [${seed.applicationRoute}] ` +
        `→ ${seed.minValue}–${seed.maxValue} ${seed.unit} (#${resolution.id})`,
    );
  }

  log(
    `Done. Inserted ${counts.inserted}, updated ${counts.updated}, skipped ${counts.skipped} ` +
      `(curated; not seed-owned)` +
      (counts.no_product > 0 ? `, ${counts.no_product} skipped (product not in catalog).` : '.'),
  );
}

main().catch((error: unknown) => {
  // Writes are per-row; a mid-run failure leaves a partial but valid state that
  // the next --write converges.
  console.error('Seed failed (safe to re-run --write to converge):', error);
  process.exit(1);
});
