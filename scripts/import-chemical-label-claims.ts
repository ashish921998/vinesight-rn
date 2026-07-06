#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUnit } from '../src/lib/quantity/parse-unit.ts';

export const DEFAULT_CSV_PATH =
  'docs/data/chemical-label-claims/icar-nrcg-grapes-2025-09-17.csv';

const REQUIRED_COLUMNS = [
  'edition_key',
  'source_title',
  'issuing_body',
  'source_document',
  'document_revision_date',
  'crop',
  'source_page',
  'source_serial',
  'formulation',
  'active_ingredient',
  'product_mapping_strategy',
  'product_exact_name',
  'target_problem',
  'dose_value',
  'dose_unit',
  'dose_basis',
  'phi_note',
  'mrls',
  'no_mrl_required',
  'review_status',
] as const;

const REQUIRED_NON_EMPTY_COLUMNS = REQUIRED_COLUMNS.filter(
  (column) => column !== 'mrls' && column !== 'phi_note',
);

const REVIEW_STATUSES = new Set(['pending_review', 'verified', 'rejected', 'superseded']);
const DOSE_BASES = new Set(['per_liter_water', 'per_acre', 'total', 'other']);
const PRODUCT_MAPPING_STRATEGIES = new Set(['exact_name', 'product_id']);
const DEFAULT_MAX_APPLICATIONS = 2;
const DEFAULT_MIN_INTERVAL_DAYS = 7;
const DEFAULT_MAX_INTERVAL_DAYS = 15;

export type CsvRow = Record<string, string>;

export interface LabelClaimMrlInput {
  market: string;
  residue_name: string;
  mrl_value: number | null;
  mrl_unit: string;
  no_mrl_required: boolean;
  source_note: string | null;
}

export interface ValidatedLabelClaimRow {
  edition_key: string;
  source_title: string;
  issuing_body: string;
  source_document: string;
  source_url: string | null;
  document_revision_date: string;
  document_superseded_by_revision_date: string | null;
  crop: string;
  source_page: number;
  source_serial: string;
  formulation_name: string;
  active_ingredient: string;
  product_mapping_strategy: 'exact_name' | 'product_id';
  product_exact_name: string;
  product_id: number | null;
  target_problem: string;
  dose_value: number;
  dose_unit: string;
  dose_basis: 'per_liter_water' | 'per_acre' | 'total' | 'other';
  phi_min_days: number | null;
  phi_max_days: number | null;
  phi_note: string | null;
  mrls: LabelClaimMrlInput[];
  no_mrl_required: boolean;
  systemic_class: string | null;
  restrictions: string | null;
  resistance_markers: string | null;
  max_applications_per_season: number;
  min_application_interval_days: number;
  max_application_interval_days: number;
  application_interval_note: string | null;
  stage_restrictions: string | null;
  review_status: 'pending_review' | 'verified' | 'rejected' | 'superseded';
  review_notes: string | null;
}

export interface ImportPlan {
  sourceIdentity: {
    source_type: 'annexure';
    issuing_body: string;
    source_document: string;
    source_title: string;
    source_url: string | null;
    crop: string;
    revision_date: string;
    effective_from: string;
    effective_to: string | null;
    edition_defaults: Record<string, number>;
    review_status: 'pending_review' | 'verified' | 'rejected' | 'superseded';
    notes: string | null;
  };
  rows: ValidatedLabelClaimRow[];
  summary: ImportSummary;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  ambiguous: number;
  superseded: number;
  blocked: number;
}

interface ExistingClaimState {
  edition_key: string;
  revision_date: string;
  source_serial: string;
  target_problem: string;
  effective_to: string | null;
}

export function parseCsv(csv: string): CsvRow[] {
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) records.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) records.push(row);
  if (records.length === 0) return [];

  const headers = records[0].map((header) => header.trim());
  return records.slice(1).map((record) =>
    headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = record[index]?.trim() ?? '';
      return acc;
    }, {}),
  );
}

export function parseChemicalLabelClaimCsv(csv: string): ValidatedLabelClaimRow[] {
  return validateChemicalLabelClaimRows(parseCsv(csv));
}

