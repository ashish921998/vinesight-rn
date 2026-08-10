import { getDelegatedAttribution } from '@/utils/activity-details';
import type { SprayRecord } from '@/types';

const translations: Record<string, string> = {
  'professional.attribution': '{{member}} · {{organization}}',
  'professional.organizationMember': 'Organization member',
  'professional.organization': 'Organization',
};

const t = (key: string, options?: Record<string, unknown>) => {
  const value = translations[key] ?? key;
  return value
    .replace('{{member}}', String(options?.member ?? ''))
    .replace('{{organization}}', String(options?.organization ?? ''));
};

describe('activity details', () => {
  it('formats delegated professional attribution', () => {
    const spray: SprayRecord = {
      farm_id: 1,
      date: '2026-03-15',
      chemical: 'Copper',
      dose: '1 kg',
      area: 2,
      weather: 'Calm',
      operator: 'Farmer',
      professional_creator_id: 'professional-1',
      professional_creator_name: 'Asha',
      acting_organization_name: 'Vine Co.',
    };

    expect(getDelegatedAttribution(t, spray)).toBe('Asha · Vine Co.');
  });
});
