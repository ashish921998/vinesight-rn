import { useProfile } from './use-profile';

/**
 * Single gate for consultant-linked ("professional") features. Surfaces that
 * show or hide consultant-provided content (the Fertilizer Plans workboard
 * action, the plans screen) should read this hook instead of checking
 * profile.consultant_organization_id directly, so the linking rule lives in
 * one place when it grows (e.g. org_clients status, a consultant mode).
 */
export function useConsultantLink() {
  const { data: profile, isLoading } = useProfile();

  return {
    /** The signed-in farmer is linked to a consultant's organization. */
    isLinked: Boolean(profile?.consultant_organization_id),
    organizationId: profile?.consultant_organization_id ?? null,
    /**
     * The signed-in user is org staff. No consultant-mode UI exists in RN yet
     * (consultants work in the web app); exposed so a future consultant mode
     * doesn't need to re-thread role checks through every gate.
     */
    isConsultant: profile?.user_type === 'consultant',
    isLoading,
  };
}
