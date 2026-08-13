create table if not exists public.farm_setup_reminder_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  timezone text not null default 'UTC',
  next_send_at timestamptz null,
  reminders_sent smallint not null default 0 check (reminders_sent between 0 and 3),
  last_sent_at timestamptz null,
  completed_at timestamptz null,
  completed_reason text null check (
    completed_reason in ('farm_created', 'max_reminders', 'undeliverable')
  ),
  claim_id uuid null,
  claim_expires_at timestamptz null,
  dispatching_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farm_setup_reminder_state enable row level security;

create index if not exists idx_farm_setup_reminder_due
  on public.farm_setup_reminder_state (next_send_at)
  where completed_at is null and reminders_sent < 3;

create or replace function public.farm_setup_local_send_at(
  p_base timestamptz,
  p_timezone text,
  p_days integer
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'UTC');
begin
  if p_days < 0 then
    raise exception 'p_days must be non-negative';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_timezone
  ) then
    v_timezone := 'UTC';
  end if;

  return (
    ((p_base at time zone v_timezone)::date + p_days) + time '10:00'
  ) at time zone v_timezone;
end;
$$;

create or replace function public.initialize_farm_setup_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started_at timestamptz;
  v_timezone text := coalesce(nullif(trim(new.timezone), ''), 'UTC');
begin
  if not new.notifications_enabled then
    return new;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_timezone
  ) then
    v_timezone := 'UTC';
  end if;

  if exists (
    select 1 from public.farms f where f.user_id = new.user_id
  ) then
    return new;
  end if;

  select coalesce(p.created_at, now())
  into v_started_at
  from public.profiles p
  where p.id = new.user_id;

  v_started_at := coalesce(v_started_at, now());

  insert into public.farm_setup_reminder_state as state (
    user_id,
    started_at,
    timezone,
    next_send_at
  )
  values (
    new.user_id,
    v_started_at,
    v_timezone,
    public.farm_setup_local_send_at(v_started_at, v_timezone, 3)
  )
  on conflict (user_id) do update
  set
    timezone = excluded.timezone,
    next_send_at = case
      when state.completed_at is null
        and state.claim_id is null
        and state.next_send_at is not null
      then (
        (
          state.next_send_at at time zone state.timezone
        )::date + time '10:00'
      ) at time zone excluded.timezone
      else state.next_send_at
    end,
    updated_at = now()
  where state.timezone is distinct from excluded.timezone;

  return new;
end;
$$;

drop trigger if exists trg_initialize_farm_setup_reminder on public.user_push_devices;
create trigger trg_initialize_farm_setup_reminder
  after insert or update of notifications_enabled, timezone
  on public.user_push_devices
  for each row
  execute function public.initialize_farm_setup_reminder();

create or replace function public.complete_farm_setup_reminder_on_farm_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed boolean;
begin
  loop
    v_completed := false;

    update public.farm_setup_reminder_state
    set
      completed_at = now(),
      completed_reason = 'farm_created',
      next_send_at = null,
      claim_id = null,
      claim_expires_at = null,
      dispatching_until = null,
      updated_at = now()
    where user_id = new.user_id
      and completed_at is null
      and (
        dispatching_until is null
        or dispatching_until <= clock_timestamp()
      )
    returning true into v_completed;

    if v_completed or not exists (
      select 1
      from public.farm_setup_reminder_state
      where user_id = new.user_id
        and completed_at is null
    ) then
      return new;
    end if;

    -- A sender has already won the final dispatch decision. Delay this rare
    -- concurrent insert until the request finishes or its short lease expires.
    perform pg_catalog.pg_sleep(0.1);
  end loop;
end;
$$;

drop trigger if exists trg_complete_farm_setup_reminder on public.farms;
create trigger trg_complete_farm_setup_reminder
  before insert on public.farms
  for each row
  execute function public.complete_farm_setup_reminder_on_farm_insert();

-- Existing users are intentionally given a fresh three-day window at rollout,
-- rather than receiving an immediate reminder because their account is old.
insert into public.farm_setup_reminder_state (
  user_id,
  started_at,
  timezone,
  next_send_at
)
select distinct on (d.user_id)
  d.user_id,
  now(),
  coalesce(nullif(trim(d.timezone), ''), 'UTC'),
  public.farm_setup_local_send_at(
    now(),
    coalesce(nullif(trim(d.timezone), ''), 'UTC'),
    3
  )
from public.user_push_devices d
where d.notifications_enabled = true
  and not exists (
    select 1 from public.farms f where f.user_id = d.user_id
  )
order by d.user_id, d.last_seen_at desc nulls last
on conflict (user_id) do nothing;

