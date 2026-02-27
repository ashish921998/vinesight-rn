create table if not exists public.user_guided_tour_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tour_status text not null default 'not_started' check (tour_status in ('not_started','in_progress','complete','skipped','expired')),
  current_step text not null default 'welcome' check (current_step in ('welcome','add_farm','add_log','complete_card')),
  skipped_at_step text null check (skipped_at_step is null or skipped_at_step in ('welcome','add_farm','add_log','complete_card')),
  reminders_sent integer not null default 0 check (reminders_sent between 0 and 2),
  tour_started_at timestamptz null,
  tour_completed_at timestamptz null,
  tour_expired_at timestamptz null,
  last_active_at timestamptz null,
  active_farm_id bigint null,
  locale text not null default 'en' check (locale in ('en','hi','mr')),
  tour_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_guided_tour_state_status on public.user_guided_tour_state (tour_status);
create index if not exists idx_user_guided_tour_state_last_active on public.user_guided_tour_state (last_active_at);

alter table public.user_guided_tour_state enable row level security;

drop policy if exists "guided tour state select own" on public.user_guided_tour_state;
create policy "guided tour state select own"
  on public.user_guided_tour_state for select
  using (auth.uid() = user_id);

drop policy if exists "guided tour state insert own" on public.user_guided_tour_state;
create policy "guided tour state insert own"
  on public.user_guided_tour_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "guided tour state update own" on public.user_guided_tour_state;
create policy "guided tour state update own"
  on public.user_guided_tour_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
