import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type InputType = 'spray' | 'fertilizer' | 'biostimulant' | 'adjuvant' | 'other';
type VerificationTier = 'verified' | 'provisional';
type AliasKind = 'trade' | 'ocr' | 'common' | 'legacy';
type ComponentType = 'nutrient' | 'active_ingredient' | 'other';
type DoseUnit = 'gm' | 'ml';
type DoseBasis = 'per_liter' | 'per_100_liter' | 'fixed_per_tank';
type ApplicationMode = 'preventive' | 'curative' | 'both' | 'unspecified';

interface ProductAliasInput {
  alias: string;
  locale?: string;
  aliasKind?: AliasKind;
  source?: string | null;
}

interface ProductInput {
  key: string;
  name: string;
  manufacturer?: string | null;
  activeIngredient?: string | null;
  inputType: InputType;
  verificationTier: VerificationTier;
  formulation?: string | null;
  stateCode?: string;
  sourceReference?: string | null;
  isActive?: boolean;
  aliases?: ProductAliasInput[];
}

interface ProductFile {
  version: string;
  stateCode: string;
  products: ProductInput[];
}

interface CompositionRow {
  productKey: string;
  componentCode: string;
  componentType: ComponentType;
  percent: number;
  basis?: string;
  verified?: boolean;
  sourceNote?: string | null;
}

interface CompositionFile {
  version: string;
  stateCode: string;
  rows: CompositionRow[];
}