export function validateChemicalLabelClaimRows(rows: CsvRow[]): ValidatedLabelClaimRow[] {
  if (rows.length === 0) {
    throw new Error('CSV has no data rows');
  }

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
  }

  const identities = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const validated = validateRow(row, line);
    const identity = `${validated.source_serial.toLowerCase()}::${validated.target_problem.toLowerCase()}`;

    if (identities.has(identity)) {
      throw new Error(
        `Line ${line}: duplicate source serial/target pair ${validated.source_serial}/${validated.target_problem}`,
      );
    }
    identities.add(identity);
    return validated;
  });
}

export function buildImportPlan(csv: string): ImportPlan {
  const rows = parseChemicalLabelClaimCsv(csv);
  const first = rows[0];
  const sourceKeys = new Set(
    rows.map(
      (row) =>
        `${row.edition_key}::${row.issuing_body}::${row.source_document}::${row.crop}::${row.document_revision_date}`,
    ),
  );

  if (sourceKeys.size !== 1) {
    throw new Error('CSV must contain exactly one source edition per import');
  }

  return {
    sourceIdentity: {
      source_type: 'annexure',
      issuing_body: first.issuing_body,
      source_document: first.source_document,
      source_title: first.source_title,
      source_url: first.source_url,
      crop: first.crop,
      revision_date: first.document_revision_date,
      effective_from: first.document_revision_date,
      effective_to: first.document_superseded_by_revision_date
        ? previousDay(first.document_superseded_by_revision_date)
        : null,
      edition_defaults: {
        max_applications_per_season: DEFAULT_MAX_APPLICATIONS,
        min_application_interval_days: DEFAULT_MIN_INTERVAL_DAYS,
        max_application_interval_days: DEFAULT_MAX_INTERVAL_DAYS,
      },
      review_status: first.review_status,
      notes: `Imported from ${first.edition_key}; rows require human PDF verification before production use.`,
    },
    rows,
    summary: summarizeImportRows(rows),
  };
}

export function summarizeImportRows(rows: ValidatedLabelClaimRow[]): ImportSummary {
  return {
    imported: rows.length,
    skipped: 0,
    ambiguous: 0,
    superseded: rows.filter((row) => row.review_status === 'superseded').length,
    blocked: 0,
  };
}

export function validateProductMappingCandidates(
  row: Pick<ValidatedLabelClaimRow, 'product_mapping_strategy' | 'product_exact_name' | 'product_id'>,
  candidates: Array<{ id: number; name: string }>,
): number {
  if (row.product_mapping_strategy === 'product_id') {
    if (row.product_id === null) {
      throw new Error(`Product mapping for ${row.product_exact_name} requires product_id`);
    }
    return row.product_id;
  }

  const exactMatches = candidates.filter((candidate) => candidate.name === row.product_exact_name);
  if (exactMatches.length !== 1) {
    throw new Error(
      `Product mapping for "${row.product_exact_name}" is ${
        exactMatches.length === 0 ? 'missing' : 'ambiguous'
      }; exact one-row mapping required`,
    );
  }
  return exactMatches[0].id;
}

export function mergeClaimsBySourceIdentity(
  existingClaims: ExistingClaimState[],
  plan: ImportPlan,
): ExistingClaimState[] {
  const nextClaims = existingClaims.map((claim) => ({ ...claim }));
  const priorRevisionEnd = previousDay(plan.sourceIdentity.revision_date);

  for (const claim of nextClaims) {
    if (
      claim.edition_key !== plan.rows[0].edition_key &&
      claim.revision_date < plan.sourceIdentity.revision_date &&
      claim.effective_to === null
    ) {
      claim.effective_to = priorRevisionEnd;
    }
  }

  for (const row of plan.rows) {
    const existing = nextClaims.find(
      (claim) =>
        claim.edition_key === row.edition_key &&
        claim.source_serial.toLowerCase() === row.source_serial.toLowerCase() &&
        claim.target_problem.toLowerCase() === row.target_problem.toLowerCase(),
    );

    if (existing) continue;

    nextClaims.push({
      edition_key: row.edition_key,
      revision_date: row.document_revision_date,
      source_serial: row.source_serial,
      target_problem: row.target_problem,
      effective_to: row.document_superseded_by_revision_date
        ? previousDay(row.document_superseded_by_revision_date)
        : null,
    });
  }

  return nextClaims;
}

