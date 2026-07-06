-- Expose each client's `profiles.area_unit_preference` in the professional
-- workspace payload, so the delegated logging path (consultant acting for a
-- farmer) can compute acres on the SAME basis the plan/record was written
-- against — the farm owner's preference — instead of the signed-in
-- consultant's. Mirrors the server-side resolution already used by the
-- `stamp_fertilizer_plan_farm_area` trigger
-- (20260705120000_fertilizer_plan_area_snapshot.sql), which joins `profiles`
-- on `farms.user_id`. This is the read-side counterpart: it surfaces the
-- preference so the app's `convertAreaToAcres` agrees with the trigger.
create or replace function public.get_professional_workspace()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'organization_id', o.id,
      'organization_name', o.name,
      'role', case when om.is_owner then 'owner' else om.role end,
      'clients', coalesce((
        select jsonb_agg(jsonb_build_object(
          'user_id', p.id,
          'full_name', coalesce(p.full_name, ''),
          'phone', p.phone,
          'area_unit_preference', p.area_unit_preference,
          'farms', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', f.id, 'name', f.name, 'region', f.region,
              'area', f.area, 'crop', f.crop, 'crop_variety', f.crop_variety
            ) order by f.name)
            from public.farms f where f.user_id = oc.client_user_id
          ), '[]'::jsonb)
        ) order by p.full_name)
        from public.organization_clients oc
        join public.profiles p on p.id = oc.client_user_id
        where oc.organization_id = om.organization_id
          and oc.status = 'active'
          and (om.role in ('owner', 'admin') or om.is_owner or oc.assigned_to = auth.uid())
      ), '[]'::jsonb)
    )
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
    order by om.joined_at
    limit 1
  ), 'null'::jsonb);
$$;

revoke all on function public.get_professional_workspace() from public;
grant execute on function public.get_professional_workspace() to authenticated;
