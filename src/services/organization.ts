import type { TFunction } from 'i18next';
import { getDataAccess } from '@/data-access';

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
 * The status strings the RPC is defined to return. The wrapper treats anything else as
 * a contract break and degrades to `network_error` rather than trusting an untyped RPC
 * payload — a malformed/unknown status with ok:true would otherwise be cast straight to
 * the `JoinOrgStatus` union and treated as a success by callers.
 */
const KNOWN_JOIN_STATUSES: ReadonlySet<JoinOrgStatus> = new Set([
  'joined',
  'already_joined',
  'not_found',
  'is_staff',
  'already_in_other_org',
  'removed',
  'unauthenticated',
]);

/** English fallbacks for each join outcome, keyed to settings.joinOrg.status.* */
const JOIN_STATUS_FALLBACK: Record<JoinOrgStatus, string> = {
  joined: 'Joined the organization.',
  already_joined: "You're already linked to this organization.",
  not_found: 'No organization found with that code. Check it and try again.',
  is_staff: "You're a team member of this organization and can't join as a farmer.",
  already_in_other_org: 'You are already linked to another organization.',
  removed: 'You were removed from this organization. Contact them to be re-added.',
  unauthenticated: 'Please sign in and try again.',
  network_error: 'Something went wrong. Please try again.',
};

/**
 * Human-friendly copy for each join outcome. The RPC returns stable status codes;
 * this keeps the status→copy mapping in one place so both the profile-completion
 * screen and the settings modal render identical, translated messages.
 */
export function joinOrgMessage(status: JoinOrgStatus, t: TFunction): string {
  return t(`settings.joinOrg.status.${status}`, {
    defaultValue: JOIN_STATUS_FALLBACK[status] ?? JOIN_STATUS_FALLBACK.network_error,
  });
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
    const { data: rpcData, error } = await getDataAccess().rpc('join_organization_by_slug', {
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

  // Runtime-validate the RPC payload shape before trusting it. An unknown status string
  // (or a known-failure status paired with ok:true) is treated as a contract failure and
  // degraded to network_error instead of being cast into the typed union.
  const rawStatus = typeof data.status === 'string' ? (data.status as JoinOrgStatus) : null;
  const ok = Boolean(data.ok);
  const status = rawStatus && KNOWN_JOIN_STATUSES.has(rawStatus) ? rawStatus : 'network_error';

  return {
    ok,
    status,
    organizationName: data.organization_name,
    organizationId: data.organization_id,
  };
}