export async function applyImportPlan(plan: ImportPlan, client: SupabaseLikeClient): Promise<void> {
  const sourceId = await upsertSource(plan, client);

  for (const row of plan.rows) {
    const productId = await resolveProductId(row, client);
    const claimId = await upsertClaim(sourceId, productId, row, client);
    await syncMrls(claimId, row.mrls, client);
  }

  // Supersede prior editions only after the new edition has landed completely.
  // A mid-import failure then leaves the old edition active (stale but
  // consistent) instead of a catalog with no active edition at all; re-running
  // the import finishes the job either way.
  await effectiveDatePriorSources(plan, client);
}

export interface SupabaseLikeClient {
  from(table: string): SupabaseTable;
}

type SupabaseRows = Array<Record<string, unknown>>;

interface SupabaseTable extends PromiseLike<{ data: SupabaseRows | null; error: Error | null }> {
  select(columns?: string): SupabaseTable;
  insert(values: unknown): SupabaseTable;
  update(values: unknown): SupabaseTable;
  delete(): SupabaseTable;
  eq(column: string, value: unknown): SupabaseTable;
  ilike(column: string, pattern: string): SupabaseTable;
  lt(column: string, value: unknown): SupabaseTable;
  is(column: string, value: unknown): SupabaseTable;
  in(column: string, values: unknown[]): SupabaseTable;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  single(): Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
}

// The identity indexes are case-insensitive (lower(...) expression indexes), so
// every lookup that feeds them must be case-insensitive too — otherwise a
// re-import with different casing misses the existing row and the insert dies
// on the unique index. PostgREST's case-insensitive operator is ilike; escape
// its wildcards so values are compared literally.
function ciEq(table: SupabaseTable, column: string, value: string): SupabaseTable {
  return table.ilike(column, value.replace(/([%_\\])/g, '\\$1'));
}

