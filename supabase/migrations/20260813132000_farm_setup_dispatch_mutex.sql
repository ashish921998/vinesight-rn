alter table public.farm_setup_reminder_state
  add column if not exists dispatching_until timestamptz null;

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

revoke all on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) from public;
grant execute on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) to service_role;
