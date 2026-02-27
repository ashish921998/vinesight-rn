create or replace function public.upsert_user_guided_tour_state(
  p_tour_status text default null,
  p_current_step text default null,
  p_skipped_at_step text default null,
  p_reminders_sent integer default null,
  p_tour_started_at timestamptz default null,
  p_tour_completed_at timestamptz default null,
  p_tour_expired_at timestamptz default null,
  p_last_active_at timestamptz default null,
  p_active_farm_id bigint default null,
  p_locale text default null,
  p_tour_version integer default null
)
returns public.user_guided_tour_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_guided_tour_state;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_tour_status is not null and p_tour_status not in ('not_started','in_progress','complete','skipped','expired') then
    raise exception 'invalid tour status';
  end if;
  if p_current_step is not null and p_current_step not in ('welcome','add_farm','add_log','complete_card') then
    raise exception 'invalid current step';
  end if;
  if p_skipped_at_step is not null and p_skipped_at_step not in ('welcome','add_farm','add_log','complete_card') then
    raise exception 'invalid skipped step';
  end if;
  if p_locale is not null and p_locale not in ('en','hi','mr') then
    raise exception 'invalid locale';
  end if;
  if p_reminders_sent is not null and (p_reminders_sent < 0 or p_reminders_sent > 2) then
    raise exception 'invalid reminders_sent';
  end if;

  insert into public.user_guided_tour_state (
    user_id,
    tour_status,
    current_step,
    skipped_at_step,
    reminders_sent,
    tour_started_at,
    tour_completed_at,
    tour_expired_at,
    last_active_at,
    active_farm_id,
    locale,
    tour_version,
    updated_at
  ) values (
    v_user_id,
    coalesce(p_tour_status, 'not_started'),
    coalesce(p_current_step, 'welcome'),
    p_skipped_at_step,
    coalesce(p_reminders_sent, 0),
    p_tour_started_at,
    p_tour_completed_at,
    p_tour_expired_at,
    p_last_active_at,
    p_active_farm_id,
    coalesce(p_locale, 'en'),
    coalesce(p_tour_version, 1),
    now()
  )
  on conflict (user_id) do update set
    tour_status = coalesce(p_tour_status, public.user_guided_tour_state.tour_status),
    current_step = coalesce(p_current_step, public.user_guided_tour_state.current_step),
    skipped_at_step = case when p_skipped_at_step is null then public.user_guided_tour_state.skipped_at_step else p_skipped_at_step end,
    reminders_sent = coalesce(p_reminders_sent, public.user_guided_tour_state.reminders_sent),
    tour_started_at = case when p_tour_started_at is null then public.user_guided_tour_state.tour_started_at else p_tour_started_at end,
    tour_completed_at = case when p_tour_completed_at is null then public.user_guided_tour_state.tour_completed_at else p_tour_completed_at end,
    tour_expired_at = case when p_tour_expired_at is null then public.user_guided_tour_state.tour_expired_at else p_tour_expired_at end,
    last_active_at = case when p_last_active_at is null then public.user_guided_tour_state.last_active_at else p_last_active_at end,
    active_farm_id = case when p_active_farm_id is null then public.user_guided_tour_state.active_farm_id else p_active_farm_id end,
    locale = coalesce(p_locale, public.user_guided_tour_state.locale),
    tour_version = coalesce(p_tour_version, public.user_guided_tour_state.tour_version),
    updated_at = now()
  -- Note: The case-when pattern for nullable fields (skipped_at_step, timestamps, active_farm_id) allows
  -- explicit NULL values to be set, but preserves existing values when the parameter is NULL (not provided).
  -- This design ensures that only explicit updates change these fields while defaulting to no-change.
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.upsert_user_guided_tour_state(text,text,text,integer,timestamptz,timestamptz,timestamptz,timestamptz,bigint,text,integer) to authenticated;
