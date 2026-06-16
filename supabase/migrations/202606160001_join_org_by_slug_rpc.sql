-- Farmer self-join: lets an authenticated farmer link themselves to a consultant's
-- organization by entering that org's slug (the "consultant code").
--
-- Replaces the old farmer-invitation flow (farmer_invitations + magic link + phone
-- pre-binding) with something far simpler: the consultant shares the org slug over a
-- WhatsApp group, and the farmer types it in the RN app.
--
-- Authorization model: the slug is the proof of consultant intent ("whoever I gave this
-- code to may join"). We accept that slug-guessing is not a threat at our scale.
--
-- Runs as SECURITY DEFINER because organization_clients INSERT is RLS-gated to org
-- admins only — a farmer can't self-insert. All logic (lookup, invariants, insert,
-- profile mirror) happens in one atomic transaction. Callable by any authenticated user.
--
-- NOTE (vinesight-rn): this RPC mirrors vinesight-web migration 202606160001 of the same
-- name (branch feat/farmer-join-by-slug, commit 11694f8). The org schema (organizations,
-- organization_clients, organization_members, profiles.consultant_organization_id, and the
-- idx_organization_clients_one_active_per_client partial unique index) is owned by the web
-- repo (202606040001_consultant_client_foundation.sql + follow-ups). This file assumes
-- those objects already exist in the target database.

create or replace function public.join_organization_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_owner uuid;
  v_existing_status text;
begin
  -- Must be called by a logged-in user. auth.uid() reads the caller's JWT; null under anon.
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'status', 'unauthenticated');
  end if;

  -- Resolve the org by slug. Trim + lowercase for typing tolerance (slugs are stored
  -- lowercased already, but farmers mistype). Org must be active.
  select id, name into v_org_id, v_org_name
  from public.organizations
  where lower(slug) = lower(btrim(p_slug))
    and is_active = true
  limit 1;

  if v_org_id is null then
    return jsonb_build_object('ok', false, 'status', 'not_found');
  end if;

  -- A team member of THIS org must not also be its client (one account, two roles).
  if exists (
    select 1 from public.organization_members
    where organization_id = v_org_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'status', 'is_staff');
  end if;

  -- Is there already a client row for this farmer in THIS org (any status)?
  select status into v_existing_status
  from public.organization_clients
  where organization_id = v_org_id and client_user_id = auth.uid()
  limit 1;

  -- Already an active client -> idempotent success (re-typing the code is a no-op).
  -- Keep the profile mirror in sync in case it drifted.
  if v_existing_status = 'active' then
    update public.profiles set consultant_organization_id = v_org_id where id = auth.uid();
    return jsonb_build_object(
      'ok', true, 'status', 'already_joined',
      'organization_name', v_org_name, 'organization_id', v_org_id
    );
  end if;

  -- A deliberately-removed client must not reactivate themselves with the shared code.
  -- Re-admitting a removed farmer is the consultant's decision, not the farmer's.
  if v_existing_status = 'inactive' then
    return jsonb_build_object('ok', false, 'status', 'removed');
  end if;

  -- A farmer can be an active client of only ONE org at a time. The partial unique index
  -- idx_organization_clients_one_active_per_client enforces this at insert time; this check
  -- gives a clean, specific message instead of a raw constraint violation.
  if exists (
    select 1 from public.organization_clients
    where client_user_id = auth.uid()
      and status = 'active'
      and organization_id <> v_org_id
  ) then
    return jsonb_build_object('ok', false, 'status', 'already_in_other_org');
  end if;

  -- Assign the farmer to the org owner by default. Fall back to an admin if there's no
  -- owner flag row yet (keeps assigned_to populated so the consultant triage views work).
  select user_id into v_owner
  from public.organization_members
  where organization_id = v_org_id and is_owner = true
  order by user_id
  limit 1;
  if v_owner is null then
    select user_id into v_owner
    from public.organization_members
    where organization_id = v_org_id and role in ('owner', 'admin')
    order by (role = 'owner') desc, user_id
    limit 1;
  end if;

  -- Insert a fresh active client, or reactivate a pre-existing 'pending' row for this org.
  -- ON CONFLICT covers the race where a concurrent call (or an admin add) created the row
  -- between our read and write; coalesce keeps any existing assignment instead of clobbering it.
  insert into public.organization_clients
    (organization_id, client_user_id, assigned_to, assigned_by, status)
  values
    (v_org_id, auth.uid(), v_owner, v_owner, 'active')
  on conflict (organization_id, client_user_id) do update
    set status = 'active',
        assigned_to = coalesce(public.organization_clients.assigned_to, excluded.assigned_to),
        assigned_by = coalesce(public.organization_clients.assigned_by, excluded.assigned_by),
        assigned_at = coalesce(public.organization_clients.assigned_at, now()),
        updated_at = now();

  -- Sync the legacy profiles.consultant_organization_id mirror that older screens read.
  update public.profiles
  set consultant_organization_id = v_org_id
  where id = auth.uid();

  return jsonb_build_object(
    'ok', true, 'status', 'joined',
    'organization_name', v_org_name, 'organization_id', v_org_id
  );
end;
$$;

-- Only logged-in (authenticated) users may call this. anon and public are revoked.
revoke all on function public.join_organization_by_slug(text) from public, anon;
grant execute on function public.join_organization_by_slug(text) to authenticated;
