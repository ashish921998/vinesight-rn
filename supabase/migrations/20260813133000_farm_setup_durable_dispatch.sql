alter table public.farm_setup_reminder_state
  drop column if exists dispatching_until;

create or replace function public.complete_farm_setup_reminder_on_farm_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farm_setup_reminder_state
  set
    completed_at = now(),
    completed_reason = 'farm_created',
    next_send_at = null,
    claim_id = null,
    claim_expires_at = null,
    updated_at = now()
  where user_id = new.user_id
    and completed_at is null;

  return new;
end;
$$;

drop trigger if exists trg_complete_farm_setup_reminder on public.farms;
create trigger trg_complete_farm_setup_reminder
  after insert on public.farms
  for each row
  execute function public.complete_farm_setup_reminder_on_farm_insert();

-- Atomically choose farm cancellation or an at-most-once notification attempt.
-- Campaign state advances before the external Expo request, so a database
-- outage after acceptance cannot replay the same reminder sequence. This
-- intentionally means an Expo failure consumes the attempt instead of retrying.
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
      reminders_sent = least(s.reminders_sent + 1, 3),
      last_sent_at = now(),
      next_send_at = case
        when s.reminders_sent + 1 >= 3 then null
        else public.farm_setup_local_send_at(
          s.started_at,
          s.timezone,
          3 * (s.reminders_sent + 2)
        )
      end,
      completed_at = case
        when s.reminders_sent + 1 >= 3 then now()
        else s.completed_at
      end,
      completed_reason = case
        when s.reminders_sent + 1 >= 3 then 'max_reminders'
        else s.completed_reason
      end,
      claim_id = null,
      claim_expires_at = null,
      updated_at = now()
    from requested r
    where s.user_id = r.requested_user_id
      and s.claim_id = p_claim_id
      and s.completed_at is null
      and not exists (
        select 1 from public.farms f where f.user_id = s.user_id
      )
    returning s.user_id
  )
  select dispatching.user_id
  from dispatching;
$$;

revoke all on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) from public;
grant execute on function public.begin_farm_setup_reminder_dispatch(uuid, uuid[]) to service_role;

-- Dispatch authorization is the sole campaign state transition. This finalizer
-- only releases users that never reached that transition.
drop function if exists public.finish_farm_setup_reminder_claim(uuid, uuid[]);

create or replace function public.finish_farm_setup_reminder_claim(
  p_claim_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farm_setup_reminder_state s
  set
    next_send_at = case
      when s.started_at <= now() - interval '30 days' then null
      else now() + interval '6 hours'
    end,
    completed_at = case
      when s.started_at <= now() - interval '30 days' then now()
      else s.completed_at
    end,
    completed_reason = case
      when s.started_at <= now() - interval '30 days' then 'undeliverable'
      else s.completed_reason
    end,
    claim_id = null,
    claim_expires_at = null,
    updated_at = now()
  where s.claim_id = p_claim_id
    and s.completed_at is null;
end;
$$;

revoke all on function public.finish_farm_setup_reminder_claim(uuid) from public;
grant execute on function public.finish_farm_setup_reminder_claim(uuid) to service_role;
