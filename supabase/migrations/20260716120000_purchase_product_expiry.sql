alter table if exists public.warehouse_items
  add column if not exists expiry_date date;
