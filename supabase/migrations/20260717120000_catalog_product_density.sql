-- Product-level bulk density is optional reference data. It is only needed
-- when a purchase is recorded by volume, so unknown values remain null rather
-- than being guessed from the product class.
alter table public.chemical_products
  add column if not exists density_kg_per_l numeric,
  add column if not exists density_source_url text,
  add column if not exists density_verified boolean not null default false;

alter table public.chemical_products
  drop constraint if exists chemical_products_density_kg_per_l_positive;

alter table public.chemical_products
  add constraint chemical_products_density_kg_per_l_positive
  check (density_kg_per_l is null or density_kg_per_l > 0);
