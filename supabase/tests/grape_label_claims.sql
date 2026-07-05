-- Manual SQL assertions for Unit 1 grape label-claim schema.
-- Intended for a local database after applying:
--   supabase/migrations/20260221010000_phi_catalog.sql
--   supabase/migrations/20260624120000_grape_label_claims.sql

begin;

insert into public.chemical_products (
  name,
  active_ingredient,
  input_type,
  verification_tier,
  formulation,
  source_reference
)
values (
  'Unit Test Amisulbrom 17.7 SC',
  'Amisulbrom',
  'spray',
  'verified',
  '17.7 SC',
  'unit-test'
)
returning id
\gset product_

insert into public.chemical_label_sources (
  source_type,
  issuing_body,
  source_document,
  source_title,
  crop,
  revision_date,
  effective_from,
  edition_defaults,
  review_status
)
values (
  'annexure',
  'ICAR-NRCG',
  'Annexure 5 Grapes-2025-26 17.09.2025.pdf',
  'Annexure 5 Grapes 2025-26',
  'grape',
  date '2025-09-17',
  date '2025-09-17',
  '{"max_applications_per_season":2,"min_application_interval_days":7,"max_application_interval_days":15}'::jsonb,
  'verified'
)
returning id
\gset source_

insert into public.chemical_label_claims (
  source_id,
  product_id,
  crop,
  source_page,
  source_serial,
  formulation_name,
  active_ingredient,
  target_problem,
  dose_value,
  dose_unit,
  dose_basis,
  phi_min_days,
  phi_max_days,
  systemic_class,
  max_applications_per_season,
  min_application_interval_days,
  max_application_interval_days,
  review_status,
  effective_from
)
values (
  :source_id,
  :product_id,
  'grape',
  5,
  'UT-1',
  'Amisulbrom 17.7 SC',
  'Amisulbrom',
  'downy mildew',
  0.5,
  'ml/L',
  'per_liter_water',
  30,
  30,
  'CAA fungicide',
  2,
  7,
  15,
  'verified',
  date '2025-09-17'
)
returning id
\gset claim_

insert into public.chemical_label_claim_mrls (
  claim_id,
  market,
  residue_name,
  mrl_value,
  mrl_unit,
  source_note
)
values
  (:claim_id, 'EU', 'amisulbrom', 0.50, 'mg/kg', 'unit-test'),
  (:claim_id, 'India', 'amisulbrom', 0.50, 'mg/kg', 'unit-test');

insert into public.chemical_mixes (
  name,
  target_problem,
  application_mode,
  source_page,
  source_document,
  crop
)
values (
  'Unit Test Amisulbrom',
  'downy mildew',
  'preventive',
  5,
  'unit-test',
  'grape'
)
returning id
\gset mix_

insert into public.chemical_mix_components (
  mix_id,
  product_id,
  sequence_no,
  dose_value,
  dose_unit,
  dose_basis,
  label_claim_id
)
values (
  :mix_id,
  :product_id,
  1,
  0.5,
  'ml',
  'per_liter',
  :claim_id
);

insert into public.chemical_mixes (
  name,
  target_problem,
  application_mode,
  source_page,
  source_document,
  crop
)
values (
  'Unit Test Legacy Component',
  'anthracnose',
  'preventive',
  8,
  'unit-test',
  'grape'
)
returning id
\gset legacy_mix_

insert into public.chemical_mix_components (
  mix_id,
  product_id,
  sequence_no,
  dose_value,
  dose_unit,
  dose_basis
)
values (
  :legacy_mix_id,
  :product_id,
  1,
  0.5,
  'ml',
  'per_liter'
);

do $$
begin
  if (
    select count(*)
    from public.chemical_label_claims claims
    join public.chemical_label_sources sources on sources.id = claims.source_id
    join public.chemical_label_claim_mrls mrls on mrls.claim_id = claims.id
    join public.chemical_mix_components components on components.label_claim_id = claims.id
    where claims.source_serial = 'UT-1'
      and sources.revision_date = date '2025-09-17'
  ) <> 2 then
    raise exception 'expected complete provenance chain with two MRL rows';
  end if;
end $$;

