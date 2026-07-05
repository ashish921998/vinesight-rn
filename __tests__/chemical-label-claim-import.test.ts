import {
  buildImportPlan,
  mergeClaimsBySourceIdentity,
  parseChemicalLabelClaimCsv,
  validateProductMappingCandidates,
} from '../scripts/import-chemical-label-claims';

const HEADER = [
  'edition_key',
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
  edition_key: 'icar-nrcg-grapes-2025-09-17',
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

  it('effective-dates older editions when a newer edition is imported', () => {
    const oldPlan = buildImportPlan(csv([{}]));
    const newerPlan = buildImportPlan(
      csv([
        {
          edition_key: 'icar-nrcg-grapes-2025-11-03',
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
        edition_key: 'icar-nrcg-grapes-2025-09-17',
        effective_to: '2025-11-02',
      }),
    );
    expect(afterNew).toContainEqual(
      expect.objectContaining({
        edition_key: 'icar-nrcg-grapes-2025-11-03',
        effective_to: null,
      }),
    );
  });
});
