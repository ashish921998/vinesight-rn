import { resolveAuthenticatedRoute } from '@/utils/professional-routing';
import type { ProfessionalWorkspace } from '@/services/delegated-logs';

const workspace = {
  organization_id: 'org-1',
  organization_name: 'Vine Org',
  role: 'agronomist',
  clients: [],
} satisfies ProfessionalWorkspace;

describe('professional routing', () => {
  it('keeps profile completion ahead of an existing organization membership', () => {
    expect(
      resolveAuthenticatedRoute({
        needsProfileCompletion: true,
        hasProfileName: false,
        professionalWorkspace: workspace,
        onboardingComplete: false,
        hasSeenOnboarding: false,
      }),
    ).toBe('/(auth)/profile-completion');
  });

  it('routes a configured professional directly to the professional workspace', () => {
    expect(
      resolveAuthenticatedRoute({
        needsProfileCompletion: false,
        hasProfileName: true,
        professionalWorkspace: workspace,
        onboardingComplete: false,
        hasSeenOnboarding: false,
      }),
    ).toBe('/professional');
  });

  it('retains Farmer onboarding when no professional membership exists', () => {
    expect(
      resolveAuthenticatedRoute({
        needsProfileCompletion: false,
        hasProfileName: true,
        professionalWorkspace: null,
        onboardingComplete: false,
        hasSeenOnboarding: false,
      }),
    ).toBe('/onboarding');
  });
});
