import {
  applyImportPlan,
  buildImportPlan,
  mergeClaimsBySourceIdentity,
  parseChemicalLabelClaimCsv,
  validateProductMappingCandidates,
  type SupabaseLikeClient,
} from '../scripts/import-chemical-label-claims';

const HEADER = [
  'edition_key',
  'document_family',
  'source_title',
  'issuing_body',
  'source_document',
  'source_url',
  'document_revision_date',
  'document_superseded_by_revision_date',
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
  'phi_min_days',
  'phi_max_days',
  'phi_note',
  'mrls',
  'no_mrl_required',
  'systemic_class',
  'restrictions',
  'resistance_markers',
  'max_applications_per_season',
  'min_application_interval_days',
  'max_application_interval_days',
  'application_interval_note',
  'stage_restrictions',
  'review_status',
  'review_notes',
];

const baseRow = {
  edition_key: 'icar-nrcg-grapes-2025-09-17', // gitleaks:allow (edition slug, not a secret)
  document_family: 'annexure-5-grapes',
  source_title: 'ICAR-NRCG Annexure 5 Grapes 2025-26',
  issuing_body: 'ICAR-NRCG',
  source_document: 'Annexure 5 Grapes-2025-26 17.09.2025.pdf',
  source_url: 'https://nrcgrapes.in',
  document_revision_date: '2025-09-17',
  document_superseded_by_revision_date: '',
  crop: 'grape',
  source_page: '5',
  source_serial: '1',
  formulation: 'Azoxystrobin 23 SC',
  active_ingredient: 'Azoxystrobin',
  product_mapping_strategy: 'exact_name',
  product_exact_name: 'Azoxystrobin 23 SC',
  target_problem: 'downy mildew',
  dose_value: '1.0',
  dose_unit: 'ml/L',
  dose_basis: 'per_liter_water',
  phi_min_days: '15',
  phi_max_days: '15',
  phi_note: 'Verify PHI against live Annexure revision',
  mrls: 'EU|azoxystrobin|3.00|mg/kg',
  no_mrl_required: 'false',
  systemic_class: 'QoI fungicide',
  restrictions: 'Rotate chemistry',
  resistance_markers: 'FRAC 11',
  max_applications_per_season: '2',
  min_application_interval_days: '7',
  max_application_interval_days: '15',
  application_interval_note: 'Document default',
  stage_restrictions: '',
  review_status: 'pending_review',
  review_notes: 'Needs human review',
};

function csv(rows: Array<Partial<typeof baseRow>>): string {
  return [
    HEADER.join(','),
    ...rows.map((overrides) => {
      const row = { ...baseRow, ...overrides };
      return HEADER.map((header) => csvCell(row[header as keyof typeof row] ?? '')).join(',');
    }),
  ].join('\n');
}

