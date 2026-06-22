-- Scope get_delegated_farm_activity to the acting organization.
--
-- The 20260621074218 migration had already been applied to the database when the
-- org-scoping fix was authored, so editing that historical file did not change the
-- running function. This migration carries the fix as a fresh create-or-replace so
-- it actually lands: a consultant in org B viewing a farm that was previously
-- serviced by org A must not see org A's delegated records. Farmer-direct records
-- (acting_organization_id is null) stay visible to any authorized org.

create or replace function public.get_delegated_farm_activity(
  p_organization_id uuid,
  p_client_user_id uuid,
  p_farm_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.can_create_delegated_log(p_organization_id, p_client_user_id, p_farm_id) then
    raise exception 'Delegated log access denied' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'record_type', activity.record_type,
    'record_data', activity.record_data
  ) order by activity.record_date desc, activity.created_at desc), '[]'::jsonb)
  into result
  from (
    select 'irrigation'::text record_type, r.date record_date, r.created_at, to_jsonb(r.*) record_data from public.irrigation_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'spray', r.date, r.created_at, to_jsonb(r.*) from public.spray_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'fertigation', r.date, r.created_at, to_jsonb(r.*) from public.fertigation_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'harvest', r.date, r.created_at, to_jsonb(r.*) from public.harvest_records r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
    union all
    select 'note', r.date, r.created_at, to_jsonb(r.*) from public.daily_notes r where r.farm_id = p_farm_id and (r.acting_organization_id is null or r.acting_organization_id = p_organization_id)
  ) activity;

  return result;
end;
$$;