insert into public.chemical_mixes (
  name,
  target_problem,
  application_mode,
  source_page,
  source_document,
  crop
)
values
  ('Unit Test Same Formulation', 'downy mildew', 'preventive', 6, 'unit-test', 'grape'),
  ('Unit Test Same Formulation', 'powdery mildew', 'preventive', 7, 'unit-test', 'grape');

do $$
begin
  if not exists (
    select 1
    from public.chemical_mix_components
    where label_claim_id is null
  ) then
    raise exception 'expected legacy component without claim link to remain valid';
  end if;
end $$;

insert into public.farms (
  name,
  region,
  area,
  crop,
  crop_variety,
  planting_date
)
values (
  'Unit Test Label Claim Farm',
  'Nashik',
  1,
  'grape',
  'Thompson Seedless',
  date '2025-01-01'
)
returning id
\gset farm_

insert into public.spray_records (
  farm_id,
  date,
  catalog_mix_id,
  chemical,
  dose,
  area,
  weather,
  operator,
  compliance_status,
  compliance_snapshot
)
values (
  :farm_id,
  date '2026-01-01',
  :mix_id,
  'Unit Test Amisulbrom',
  '0.5 ml/L',
  1,
  'clear',
  'unit-test',
  'allowed',
  jsonb_build_object('claim_ids', jsonb_build_array(:claim_id), 'evaluator_version', 'unit-test')
)
returning id
\gset spray_

update public.chemical_label_claims
set review_status = 'superseded',
    is_active = false,
    effective_to = date '2025-11-02'
where id = :claim_id;

do $$
declare
  stored_snapshot jsonb;
begin
  select compliance_snapshot
  into stored_snapshot
  from public.spray_records
  where chemical = 'Unit Test Amisulbrom'
    and operator = 'unit-test';

  if stored_snapshot->>'evaluator_version' <> 'unit-test' then
    raise exception 'expected existing spray compliance snapshot to remain unchanged';
  end if;
end $$;

do $$
declare
  test_source_id bigint := (
    select id
    from public.chemical_label_sources
    where source_document = 'Annexure 5 Grapes-2025-26 17.09.2025.pdf'
      and revision_date = date '2025-09-17'
    limit 1
  );
  test_product_id bigint := (
    select id
    from public.chemical_products
    where name = 'Unit Test Amisulbrom 17.7 SC'
    limit 1
  );
  test_claim_id bigint := (
    select id
    from public.chemical_label_claims
    where source_serial = 'UT-1'
    limit 1
  );
begin
  begin
    insert into public.chemical_label_claim_mrls (
      claim_id,
      market,
      residue_name,
      mrl_value
    )
    values (test_claim_id, 'EU-negative', 'amisulbrom', -0.01);
    raise exception 'negative MRL insert unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.chemical_label_claims (
      source_id,
      product_id,
      source_serial,
      formulation_name,
      target_problem,
      dose_value,
      dose_unit,
      dose_basis,
      phi_min_days,
      phi_max_days,
      min_application_interval_days,
      max_application_interval_days,
      review_status,
      effective_from,
      effective_to
    )
    values (
      test_source_id,
      test_product_id,
      'UT-BAD',
      'Bad Claim',
      'downy mildew',
      1,
      'ml/L',
      'per_liter_water',
      10,
      5,
      15,
      7,
      'verified',
      date '2025-11-02',
      date '2025-09-17'
    );
    raise exception 'reversed interval/effective-date insert unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.spray_records (
      farm_id,
      date,
      chemical,
      dose,
      area,
      weather,
      operator,
      compliance_status
    )
    values ((select id from public.farms where name = 'Unit Test Label Claim Farm' limit 1), date '2026-01-02', 'Bad', 'Bad', 1, 'clear', 'unit-test', 'maybe');
    raise exception 'invalid compliance status insert unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;

  begin
    insert into public.chemical_label_claims (
      source_id,
      product_id,
      source_serial,
      formulation_name,
      target_problem,
      dose_value,
      dose_unit,
      dose_basis,
      review_status
    )
    values (
      test_source_id,
      -1,
      'UT-MISSING-PRODUCT',
      'Missing Product',
      'downy mildew',
      1,
      'ml/L',
      'per_liter_water',
      'pending_review'
    );
    raise exception 'missing product claim link unexpectedly succeeded';
  exception
    when foreign_key_violation then
      null;
  end;
end $$;

rollback;
