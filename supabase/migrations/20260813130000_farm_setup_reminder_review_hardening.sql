alter table public.farm_setup_reminder_state
  drop constraint if exists farm_setup_reminder_state_completed_reason_check;

alter table public.farm_setup_reminder_state
  add constraint farm_setup_reminder_state_completed_reason_check
  check (completed_reason in ('farm_created', 'max_reminders', 'undeliverable'));

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
        (state.next_send_at at time zone state.timezone)::date + time '10:00'
      ) at time zone excluded.timezone
      else state.next_send_at
    end,
    updated_at = now()
  where state.timezone is distinct from excluded.timezone;

  return new;
end;
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
    updated_at = now()
  where s.claim_id = p_claim_id;
end;
$$;