function validateRow(row: CsvRow, line: number): ValidatedLabelClaimRow {
  const requiredEmpty = REQUIRED_NON_EMPTY_COLUMNS.filter((column) => clean(row[column]).length === 0);
  if (requiredEmpty.length > 0) {
    throw new Error(`Line ${line}: missing required fields: ${requiredEmpty.join(', ')}`);
  }

  const reviewStatus = clean(row.review_status);
  if (!REVIEW_STATUSES.has(reviewStatus)) {
    throw new Error(`Line ${line}: unsupported review_status "${reviewStatus}"`);
  }

  const productMappingStrategy = clean(row.product_mapping_strategy);
  if (!PRODUCT_MAPPING_STRATEGIES.has(productMappingStrategy)) {
    throw new Error(`Line ${line}: unsupported product_mapping_strategy "${productMappingStrategy}"`);
  }

  const doseBasis = clean(row.dose_basis);
  if (!DOSE_BASES.has(doseBasis)) {
    throw new Error(`Line ${line}: unsupported dose_basis "${doseBasis}"`);
  }

  const parsedDoseUnit = parseUnit(row.dose_unit);
  if (!parsedDoseUnit) {
    throw new Error(`Line ${line}: unsupported dose_unit "${row.dose_unit}"`);
  }
  if (doseBasis !== 'other' && parsedDoseUnit.basis !== doseBasis) {
    throw new Error(
      `Line ${line}: dose_unit "${row.dose_unit}" resolves to ${parsedDoseUnit.basis}, not ${doseBasis}`,
    );
  }

  const phiMinDays = optionalInt(row.phi_min_days, `Line ${line}: phi_min_days`);
  const phiMaxDays = optionalInt(row.phi_max_days, `Line ${line}: phi_max_days`);
  const phiNote = nullable(row.phi_note);
  if (phiMinDays === null && phiMaxDays === null && !phiNote) {
    throw new Error(`Line ${line}: missing PHI explanation`);
  }
  if (phiMinDays !== null && phiMaxDays !== null && phiMinDays > phiMaxDays) {
    throw new Error(`Line ${line}: phi_min_days cannot exceed phi_max_days`);
  }

  const minInterval = optionalInt(row.min_application_interval_days, `Line ${line}: min interval`);
  const maxInterval = optionalInt(row.max_application_interval_days, `Line ${line}: max interval`);
  const resolvedMinInterval = minInterval ?? DEFAULT_MIN_INTERVAL_DAYS;
  const resolvedMaxInterval = maxInterval ?? DEFAULT_MAX_INTERVAL_DAYS;
  if (resolvedMinInterval > resolvedMaxInterval) {
    throw new Error(`Line ${line}: min application interval cannot exceed max interval`);
  }

  const noMrlRequired = parseBoolean(row.no_mrl_required, `Line ${line}: no_mrl_required`);
  const mrls = parseMrls(row.mrls, noMrlRequired, line);

  return {
    edition_key: requiredText(row.edition_key, line, 'edition_key'),
    source_title: requiredText(row.source_title, line, 'source_title'),
    issuing_body: requiredText(row.issuing_body, line, 'issuing_body'),
    source_document: requiredText(row.source_document, line, 'source_document'),
    source_url: nullable(row.source_url),
    document_revision_date: requiredDate(row.document_revision_date, line, 'document_revision_date'),
    document_superseded_by_revision_date: optionalDate(row.document_superseded_by_revision_date),
    crop: requiredText(row.crop, line, 'crop').toLowerCase(),
    source_page: requiredInt(row.source_page, line, 'source_page'),
    source_serial: requiredText(row.source_serial, line, 'source_serial'),
    formulation_name: requiredText(row.formulation, line, 'formulation'),
    active_ingredient: requiredText(row.active_ingredient, line, 'active_ingredient'),
    product_mapping_strategy: productMappingStrategy as 'exact_name' | 'product_id',
    product_exact_name: requiredText(row.product_exact_name, line, 'product_exact_name'),
    product_id: optionalInt(row.product_id, `Line ${line}: product_id`),
    target_problem: requiredText(row.target_problem, line, 'target_problem').toLowerCase(),
    dose_value: requiredNumber(row.dose_value, line, 'dose_value'),
    dose_unit: requiredText(row.dose_unit, line, 'dose_unit'),
    dose_basis: doseBasis as 'per_liter_water' | 'per_acre' | 'total' | 'other',
    phi_min_days: phiMinDays,
    phi_max_days: phiMaxDays,
    phi_note: phiNote,
    mrls,
    no_mrl_required: noMrlRequired,
    systemic_class: nullable(row.systemic_class),
    restrictions: nullable(row.restrictions),
    resistance_markers: nullable(row.resistance_markers),
    max_applications_per_season:
      optionalInt(row.max_applications_per_season, `Line ${line}: max applications`) ??
      DEFAULT_MAX_APPLICATIONS,
    min_application_interval_days: resolvedMinInterval,
    max_application_interval_days: resolvedMaxInterval,
    application_interval_note: nullable(row.application_interval_note),
    stage_restrictions: nullable(row.stage_restrictions),
    review_status: reviewStatus as 'pending_review' | 'verified' | 'rejected' | 'superseded',
    review_notes: nullable(row.review_notes),
  };
}