function csvCell(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

describe('chemical label claim import', () => {
  it('parses a single-active claim and a combination formulation with exact provenance', () => {
    const rows = parseChemicalLabelClaimCsv(
      csv([
        {},
        {
          source_serial: '2',
          formulation: 'Metalaxyl-M 4% + Mancozeb 64% WP',
          active_ingredient: 'Metalaxyl-M + Mancozeb',
          product_exact_name: 'Metalaxyl-M 4% + Mancozeb 64% WP',
          mrls: 'EU|metalaxyl|1.00|mg/kg;EU|mancozeb|0.03|mg/kg',
        },
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      source_serial: '1',
      formulation_name: 'Azoxystrobin 23 SC',
      review_status: 'pending_review',
      dose_basis: 'per_liter_water',
    });
    expect(rows[1].mrls).toEqual([
      expect.objectContaining({ market: 'EU', residue_name: 'metalaxyl', mrl_value: 1 }),
      expect.objectContaining({ market: 'EU', residue_name: 'mancozeb', mrl_value: 0.03 }),
    ]);
  });

  it('keeps no-MRL, PHI-not-applicable, PHI range, suffix serial, and stage text distinct', () => {
    const [row] = parseChemicalLabelClaimCsv(
      csv([
        {
          source_serial: '16a',
          target_problem: 'growth regulation',
          dose_unit: 'ppm',
          dose_basis: 'per_liter_water',
          phi_min_days: '',
          phi_max_days: '',
          phi_note: 'PHI not applicable; verify source wording',
          mrls: '',
          no_mrl_required: 'true',
          stage_restrictions: 'Pre-bloom only',
        },
      ]),
    );

    expect(row.source_serial).toBe('16a');
    expect(row.phi_min_days).toBeNull();
    expect(row.phi_max_days).toBeNull();
    expect(row.mrls).toEqual([
      expect.objectContaining({ no_mrl_required: true, mrl_value: null }),
    ]);
    expect(row.stage_restrictions).toBe('Pre-bloom only');
  });

  it('rejects rows that disagree on the superseded-by date — it is edition-level', () => {
    expect(() =>
      buildImportPlan(
        csv([
          { document_superseded_by_revision_date: '2025-11-03' },
          { source_serial: '2', document_superseded_by_revision_date: '' },
        ]),
      ),
    ).toThrow(/exactly one source edition/);
  });

  it('rejects duplicate source serial/target pairs', () => {
    expect(() =>
      parseChemicalLabelClaimCsv(
        csv([
          {},
          {
            source_page: '6',
            formulation: 'Cyazofamid 34.5 SC',
            product_exact_name: 'Cyazofamid 34.5 SC',
          },
        ]),
      ),
    ).toThrow(/duplicate source serial\/target pair/);
  });

  it('rejects unsupported dose units without coercing testimony', () => {
    expect(() =>
      parseChemicalLabelClaimCsv(csv([{ dose_unit: 'PPM per acre', dose_basis: 'per_acre' }])),
    ).toThrow(/unsupported dose_unit/);
  });

  it('rejects missing PHI explanation when PHI days are absent', () => {
    expect(() =>
      parseChemicalLabelClaimCsv(csv([{ phi_min_days: '', phi_max_days: '', phi_note: '' }])),
    ).toThrow(/missing PHI explanation/);
  });

  it('rejects ambiguous exact product mappings', () => {
    const [row] = parseChemicalLabelClaimCsv(csv([{}]));

    expect(() =>
      validateProductMappingCandidates(row, [
        { id: 1, name: 'Azoxystrobin 23 SC' },
        { id: 2, name: 'Azoxystrobin 23 SC' },
      ]),
    ).toThrow(/ambiguous/);
  });

  it('plans same-edition imports idempotently by source identity', () => {
    const plan = buildImportPlan(csv([{}]));
    const once = mergeClaimsBySourceIdentity([], plan);
    const twice = mergeClaimsBySourceIdentity(once, plan);

    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
  });

  it('rejects impossible calendar dates instead of letting Date.parse normalize them', () => {
    expect(() =>
      parseChemicalLabelClaimCsv(csv([{ document_revision_date: '2025-02-30' }])),
    ).toThrow(/real YYYY-MM-DD date/);
  });

  it('marks a valued MRL entry as a real limit even when the row flags other residues exempt', () => {
    const [row] = parseChemicalLabelClaimCsv(
      csv([
        {
          mrls: 'EU|azoxystrobin|3.00|mg/kg;IN|sulphur',
          no_mrl_required: 'true',
        },
      ]),
    );

    // DB enforces exemption XOR value per row — a numeric value is never
    // stored alongside no_mrl_required = true.
    expect(row.mrls).toEqual([
      expect.objectContaining({ mrl_value: 3, no_mrl_required: false }),
      expect.objectContaining({ mrl_value: null, no_mrl_required: true }),
    ]);
  });

  it('effective-dates older editions when a newer edition is imported', () => {
    const oldPlan = buildImportPlan(csv([{}]));
    const newerPlan = buildImportPlan(
      csv([
        {
          edition_key: 'icar-nrcg-grapes-2025-11-03', // gitleaks:allow (edition slug, not a secret)
          source_document: 'Annexure 5 Grapes-2025-26 rev 03.11.2025.pdf',
          document_revision_date: '2025-11-03',
          source_serial: '1',
        },
      ]),
    );

    const afterOld = mergeClaimsBySourceIdentity([], oldPlan);
    const afterNew = mergeClaimsBySourceIdentity(afterOld, newerPlan);

    expect(afterNew).toContainEqual(
      expect.objectContaining({
        edition_key: 'icar-nrcg-grapes-2025-09-17', // gitleaks:allow (edition slug, not a secret)
        effective_to: '2025-11-02',
      }),
    );
    expect(afterNew).toContainEqual(
      expect.objectContaining({
        edition_key: 'icar-nrcg-grapes-2025-11-03', // gitleaks:allow (edition slug, not a secret)
        effective_to: null,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Write path (applyImportPlan) against a recording fake client — regression
// coverage for the review findings: multi-row supersede, supersede-after-
// claims ordering, surfaced lookup errors, stale-MRL deletion.
// ---------------------------------------------------------------------------

interface FakeOp {
  table: string;
  methods: Array<{ method: string; args: unknown[] }>;
  terminal: 'await' | 'single' | 'maybeSingle';
}

type Responder = (op: FakeOp) => { data: unknown; error: Error | null };

function fakeClient(respond: Responder, log: FakeOp[]): SupabaseLikeClient {
  const from = (table: string) => {
    const methods: FakeOp['methods'] = [];
    const resolve = (terminal: FakeOp['terminal']) => {
      const op: FakeOp = { table, methods, terminal };
      log.push(op);
      return respond(op);
    };
    const builder: Record<string, unknown> = {
      maybeSingle: () => Promise.resolve(resolve('maybeSingle')),
      single: () => Promise.resolve(resolve('single')),
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve('await')).then(onFulfilled, onRejected),
    };
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'lt', 'is', 'in']) {
      builder[method] = (...args: unknown[]) => {
        methods.push({ method, args });
        return builder;
      };
    }
    return builder as unknown as ReturnType<SupabaseLikeClient['from']>;
  };
  return { from };
}

const called = (op: FakeOp, method: string) => op.methods.some((m) => m.method === method);
const argsOf = (op: FakeOp, method: string) => op.methods.find((m) => m.method === method)?.args;

describe('applyImportPlan write path', () => {
  const plan = () => buildImportPlan(csv([{}]));

  const happyPathResponder =
    (overrides: (op: FakeOp) => { data: unknown; error: Error | null } | null): Responder =>
    (op) => {
      const override = overrides(op);
      if (override) return override;
      if (op.table === 'chemical_label_sources' && op.terminal === 'maybeSingle') {
        return { data: null, error: null };
      }
      if (op.table === 'chemical_label_sources' && called(op, 'insert')) {
        return { data: { id: 10 }, error: null };
      }
      if (op.table === 'chemical_label_sources' && called(op, 'lt')) {
        return { data: [], error: null };
      }
      if (op.table === 'chemical_products') {
        return { data: [{ id: 77, name: 'Azoxystrobin 23 SC' }], error: null };
      }
      if (op.table === 'chemical_label_claims' && op.terminal === 'maybeSingle') {
        return { data: null, error: null };
      }
      if (op.table === 'chemical_label_claims' && called(op, 'insert')) {
        return { data: { id: 500 }, error: null };
      }
      if (op.table === 'chemical_label_claim_mrls' && called(op, 'select')) {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    };

  it('supersedes every open prior revision with bulk updates and no .single()', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_label_sources' && called(op, 'lt')
          ? { data: [{ id: 1 }, { id: 2 }], error: null }
          : null,
      ),
      log,
    );

    await applyImportPlan(plan(), client);

    const sourceUpdate = log.find((op) => op.table === 'chemical_label_sources' && called(op, 'update'));
    const claimsUpdate = log.find((op) => op.table === 'chemical_label_claims' && called(op, 'update'));
    expect(argsOf(sourceUpdate!, 'in')).toEqual(['id', [1, 2]]);
    expect(argsOf(claimsUpdate!, 'in')).toEqual(['source_id', [1, 2]]);
    // Bulk updates resolve as plain awaits — .single() on a multi-row update
    // is exactly the PGRST116 crash the review reproduced.
    expect(sourceUpdate!.terminal).toBe('await');
    expect(claimsUpdate!.terminal).toBe('await');
  });

  it('scopes the supersede lookup to the document family, never (body, crop) alone', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(happyPathResponder(() => null), log);

    await applyImportPlan(plan(), client);

    // Annexure-9 shares source_type, issuing body, and crop with Annexure-5 —
    // only the family slug keeps one import from superseding the other.
    const priorLookup = log.find(
      (op) => op.table === 'chemical_label_sources' && called(op, 'lt'),
    );
    expect(priorLookup!.methods).toContainEqual({
      method: 'ilike',
      args: ['document_family', 'annexure-5-grapes'],
    });
  });

  it('resolves product names case-insensitively (identity is lower(name), casing is presentation)', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_products'
          ? { data: [{ id: 77, name: 'AZOXYSTROBIN 23 sc' }], error: null }
          : null,
      ),
      log,
    );

    await expect(applyImportPlan(plan(), client)).resolves.toBeUndefined();
    const productLookup = log.find((op) => op.table === 'chemical_products');
    expect(called(productLookup!, 'ilike')).toBe(true);
    expect(called(productLookup!, 'eq')).toBe(false);
  });

  it('supersedes prior revisions only after the new edition landed', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_label_sources' && called(op, 'lt')
          ? { data: [{ id: 1 }], error: null }
          : null,
      ),
      log,
    );

    await applyImportPlan(plan(), client);

    const claimInsertIndex = log.findIndex(
      (op) => op.table === 'chemical_label_claims' && called(op, 'insert'),
    );
    const supersedeIndex = log.findIndex(
      (op) => op.table === 'chemical_label_sources' && called(op, 'update'),
    );
    expect(claimInsertIndex).toBeGreaterThanOrEqual(0);
    expect(supersedeIndex).toBeGreaterThan(claimInsertIndex);
  });

  it('surfaces prior-source lookup errors instead of skipping supersession', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_label_sources' && called(op, 'lt')
          ? { data: null, error: new Error('connection reset') }
          : null,
      ),
      log,
    );

    await expect(applyImportPlan(plan(), client)).rejects.toThrow('connection reset');
  });

  it('re-imports the same edition by updating in place — no duplicate inserts', async () => {
    const log: FakeOp[] = [];
    // Second-run world: source, claim, and the claim's MRL row all exist.
    const client = fakeClient(
      happyPathResponder((op) => {
        if (op.table === 'chemical_label_sources' && op.terminal === 'maybeSingle') {
          return { data: { id: 10 }, error: null };
        }
        if (op.table === 'chemical_label_claims' && op.terminal === 'maybeSingle') {
          return { data: { id: 500 }, error: null };
        }
        if (op.table === 'chemical_label_claims' && called(op, 'update')) {
          return { data: { id: 500 }, error: null };
        }
        if (op.table === 'chemical_label_claim_mrls' && called(op, 'select')) {
          return { data: [{ id: 5, market: 'EU', residue_name: 'azoxystrobin' }], error: null };
        }
        return null;
      }),
      log,
    );

    await applyImportPlan(plan(), client);

    expect(log.filter((op) => called(op, 'insert'))).toHaveLength(0);
    expect(log.filter((op) => called(op, 'delete'))).toHaveLength(0);
    // Everything resolves to updates: source provenance refresh, claim, MRL.
    const updatedTables = log.filter((op) => called(op, 'update')).map((op) => op.table);
    expect(updatedTables).toEqual(
      expect.arrayContaining([
        'chemical_label_sources',
        'chemical_label_claims',
        'chemical_label_claim_mrls',
      ]),
    );
  });

  it('refreshes source provenance on a same-edition re-import (review status, dates, notes)', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) => {
        if (op.table === 'chemical_label_sources' && op.terminal === 'maybeSingle') {
          return { data: { id: 10 }, error: null };
        }
        if (op.table === 'chemical_label_claims' && op.terminal === 'maybeSingle') {
          return { data: { id: 500 }, error: null };
        }
        return null;
      }),
      log,
    );

    await applyImportPlan(plan(), client);

    const sourceUpdateIndex = log.findIndex(
      (op) => op.table === 'chemical_label_sources' && called(op, 'update'),
    );
    const sourceUpdate = log[sourceUpdateIndex];
    expect(sourceUpdate).toBeDefined();
    expect(argsOf(sourceUpdate, 'eq')).toEqual(['id', 10]);
    expect(argsOf(sourceUpdate, 'update')![0]).toMatchObject({
      review_status: 'pending_review',
      source_title: 'ICAR-NRCG Annexure 5 Grapes 2025-26',
    });
    // Identity columns are the lookup key — never part of the update payload.
    expect(argsOf(sourceUpdate, 'update')![0]).not.toHaveProperty('source_document');
    expect(argsOf(sourceUpdate, 'update')![0]).not.toHaveProperty('revision_date');
    // Provenance lands only after the claim writes — a reviewed-looking source
    // must never precede the claims that justify it.
    const lastClaimWriteIndex = log.reduce(
      (last, op, index) =>
        op.table === 'chemical_label_claims' && called(op, 'update') ? index : last,
      -1,
    );
    expect(sourceUpdateIndex).toBeGreaterThan(lastClaimWriteIndex);
  });

  it('leaves source metadata untouched when a claim write fails mid-import', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) => {
        if (op.table === 'chemical_label_sources' && op.terminal === 'maybeSingle') {
          return { data: { id: 10 }, error: null };
        }
        if (op.table === 'chemical_label_claims' && called(op, 'insert')) {
          return { data: null, error: new Error('claim write failed') };
        }
        return null;
      }),
      log,
    );

    await expect(applyImportPlan(plan(), client)).rejects.toThrow('claim write failed');
    expect(
      log.some((op) => op.table === 'chemical_label_sources' && called(op, 'update')),
    ).toBe(false);
  });

  it('reports missing and ambiguous product mappings with row context, not PGRST116', async () => {
    const missing = fakeClient(
      happyPathResponder((op) => (op.table === 'chemical_products' ? { data: [], error: null } : null)),
      [],
    );
    await expect(applyImportPlan(plan(), missing)).rejects.toThrow(/missing.*exact one-row mapping/s);

    const ambiguous = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_products'
          ? {
              data: [
                { id: 1, name: 'Azoxystrobin 23 SC' },
                { id: 2, name: 'Azoxystrobin 23 SC' },
              ],
              error: null,
            }
          : null,
      ),
      [],
    );
    await expect(applyImportPlan(plan(), ambiguous)).rejects.toThrow(/ambiguous/);
  });

  it('deletes MRL child rows that are absent from the reviewed CSV', async () => {
    const log: FakeOp[] = [];
    const client = fakeClient(
      happyPathResponder((op) =>
        op.table === 'chemical_label_claim_mrls' && called(op, 'select')
          ? {
              data: [
                { id: 5, market: 'EU', residue_name: 'azoxystrobin' },
                { id: 6, market: 'Japan', residue_name: 'azoxystrobin' },
              ],
              error: null,
            }
          : null,
      ),
      log,
    );

    await applyImportPlan(plan(), client);

    const deleteOp = log.find(
      (op) => op.table === 'chemical_label_claim_mrls' && called(op, 'delete'),
    );
    expect(argsOf(deleteOp!, 'in')).toEqual(['id', [6]]);
    const updateOp = log.find(
      (op) => op.table === 'chemical_label_claim_mrls' && called(op, 'update'),
    );
    expect(argsOf(updateOp!, 'eq')).toEqual(['id', 5]);
  });
});
