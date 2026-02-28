create extension if not exists pgcrypto;

create table if not exists public.user_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios','android')),
  locale text not null default 'en' check (locale in ('en','hi','mr')),
  notifications_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expo_push_token)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_user_push_devices_updated_at
  before update on public.user_push_devices
  for each row
  execute function public.set_updated_at();

create index if not exists idx_user_push_devices_user on public.user_push_devices (user_id);
create index if not exists idx_user_push_devices_enabled on public.user_push_devices (user_id, notifications_enabled);

alter table public.user_push_devices enable row level security;

drop policy if exists "push devices select own" on public.user_push_devices;
create policy "push devices select own"
  on public.user_push_devices for select
  using (auth.uid() = user_id);

drop policy if exists "push devices insert own" on public.user_push_devices;
create policy "push devices insert own"
  on public.user_push_devices for insert
  with check (auth.uid() = user_id);

drop policy if exists "push devices update own" on public.user_push_devices;
create policy "push devices update own"
  on public.user_push_devices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push devices delete own" on public.user_push_devices;
create policy "push devices delete own"
  on public.user_push_devices for delete
  using (auth.uid() = user_id);