function parseMrls(raw: string, noMrlRequired: boolean, line: number): LabelClaimMrlInput[] {
  const value = clean(raw);
  if (!value) {
    if (noMrlRequired) {
      return [
        {
          market: 'not_applicable',
          residue_name: 'not_applicable',
          mrl_value: null,
          mrl_unit: 'mg/kg',
          no_mrl_required: true,
          source_note: 'No MRL required per pending source review',
        },
      ];
    }
    throw new Error(`Line ${line}: mrls is required unless no_mrl_required is true`);
  }

  return value.split(';').map((entry) => {
    const [market, residueName, mrlValue, unit = 'mg/kg', sourceNote = ''] = entry
      .split('|')
      .map((part) => part.trim());
    if (!market || !residueName) {
      throw new Error(`Line ${line}: invalid MRL entry "${entry}"`);
    }
    const parsedValue = mrlValue ? Number(mrlValue) : null;
    if (parsedValue !== null && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      throw new Error(`Line ${line}: invalid MRL value "${mrlValue}"`);
    }
    if (parsedValue === null && !noMrlRequired) {
      throw new Error(`Line ${line}: MRL value is required for "${entry}"`);
    }
    // The DB enforces exactly one state per row: exemption (no value) XOR a
    // real limit. A numeric value on an entry is a real limit even when the
    // row-level flag marks other residues exempt.
    return {
      market,
      residue_name: residueName,
      mrl_value: parsedValue,
      mrl_unit: unit || 'mg/kg',
      no_mrl_required: parsedValue === null,
      source_note: nullable(sourceNote),
    };
  });
}

async function upsertSource(plan: ImportPlan, client: SupabaseLikeClient): Promise<number> {
  let query = client
    .from('chemical_label_sources')
    .select('id')
    .eq('source_type', plan.sourceIdentity.source_type);
  query = ciEq(query, 'issuing_body', plan.sourceIdentity.issuing_body);
  query = ciEq(query, 'source_document', plan.sourceIdentity.source_document);
  query = ciEq(query, 'crop', plan.sourceIdentity.crop);
  const existing = await query.eq('revision_date', plan.sourceIdentity.revision_date).maybeSingle();

  throwIfSupabaseError(existing.error);
  if (existing.data?.id) {
    // A same-edition re-import is a full statement of the edition, including
    // its provenance: refresh the mutable source fields (review_status,
    // effective dates, URL, notes) so a reviewed CSV doesn't leave the source
    // row wrapping its claims with stale pre-review metadata. The identity
    // columns stay untouched — they are the lookup key.
    const sourceId = Number(existing.data.id);
    throwIfSupabaseError(
      (
        await client
          .from('chemical_label_sources')
          .update({
            source_title: plan.sourceIdentity.source_title,
            source_url: plan.sourceIdentity.source_url,
            effective_from: plan.sourceIdentity.effective_from,
            effective_to: plan.sourceIdentity.effective_to,
            edition_defaults: plan.sourceIdentity.edition_defaults,
            review_status: plan.sourceIdentity.review_status,
            notes: plan.sourceIdentity.notes,
          })
          .eq('id', sourceId)
      ).error,
    );
    return sourceId;
  }

  const inserted = await client
    .from('chemical_label_sources')
    .insert(plan.sourceIdentity)
    .select('id')
    .single();

  throwIfSupabaseError(inserted.error);
  if (!inserted.data?.id) throw new Error('Inserted source did not return an id');
  return Number(inserted.data.id);
}

async function effectiveDatePriorSources(
  plan: ImportPlan,
  client: SupabaseLikeClient,
): Promise<void> {
  // Document family key: type + issuing body + crop. Deliberately NOT the
  // filename — every Annexure revision ships as a differently-named PDF
  // ("… 17.09.2025.pdf" vs "… rev 03.11.2025.pdf"), so a filename-scoped
  // lookup would never find the edition it is superseding.
  let query = client
    .from('chemical_label_sources')
    .select('id')
    .eq('source_type', plan.sourceIdentity.source_type);
  query = ciEq(query, 'issuing_body', plan.sourceIdentity.issuing_body);
  const prior = await query
    .ilike('crop', plan.sourceIdentity.crop.replace(/([%_\\])/g, '\\$1'))
    .lt('revision_date', plan.sourceIdentity.revision_date)
    .is('effective_to', null);

  // A lookup failure is an operational error, not "no prior edition" —
  // swallowing it would silently leave a superseded edition active.
  throwIfSupabaseError(prior.error);

  // Zero-to-many prior revisions can be open (e.g. an earlier partially
  // failed import); close all of them.
  const priorSourceIds = (prior.data ?? [])
    .map((row) => Number(row.id))
    .filter((id) => Number.isFinite(id));
  if (priorSourceIds.length === 0) return;

  const effectiveTo = previousDay(plan.sourceIdentity.revision_date);

  // No .select().single() on the updates: they legitimately touch zero-to-many
  // rows, and their return values are unused.
  throwIfSupabaseError(
    (
      await client
        .from('chemical_label_sources')
        .update({ effective_to: effectiveTo, review_status: 'superseded' })
        .in('id', priorSourceIds)
    ).error,
  );

  throwIfSupabaseError(
    (
      await client
        .from('chemical_label_claims')
        .update({ effective_to: effectiveTo, is_active: false, review_status: 'superseded' })
        .in('source_id', priorSourceIds)
    ).error,
  );
}

