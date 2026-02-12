-- Maharashtra-first nutrient composition tracking
-- Apply manually in Supabase SQL editor.

alter table public.warehouse_items
  add column if not exists composition jsonb not null default '[]'::jsonb,
  add column if not exists manufacturer text,
  add column if not exists density_kg_per_l numeric(10,4),
  add column if not exists default_dose_quantity numeric(10,4),
  add column if not exists default_dose_unit text,
  add column if not exists default_dose_basis text,
  add column if not exists composition_source text not null default 'manual',
  add column if not exists composition_updated_at timestamptz;

alter table public.warehouse_items
  drop constraint if exists warehouse_items_composition_source_check;

alter table public.warehouse_items
  add constraint warehouse_items_composition_source_check
  check (composition_source in ('manual', 'preset'));

alter table public.warehouse_items
  drop constraint if exists warehouse_items_default_dose_basis_check;

alter table public.warehouse_items
  add constraint warehouse_items_default_dose_basis_check
  check (default_dose_basis is null or default_dose_basis in ('total', 'per_acre'));

alter table public.spray_records
  add column if not exists chemical_items jsonb,
  add column if not exists nutrient_totals_elemental jsonb,
  add column if not exists nutrient_totals_elemental_per_acre jsonb,
  add column if not exists nutrient_calc_coverage numeric(5,2);

alter table public.fertigation_records
  add column if not exists nutrient_totals_elemental jsonb,
  add column if not exists nutrient_totals_elemental_per_acre jsonb,
  add column if not exists nutrient_calc_coverage numeric(5,2);
