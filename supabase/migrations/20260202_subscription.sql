-- Subscription and capability system (simplified)

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free',
  status text not null default 'active',
  trial_ends_at timestamptz null,
  renews_at timestamptz null,
  provider text not null default 'revenuecat',
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'subscriptions_read_own'
  ) then
    create policy subscriptions_read_own on public.subscriptions
      for select using (user_id = auth.uid());
  end if;
end $$;

-- Optional profile subscription override (manual/legacy plan assignment)
alter table if exists public.profiles add column if not exists subscription text;
-- Account-level free trial
alter table if exists public.profiles add column if not exists trial_started_at timestamptz;
alter table if exists public.profiles add column if not exists trial_ends_at timestamptz;
alter table if exists public.profiles add column if not exists trial_used_at timestamptz;