async function resolveProductId(
  row: ValidatedLabelClaimRow,
  client: SupabaseLikeClient,
): Promise<number> {
  if (row.product_mapping_strategy === 'product_id') {
    if (row.product_id === null) {
      throw new Error(`Row ${row.source_serial}: product_id mapping is missing`);
    }
    return row.product_id;
  }

  // List query, not .single(): zero or multiple matches are expected data
  // conditions that must surface as the descriptive missing/ambiguous errors
  // below — .single() would turn both into an opaque PGRST116 first.
  const result = await client
    .from('chemical_products')
    .select('id,name')
    .eq('name', row.product_exact_name);

  throwIfSupabaseError(result.error);
  const candidates = (result.data ?? [])
    .filter((candidate) => candidate.id != null && typeof candidate.name === 'string')
    .map((candidate) => ({ id: Number(candidate.id), name: String(candidate.name) }));

  return validateProductMappingCandidates(row, candidates);
}

async function upsertClaim(
  sourceId: number,
  productId: number,
  row: ValidatedLabelClaimRow,
  client: SupabaseLikeClient,
): Promise<number> {
  const payload = {
    source_id: sourceId,
    product_id: productId,
    crop: row.crop,
    source_page: row.source_page,
    source_serial: row.source_serial,
    formulation_name: row.formulation_name,
    active_ingredient: row.active_ingredient,
    target_problem: row.target_problem,
    dose_value: row.dose_value,
    dose_unit: row.dose_unit,
    dose_basis: row.dose_basis,
    phi_min_days: row.phi_min_days,
    phi_max_days: row.phi_max_days,
    phi_note: row.phi_note,
    systemic_class: row.systemic_class,
    restrictions: row.restrictions,
    resistance_markers: row.resistance_markers,
    max_applications_per_season: row.max_applications_per_season,
    min_application_interval_days: row.min_application_interval_days,
    max_application_interval_days: row.max_application_interval_days,
    application_interval_note: row.application_interval_note,
    stage_restrictions: row.stage_restrictions,
    review_status: row.review_status,
    effective_from: row.document_revision_date,
    effective_to: row.document_superseded_by_revision_date
      ? previousDay(row.document_superseded_by_revision_date)
      : null,
    is_active: row.review_status !== 'superseded',
    review_notes: row.review_notes,
  };

  let existingQuery = client.from('chemical_label_claims').select('id').eq('source_id', sourceId);
  existingQuery = ciEq(existingQuery, 'source_serial', row.source_serial);
  existingQuery = ciEq(existingQuery, 'target_problem', row.target_problem);
  const existing = await existingQuery.maybeSingle();

  throwIfSupabaseError(existing.error);
  if (existing.data?.id) {
    const updated = await client
      .from('chemical_label_claims')
      .update(payload)
      .eq('id', existing.data.id)
      .select('id')
      .single();
    throwIfSupabaseError(updated.error);
    return Number(updated.data?.id ?? existing.data.id);
  }

  const inserted = await client.from('chemical_label_claims').insert(payload).select('id').single();
  throwIfSupabaseError(inserted.error);
  if (!inserted.data?.id) throw new Error(`Row ${row.source_serial}: inserted claim returned no id`);
  return Number(inserted.data.id);
}

