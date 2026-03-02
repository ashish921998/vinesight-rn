-- Spray catalog pricing + packaging extensions
-- Additive and idempotent migration.

alter table if exists public.chemical_products
  add column if not exists packaging_size text,
  add column if not exists price_per_package numeric(12,2),
  add column if not exists price_currency text;

update public.chemical_products
set price_currency = coalesce(price_currency, 'INR')
where price_currency is null;

alter table if exists public.chemical_products
  alter column price_currency set default 'INR',
  alter column price_currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chemical_products_price_per_package_non_negative'
      and conrelid = 'public.chemical_products'::regclass
  ) then
    alter table public.chemical_products
      add constraint chemical_products_price_per_package_non_negative
      check (price_per_package is null or price_per_package >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'chemical_products_price_currency_check'
      and conrelid = 'public.chemical_products'::regclass
  ) then
    alter table public.chemical_products
      add constraint chemical_products_price_currency_check
      check (price_currency in ('INR', 'USD', 'EUR', 'GBP'));
  end if;
end $$;

create index if not exists chemical_products_price_lookup_idx
  on public.chemical_products (input_type, is_active, price_per_package);

alter table if exists public.chemical_mixes
  add column if not exists estimated_cost_per_200l numeric(12,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chemical_mixes_estimated_cost_per_200l_non_negative'
      and conrelid = 'public.chemical_mixes'::regclass
  ) then
    alter table public.chemical_mixes
      add constraint chemical_mixes_estimated_cost_per_200l_non_negative
      check (estimated_cost_per_200l is null or estimated_cost_per_200l >= 0);
  end if;
end $$;

create index if not exists chemical_mixes_estimated_cost_per_200l_idx
  on public.chemical_mixes (estimated_cost_per_200l);
