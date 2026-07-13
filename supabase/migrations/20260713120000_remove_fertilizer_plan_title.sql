-- Fertilizer plans are identified by their consultant, date, and prescribed
-- items. A separate title duplicated the first item in the mobile app and was
-- required only by the legacy RPC contract.

drop function if exists public.send_fertilizer_plan(uuid, text, text, jsonb);

alter table public.fertilizer_plans
  drop column if exists title;

create function public.send_fertilizer_plan(
  p_review_id uuid,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_farm_id bigint;
  v_client uuid;
  v_status text;
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id, farm_id, client_user_id, status
    into v_org, v_farm_id, v_client, v_status
  from public.petiole_triage
  where id = p_review_id;

  if not found then
    raise exception 'Petiole review % not found', p_review_id;
  end if;

  if not public.can_access_org_client(v_org, v_client) then
    raise exception 'Forbidden';
  end if;

  if v_status not in ('pending', 'in_review') then
    raise exception 'Petiole review % is already completed', p_review_id;
  end if;

  if exists (select 1 from public.fertilizer_plans where petiole_triage_id = p_review_id) then
    raise exception 'Petiole review % already has a plan', p_review_id;
  end if;

  perform public.validate_fertilizer_plan_items(p_items);

  insert into public.fertilizer_plans (
    farm_id, created_by, organization_id, notes, petiole_triage_id
  )
  values (
    v_farm_id, auth.uid(), v_org, nullif(btrim(p_notes), ''), p_review_id
  )
  returning id into v_plan_id;

  perform public.insert_fertilizer_plan_items(v_plan_id, p_items);

  update public.petiole_triage
  set status = 'reviewed',
      recommendation = null,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_review_id;

  return v_plan_id;
end;
$$;

revoke all on function public.send_fertilizer_plan(uuid, text, jsonb) from public;
grant execute on function public.send_fertilizer_plan(uuid, text, jsonb) to authenticated;
grant execute on function public.send_fertilizer_plan(uuid, text, jsonb) to service_role;