async function syncMrls(
  claimId: number,
  mrls: LabelClaimMrlInput[],
  client: SupabaseLikeClient,
): Promise<void> {
  // One fetch of the claim's current MRL children drives everything: identity
  // matching is done in code against lowercased keys (the unique index is
  // case-insensitive), and rows absent from the reviewed CSV are DELETED —
  // a same-edition re-import is a full statement of the claim's MRLs, so a
  // renamed or removed market/residue must not survive as a stale child row.
  const existing = await client
    .from('chemical_label_claim_mrls')
    .select('id,market,residue_name')
    .eq('claim_id', claimId);
  throwIfSupabaseError(existing.error);

  const mrlKey = (market: unknown, residue: unknown) =>
    `${String(market).toLowerCase()}::${String(residue).toLowerCase()}`;
  const existingByKey = new Map(
    (existing.data ?? []).map((row) => [mrlKey(row.market, row.residue_name), Number(row.id)]),
  );
  const keepKeys = new Set(mrls.map((mrl) => mrlKey(mrl.market, mrl.residue_name)));

  const staleIds = [...existingByKey.entries()]
    .filter(([key]) => !keepKeys.has(key))
    .map(([, id]) => id);
  if (staleIds.length > 0) {
    throwIfSupabaseError(
      (await client.from('chemical_label_claim_mrls').delete().in('id', staleIds)).error,
    );
  }

  for (const mrl of mrls) {
    const payload = { claim_id: claimId, ...mrl };
    const existingId = existingByKey.get(mrlKey(mrl.market, mrl.residue_name));
    if (existingId !== undefined) {
      throwIfSupabaseError(
        (await client.from('chemical_label_claim_mrls').update(payload).eq('id', existingId)).error,
      );
    } else {
      throwIfSupabaseError((await client.from('chemical_label_claim_mrls').insert(payload)).error);
    }
  }
}

function requiredText(value: string | undefined, line: number, column: string): string {
  const text = clean(value);
  if (!text) throw new Error(`Line ${line}: ${column} is required`);
  return text;
}

function nullable(value: string | undefined): string | null {
  const text = clean(value);
  return text.length > 0 ? text : null;
}

function requiredDate(value: string | undefined, line: number, column: string): string {
  const date = requiredText(value, line, column);
  if (!isValidIsoDate(date)) {
    throw new Error(`Line ${line}: ${column} must be a real YYYY-MM-DD date`);
  }
  return date;
}

function optionalDate(value: string | undefined): string | null {
  const date = nullable(value);
  if (date === null) return null;
  if (!isValidIsoDate(date)) {
    throw new Error(`Optional date must be a real YYYY-MM-DD date: ${date}`);
  }
  return date;
}

// Round-trips through Date because Date.parse alone normalizes impossible
// calendar dates (2025-02-30 parses as 2025-03-02) instead of rejecting them.
function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function requiredInt(value: string | undefined, line: number, column: string): number {
  const parsed = optionalInt(value, `Line ${line}: ${column}`);
  if (parsed === null) throw new Error(`Line ${line}: ${column} is required`);
  return parsed;
}

function optionalInt(value: string | undefined, label: string): number | null {
  const text = clean(value);
  if (!text) return null;
  if (!/^-?\d+$/.test(text)) throw new Error(`${label} must be an integer`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
  return parsed;
}

function requiredNumber(value: string | undefined, line: number, column: string): number {
  const text = requiredText(value, line, column);
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Line ${line}: ${column} must be a nonnegative number`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, label: string): boolean {
  const text = clean(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  throw new Error(`${label} must be true or false`);
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

function previousDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function throwIfSupabaseError(error: Error | null): void {
  if (error) throw error;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const csvFlagIndex = args.indexOf('--csv');
  const csvPath =
    csvFlagIndex >= 0 && args[csvFlagIndex + 1] ? args[csvFlagIndex + 1] : DEFAULT_CSV_PATH;
  const plan = buildImportPlan(readFileSync(resolve(csvPath), 'utf8'));

  if (!write) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          source: plan.sourceIdentity,
          summary: plan.summary,
          rows: plan.rows.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --write');
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  await applyImportPlan(plan, client as unknown as SupabaseLikeClient);
  console.log(JSON.stringify({ mode: 'write', summary: plan.summary }, null, 2));
}

if (process.argv[1]?.endsWith('import-chemical-label-claims.ts')) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
