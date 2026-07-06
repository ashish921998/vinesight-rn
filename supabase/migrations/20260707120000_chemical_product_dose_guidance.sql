-- Recommended-dose layer for catalog fertilizers (issue #236).
--
-- The Annexure-5 analogue MINUS THE LAW: optional agronomic dose guidance per
-- catalog product — foliar concentration range (canonical g/L), drip/soil rate
-- range (canonical kg/ha, the app-side quantity kernel folds ÷2.47105 → per-acre
-- at read time), plus frequency and provenance. Deliberately a SEPARATE table
-- from chemical_label_claims (#214): those carry regulatory semantics (MRL, PHI,
-- evaluator states) and a fail-closed compliance model that advisory doses must
-- never blur. No compliance fields here — review_status is editorial, not legal.
--
-- Every consumer treats the layer as optional; null is the default (issue: "null
-- is fine — every consumer must treat the layer as optional"). The picker uses
-- the foliar midpoint as a prefill source (plan item > last-used > recommendation
-- precedence), and the magnitude guardrail fires a range check (2× outside the
-- bound) as a warning only — never blocks (testimony rule).
--
-- Provenance discipline mirrors chemical_product_compositions (source_note +
-- source_url + revision_date) and chemical_label_claims (effective window +
-- review_status + supersession via is_active), but lighter: advisory doses are
-- per-product, not per-edition, so there is no document_family / supersedes_*.

create table if not exists public.chemical_product_dose_guidance (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.chemical_products(id) on delete cascade,

  -- Application route. Foliar guidance carries a per_liter_water concentration
  -- (g/L canonical); drip/soil guidance carries a per_acre rate (kg/ha canonical,
  -- converted to kg/acre at the read boundary). One active row per route per
  -- product — the unique partial index below enforces it.
  application_route text not null check (application_route in ('foliar', 'drip', 'soil')),

  -- Recommended range, canonical units. min/max are both positive, max >= min.
  min_value numeric(12, 4) not null check (min_value > 0),
  max_value numeric(12, 4) not null check (max_value >= min_value),
  -- Canonical unit spelling the app-side quantity kernel parses: 'g/L', 'kg/ha'.
  unit text not null,

  -- Optional application frequency (label "1–2 sprays/month" → 2).
  applications_per_month integer check (applications_per_month is null or applications_per_month > 0),

  -- Provenance — the marker the seeder/ownership-rule keys on (mirrors the
  -- composition source_note convention), plus the human-readable label/URL pair.
  source_note text not null,
  source_url text,

  -- Edition provenance (lighter than label-claims: per-product, not per-revision).
  revision_date date not null,
  effective_from date,
  effective_to date,

  -- Editorial review state (NOT a compliance evaluator state). 'superseded' +
  -- is_active=false marks a row closed by a newer one for the same route.
  review_status text not null default 'provisional'
    check (review_status in ('verified', 'provisional', 'superseded')),
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chemical_product_dose_guidance is
  'Optional agronomic recommended-dose guidance per catalog fertilizer (advisory, not regulatory). Issue #236.';

-- One active guidance row per (product, route). A superseded row keeps its
-- history with is_active=false, and a new revision for the same route inserts
-- active. The kernel/filter in use-master-catalog reads only is_active rows in
-- ('verified', 'provisional') review_status.
create unique index if not exists chemical_product_dose_guidance_product_route_active_uniq
  on public.chemical_product_dose_guidance (product_id, application_route)
  where is_active;

create index if not exists chemical_product_dose_guidance_product_id_idx
  on public.chemical_product_dose_guidance (product_id);

-- RLS: authenticated read-only (matches the catalog security model — writes are
-- service-role only). Same policy name/idempotent guard as phi_catalog.sql.
do $$
begin
  execute 'alter table public.chemical_product_dose_guidance enable row level security';

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chemical_product_dose_guidance'
      and policyname = 'Allow authenticated read access'
  ) then
    execute 'create policy "Allow authenticated read access" on public.chemical_product_dose_guidance for select to authenticated using (true)';
  end if;
end $$;

-- updated_at maintenance trigger — extensions.moddatetime, exactly like the
-- sibling catalog tables (phi_catalog.sql); no hand-rolled function to keep
-- search_path-clean per the Supabase security advisor.
drop trigger if exists handle_chemical_product_dose_guidance_updated_at on public.chemical_product_dose_guidance;
create trigger handle_chemical_product_dose_guidance_updated_at
  before update on public.chemical_product_dose_guidance
  for each row execute procedure extensions.moddatetime(updated_at);