interface PhiRow {
  productKey: string;
  crop: string;
  phiDays: number;
  evidenceLevel?: string | null;
  sourceNote?: string | null;
  sourceUrl?: string | null;
  verified?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

interface PhiFile {
  version: string;
  stateCode: string;
  rows: PhiRow[];
}

interface MixComponent {
  productKey: string;
  doseValue: number;
  doseUnit: DoseUnit;
  doseBasis: DoseBasis;
  baseTankLiters?: number | null;
  notes?: string | null;
}

interface MixRow {
  name: string;
  targetProblem?: string | null;
  applicationMode?: ApplicationMode;
  sourcePage?: number | null;
  sourceDocument?: string | null;
  crop?: string;
  isActive?: boolean;
  components: MixComponent[];
}

interface MixFile {
  version: string;
  crop: string;
  sourceDocument?: string | null;
  mixes: MixRow[];
}

interface ProductRecord {
  id: number;
  name: string;
  state_code: string;
}

interface ProductAliasRecord {
  id: number;
  product_id: number;
  alias: string;
  locale: string;
}

interface CompositionRecord {
  id: number;
  product_id: number;
  component_code: string;
  basis: string;
}

interface PhiRuleRecord {
  id: number;
  product_id: number;
  crop: string;
  effective_from: string | null;
}

interface MixRecord {
  id: number;
  name: string;
  crop: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function readJson<T>(absolutePath: string): T {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

function asIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rootDir = path.resolve(__dirname, '..');
  const baseDir = path.join(rootDir, 'assets', 'data', 'master');

  const productsFile = readJson<ProductFile>(path.join(baseDir, 'maharashtra_products_v1.json'));
  const compositionsFile = readJson<CompositionFile>(
    path.join(baseDir, 'maharashtra_compositions_v1.json'),
  );
  const phiFile = readJson<PhiFile>(path.join(baseDir, 'maharashtra_phi_rules_v1.json'));
  const mixesFile = readJson<MixFile>(path.join(baseDir, 'maharashtra_mixes_v1.json'));

  const productIdByKey = new Map<string, number>();
  const productByKey = new Map<string, ProductInput>();

  for (const product of productsFile.products) {
    productByKey.set(product.key, product);
  }

  const { data: existingProducts, error: existingProductsError } = await supabase
    .from('chemical_products')
    .select('id,name,state_code');
  if (existingProductsError) throw existingProductsError;

  const productByStateName = new Map<string, ProductRecord>();
  for (const row of (existingProducts ?? []) as ProductRecord[]) {
    productByStateName.set(`${row.state_code.toUpperCase()}::${normalize(row.name)}`, row);
  }

  let insertedProducts = 0;
  let updatedProducts = 0;

  for (const product of productsFile.products) {
    const stateCode = (product.stateCode ?? productsFile.stateCode).toUpperCase();
    const key = `${stateCode}::${normalize(product.name)}`;
    const payload = {
      name: product.name,
      manufacturer: product.manufacturer ?? null,
      active_ingredient: product.activeIngredient ?? null,
      input_type: product.inputType,
      verification_tier: product.verificationTier,
      formulation: product.formulation ?? null,
      state_code: stateCode,
      source_reference: product.sourceReference ?? null,
      is_active: product.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const existing = productByStateName.get(key);
    if (existing) {
      const { data, error } = await supabase
        .from('chemical_products')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) throw error;
      productIdByKey.set(product.key, data.id as number);
      updatedProducts += 1;
      continue;
    }

    const { data, error } = await supabase
      .from('chemical_products')
      .insert(payload)
      .select('id,name,state_code')
      .single();
    if (error) throw error;

    const inserted = data as ProductRecord;
    productByStateName.set(key, inserted);
    productIdByKey.set(product.key, inserted.id);
    insertedProducts += 1;
  }

  let insertedAliases = 0;
  for (const product of productsFile.products) {
    const productId = productIdByKey.get(product.key);
    if (!productId) {
      throw new Error(`Missing product id while seeding aliases: ${product.key}`);
    }

    const aliases = product.aliases ?? [];
    if (aliases.length === 0) continue;

    const { data: existingAliases, error: existingAliasesError } = await supabase
      .from('chemical_product_aliases')
      .select('id,product_id,alias,locale')
      .eq('product_id', productId);
    if (existingAliasesError) throw existingAliasesError;

    const existingAliasSet = new Set<string>(
      ((existingAliases ?? []) as ProductAliasRecord[]).map(
        (alias) => `${alias.locale.toLowerCase()}::${normalize(alias.alias)}`,
      ),
    );

    for (const alias of aliases) {
      const locale = alias.locale?.trim() || 'en';
      const aliasValue = alias.alias.trim();
      const aliasKey = `${locale.toLowerCase()}::${normalize(aliasValue)}`;
      if (existingAliasSet.has(aliasKey)) continue;

      const { error } = await supabase.from('chemical_product_aliases').insert({
        product_id: productId,
        alias: aliasValue,
        locale,
        alias_kind: alias.aliasKind ?? 'trade',
        source: alias.source ?? null,
      });
      if (error) throw error;
      existingAliasSet.add(aliasKey);
      insertedAliases += 1;
    }
  }

  const { data: existingCompositions, error: existingCompositionsError } = await supabase
    .from('chemical_product_compositions')
    .select('id,product_id,component_code,basis');
  if (existingCompositionsError) throw existingCompositionsError;

  const compositionByKey = new Map<string, CompositionRecord>();
  for (const row of (existingCompositions ?? []) as CompositionRecord[]) {
    compositionByKey.set(`${row.product_id}::${normalize(row.component_code)}::${row.basis}`, row);
  }

  let insertedCompositions = 0;
  let updatedCompositions = 0;

  for (const row of compositionsFile.rows) {
    const productId = productIdByKey.get(row.productKey);
    if (!productId) {
      throw new Error(`Missing product id for composition productKey: ${row.productKey}`);
    }

    const basis = row.basis?.trim() || 'declared';
    const mapKey = `${productId}::${normalize(row.componentCode)}::${basis}`;
    const payload = {
      product_id: productId,
      component_code: row.componentCode.trim(),
      component_type: row.componentType,
      percent: row.percent,
      basis,
      verified: row.verified ?? false,
      source_note: row.sourceNote ?? null,
      updated_at: new Date().toISOString(),
    };

    const existing = compositionByKey.get(mapKey);
    if (existing) {
      const { error } = await supabase
        .from('chemical_product_compositions')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      updatedCompositions += 1;
    } else {
      const { data, error } = await supabase
        .from('chemical_product_compositions')
        .insert(payload)
        .select('id,product_id,component_code,basis')
        .single();
      if (error) throw error;
      const inserted = data as CompositionRecord;
      compositionByKey.set(
        `${inserted.product_id}::${normalize(inserted.component_code)}::${inserted.basis}`,
        inserted,
      );
      insertedCompositions += 1;
    }
  }

  const { data: existingPhiRules, error: existingPhiRulesError } = await supabase
    .from('chemical_phi_rules')
    .select('id,product_id,crop,effective_from');
  if (existingPhiRulesError) throw existingPhiRulesError;

  const phiByKey = new Map<string, PhiRuleRecord>();
  for (const row of (existingPhiRules ?? []) as PhiRuleRecord[]) {
    const effectiveFrom = row.effective_from ?? '1900-01-01';
    phiByKey.set(`${row.product_id}::${normalize(row.crop)}::${effectiveFrom}`, row);
  }

  let insertedPhiRules = 0;
  let updatedPhiRules = 0;

  for (const row of phiFile.rows) {
    const productId = productIdByKey.get(row.productKey);
    if (!productId) {
      throw new Error(`Missing product id for PHI productKey: ${row.productKey}`);
    }

    const effectiveFrom = asIsoDate(row.effectiveFrom);
    const mapKey = `${productId}::${normalize(row.crop)}::${effectiveFrom ?? '1900-01-01'}`;

    const payload = {
      product_id: productId,
      crop: row.crop.trim(),
      phi_days: row.phiDays,
      evidence_level: row.evidenceLevel ?? null,
      source_note: row.sourceNote ?? null,
      source_url: row.sourceUrl ?? null,
      verified: row.verified ?? true,
      effective_from: effectiveFrom,
      effective_to: asIsoDate(row.effectiveTo),
      updated_at: new Date().toISOString(),
    };

    const existing = phiByKey.get(mapKey);
    if (existing) {
      const { error } = await supabase
        .from('chemical_phi_rules')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      updatedPhiRules += 1;
    } else {
      const { data, error } = await supabase
        .from('chemical_phi_rules')
        .insert(payload)
        .select('id,product_id,crop,effective_from')
        .single();
      if (error) throw error;
      const inserted = data as PhiRuleRecord;
      const insertedKey = `${inserted.product_id}::${normalize(inserted.crop)}::${inserted.effective_from ?? '1900-01-01'}`;
      phiByKey.set(insertedKey, inserted);
      insertedPhiRules += 1;
    }
  }

  const { data: existingMixes, error: existingMixesError } = await supabase
    .from('chemical_mixes')
    .select('id,name,crop');
  if (existingMixesError) throw existingMixesError;

  const mixByKey = new Map<string, MixRecord>();
  for (const row of (existingMixes ?? []) as MixRecord[]) {
    mixByKey.set(`${normalize(row.crop)}::${normalize(row.name)}`, row);
  }

  let insertedMixes = 0;
  let updatedMixes = 0;
  let insertedMixComponents = 0;

  for (const mix of mixesFile.mixes) {
    const crop = (mix.crop ?? mixesFile.crop).trim();
    const mapKey = `${normalize(crop)}::${normalize(mix.name)}`;
    const payload = {
      name: mix.name.trim(),
      target_problem: mix.targetProblem ?? null,
      application_mode: mix.applicationMode ?? 'unspecified',
      source_page: mix.sourcePage ?? null,
      source_document: mix.sourceDocument ?? mixesFile.sourceDocument ?? null,
      crop,
      is_active: mix.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    let mixId: number;
    const existing = mixByKey.get(mapKey);
    if (existing) {
      const { data, error } = await supabase
        .from('chemical_mixes')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) throw error;
      mixId = data.id as number;
      updatedMixes += 1;
    } else {
      const { data, error } = await supabase
        .from('chemical_mixes')
        .insert(payload)
        .select('id,name,crop')
        .single();
      if (error) throw error;
      const inserted = data as MixRecord;
      mixByKey.set(mapKey, inserted);
      mixId = inserted.id;
      insertedMixes += 1;
    }

    const { error: deleteError } = await supabase
      .from('chemical_mix_components')
      .delete()
      .eq('mix_id', mixId);
    if (deleteError) throw deleteError;

    const componentRows = mix.components.map((component, index) => {
      const productId = productIdByKey.get(component.productKey);
      if (!productId) {
        throw new Error(
          `Missing product id for mix component productKey: ${component.productKey} (mix ${mix.name})`,
        );
      }

      const product = productByKey.get(component.productKey);

      return {
        mix_id: mixId,
        product_id: productId,
        sequence_no: index + 1,
        dose_value: component.doseValue,
        dose_unit: component.doseUnit,
        dose_basis: component.doseBasis,
        base_tank_liters: component.baseTankLiters ?? null,
        product_name_snapshot: product?.name ?? null,
        active_ingredient_snapshot: product?.activeIngredient ?? null,
        notes: component.notes ?? null,
      };
    });

    if (componentRows.length > 0) {
      const { error: insertComponentsError } = await supabase
        .from('chemical_mix_components')
        .insert(componentRows);
      if (insertComponentsError) throw insertComponentsError;
      insertedMixComponents += componentRows.length;
    }
  }

  console.log(
    [
      `Master catalog seed complete.`,
      `products inserted=${insertedProducts} updated=${updatedProducts}`,
      `aliases inserted=${insertedAliases}`,
      `compositions inserted=${insertedCompositions} updated=${updatedCompositions}`,
      `phi_rules inserted=${insertedPhiRules} updated=${updatedPhiRules}`,
      `mixes inserted=${insertedMixes} updated=${updatedMixes}`,
      `mix_components replaced_rows=${insertedMixComponents}`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
