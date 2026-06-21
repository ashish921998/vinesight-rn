import type { ProfessionalRole, ProfessionalWorkspace } from '@/services/delegated-logs';

/**
 * Client-side role flags for the authenticated professional.
 *
 * The server (`get_professional_workspace`) already scopes which clients each
 * role can see and what they may write (see `can_create_delegated_log`). These
 * flags are for *presentation* only — they exist so a screen can branch copy or
 * surface owner/admin-only affordances without sprinkling role string compares.
 *
 * Security stays server-side: never use these flags to grant or deny an action.
 */
export interface ProfessionalRoleFlags {
  /** Raw role from the workspace payload, or null when the user is a farmer / unset. */
  role: ProfessionalRole | null;
  /** Organization owner. Implies manager. */
  isOwner: boolean;
  /** Owner or admin — sees every active client in the org. */
  isManager: boolean;
  /** Agronomist — sees only clients where `organization_clients.assigned_to = me`. */
  isAgronomist: boolean;
  /** Convenience alias for org-management affordances (owner/admin). */
  canManageOrg: boolean;
}

export function deriveProfessionalRole(
  workspace: ProfessionalWorkspace | null | undefined,
): ProfessionalRoleFlags {
  const role = workspace?.role ?? null;
  const isOwner = role === 'owner';
  const isManager = role === 'owner' || role === 'admin';
  return {
    role,
    isOwner,
    isManager,
    isAgronomist: role === 'agronomist',
    canManageOrg: isManager,
  };
}
