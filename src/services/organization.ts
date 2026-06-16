import { supabase } from '@/lib/supabase';

/**
 * Result of a self-serve org join (the join_organization_by_slug RPC, added in
 * the vinesight-web migration 202606160001). `ok` mirrors the RPC's own ok flag;
 * `status` is the stable machine code the UI maps to copy.
 */
export interface JoinOrgResult {
  ok: boolean;
  status: JoinOrgStatus;
  organizationName?: string;
  organizationId?: string;
}

export type JoinOrgStatus =
  | 'joined'
  | 'already_joined'
  | 'not_found'
  | 'is_staff'
  | 'already_in_other_org'
  | 'removed'
  | 'unauthenticated'
  | 'network_error';

/**
 * Human-friendly copy for each join outcome. The RPC returns stable status codes;
 * this keeps the mapping in one place so both the profile-completion screen and
 * the settings modal render identical messages.
 */
export function joinOrgMessage(status: JoinOrgStatus): string {
  switch (status) {
    case 'joined':
      return 'Joined the organization.';
    case 'already_joined':
      return "You're already linked to this organization.";
    case 'not_found':
      return 'No organization found with that code. Check it and try again.';
    case 'is_staff':
      return "You're a team member of this organization and can't join as a farmer.";
    case 'already_in_other_org':
      return 'You are already linked to another organization.';
    case 'removed':
      return 'You were removed from this organization. Contact them to be re-added.';
    case 'unauthenticated':
      return 'Please sign in and try again.';
    case 'network_error':
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Link the signed-in farmer to a consultant's organization by entering that
 * org's slug (the "consultant code" shared over WhatsApp etc.). Calls the
 * SECURITY DEFINER RPC `join_organization_by_slug` which enforces the invariants
 * (one active org per farmer, staff≠client, removed stays removed) atomically.
 *
 * Returns a typed result instead of throwing so callers can render the specific
 * status without try/catch ceremony.
 */
export async function joinOrganizationBySlug(rawSlug: string): Promise<JoinOrgResult> {
  const slug = rawSlug.trim();
  if (!slug) {
    return { ok: false, status: 'not_found' };
  }

  let data: {
    ok: boolean;
    status: JoinOrgStatus;
    organization_name?: string;
    organization_id?: string;
  } | null = null;

  try {
    const { data: rpcData, error } = await supabase.rpc('join_organization_by_slug', {
      p_slug: slug,
    });
    if (error) {
      if (__DEV__) {
        console.warn('[organization] join_organization_by_slug error:', error.message);
      }
      return { ok: false, status: 'network_error' };
    }
    data = rpcData;
  } catch (error) {
    if (__DEV__) {
      console.warn('[organization] join_organization_by_slug threw:', error);
    }
    return { ok: false, status: 'network_error' };
  }

  if (!data) {
    return { ok: false, status: 'network_error' };
  }

  return {
    ok: Boolean(data.ok),
    status: data.status,
    organizationName: data.organization_name,
    organizationId: data.organization_id,
  };
}
