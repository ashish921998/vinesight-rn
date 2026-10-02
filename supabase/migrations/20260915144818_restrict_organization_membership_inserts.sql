SET lock_timeout = '5s';

-- Creating an organization cannot nominate another user as its creator.
ALTER POLICY organizations_insert_authenticated ON public.organizations
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- Preserve admin-managed memberships and the creator's initial self-membership.
-- Invite acceptance continues through the service-only RPC.
ALTER POLICY org_members_insert_authenticated ON public.organization_members
  TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (
      user_id = (select auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_members.organization_id
          AND o.created_by = (select auth.uid())
      )
    )
  );
