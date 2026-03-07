alter table public.user_push_devices
  add column if not exists timezone text,
  add column if not exists feature_overview_enabled boolean not null default true,
  add column if not exists feature_overview_started_at timestamptz null,
  add column if not exists feature_overview_next_day smallint not null default 1,
  add column if not exists feature_overview_last_sent_on date null,
  add column if not exists feature_overview_completed_at timestamptz null;

alter table public.user_push_devices
  drop constraint if exists user_push_devices_feature_overview_next_day_check;

alter table public.user_push_devices
  add constraint user_push_devices_feature_overview_next_day_check
  check (feature_overview_next_day between 1 and 7);

create index if not exists idx_user_push_devices_feature_overview_active
  on public.user_push_devices (
    feature_overview_enabled,
    notifications_enabled,
    feature_overview_completed_at,
    timezone
  );