create or replace function public.claim_due_farm_setup_reminders(
  p_claim_id uuid,
  p_limit integer default 250
)
returns table (user_id uuid, reminder_number smallint)
language sql
security definer
set search_path = ''
as $$
  with due as materialized (
    select s.user_id
    from public.farm_setup_reminder_state s
    where s.completed_at is null
      and s.reminders_sent < 3
      and s.next_send_at is not null
      and s.next_send_at <= now()
      and (s.claim_expires_at is null or s.claim_expires_at <= now())
      and not exists (
        select 1 from public.farms f where f.user_id = s.user_id
      )
      and exists (
        select 1
        from public.user_push_devices d
        where d.user_id = s.user_id
          and d.notifications_enabled = true
          and d.expo_push_token <> ''
      )
    order by s.next_send_at, s.user_id
    for update of s skip locked
    limit least(greatest(p_limit, 1), 500)
  ), claimed as (
    update public.farm_setup_reminder_state s
    set
      claim_id = p_claim_id,
      claim_expires_at = now() + interval '15 minutes',
      updated_at = now()
    from due
    where s.user_id = due.user_id
    returning s.user_id, (s.reminders_sent + 1)::smallint as reminder_number
  )
  select claimed.user_id, claimed.reminder_number
  from claimed;
$$;

create or replace function public.begin_farm_setup_reminder_dispatch(
  p_claim_id uuid,
  p_user_ids uuid[]
)
returns table (user_id uuid)
language sql
security definer
set search_path = ''
as $$
  with requested as (
    select distinct requested_user_id
    from unnest(p_user_ids) as requested_user_id
  ), dispatching as (
    update public.farm_setup_reminder_state s
    set
      dispatching_until = clock_timestamp() + interval '20 seconds',
      updated_at = now()
    from requested r
    where s.user_id = r.requested_user_id
      and s.claim_id = p_claim_id
      and s.completed_at is null
      and (
        s.dispatching_until is null
        or s.dispatching_until <= clock_timestamp()
      )
      and not exists (
        select 1 from public.farms f where f.user_id = s.user_id
      )
    returning s.user_id
  )
  select dispatching.user_id
  from dispatching;
$$;

create or replace function public.finish_farm_setup_reminder_claim(
  p_claim_id uuid,
  p_delivered_user_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farm_setup_reminder_state s
  set
    reminders_sent = case
      when s.user_id = any(p_delivered_user_ids) then least(s.reminders_sent + 1, 3)
      else s.reminders_sent
    end,
    last_sent_at = case
      when s.user_id = any(p_delivered_user_ids) then now()
      else s.last_sent_at
    end,
    next_send_at = case
      when s.user_id = any(p_delivered_user_ids) and s.reminders_sent + 1 >= 3 then null
      when not (s.user_id = any(p_delivered_user_ids))
        and s.started_at <= now() - interval '30 days' then null
      when s.user_id = any(p_delivered_user_ids) then
        public.farm_setup_local_send_at(now(), s.timezone, 3)
      else now() + interval '6 hours'
    end,
    completed_at = case
      when s.user_id = any(p_delivered_user_ids) and s.reminders_sent + 1 >= 3 then now()
      when not (s.user_id = any(p_delivered_user_ids))
        and s.started_at <= now() - interval '30 days' then now()
      else s.completed_at
    end,
    completed_reason = case
      when s.user_id = any(p_delivered_user_ids) and s.reminders_sent + 1 >= 3 then 'max_reminders'
      when not (s.user_id = any(p_delivered_user_ids))
        and s.started_at <= now() - interval '30 days' then 'undeliverable'
      else s.completed_reason
    end,
    claim_id = null,
    claim_expires_at = null,
    dispatching_until = null,
    updated_at = now()
  where s.claim_id = p_claim_id;
end;
$$;

revoke all on table public.farm_setup_reminder_state from anon, authenticated;
revoke all on function public.farm_setup_local_send_at(timestamptz, text, integer) from public;
revoke all on function public.claim_due_farm_setup_reminders(uuid, integer) from public;
revoke all on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) from public;
revoke all on function public.finish_farm_setup_reminder_claim(uuid, uuid[]) from public;
grant execute on function public.claim_due_farm_setup_reminders(uuid, integer) to service_role;
grant execute on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) to service_role;
grant execute on function public.finish_farm_setup_reminder_claim(uuid, uuid[]) to service_role;

-- Keep one hourly sender. The Edge Function checks exact per-user due times;
-- pg_cron only provides the reliable wake-up.
do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'supabase_url'
  ) then
    raise exception 'supabase_url is missing from Vault';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'FARM_SETUP_REMINDERS_AUTH'
  ) then
    raise exception 'FARM_SETUP_REMINDERS_AUTH is missing from Vault';
  end if;

  for v_job_id in
    select jobid from cron.job where jobname = 'guided-tour-reminders-hourly'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'guided-tour-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url' limit 1)
           || '/functions/v1/guided-tour-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'FARM_SETUP_REMINDERS_AUTH' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
