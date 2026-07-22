import { buildWorkboardActions } from '@/utils/farm-workboard';

const colors = {
  ai: '#ai',
  lab: '#lab',
  reports: '#reports',
  soil: '#soil',
  fertilizerPlans: '#fert',
};

const ids = (args: Parameters<typeof buildWorkboardActions>[0]) =>
  buildWorkboardActions(args).map((a) => a.id);

describe('buildWorkboardActions', () => {
  it('Simplified mode shows only reports', () => {
    expect(ids({ detailedMode: false, hasConsultant: false, colors })).toEqual(['reports']);
    // hasConsultant is irrelevant in Simplified mode.
    expect(ids({ detailedMode: false, hasConsultant: true, colors })).toEqual(['reports']);
  });

  it('Detailed mode without consultant shows ai, lab, reports, soil', () => {
    expect(ids({ detailedMode: true, hasConsultant: false, colors })).toEqual([
      'ai',
      'lab',
      'reports',
      'soil',
    ]);
  });

  it('Detailed mode with consultant adds fertilizer-plans', () => {
    expect(ids({ detailedMode: true, hasConsultant: true, colors })).toEqual([
      'ai',
      'lab',
      'reports',
      'soil',
      'fertilizer-plans',
    ]);
  });

  it('assigns the supplied colors', () => {
    const actions = buildWorkboardActions({ detailedMode: true, hasConsultant: true, colors });
    const byId = Object.fromEntries(actions.map((a) => [a.id, a.color]));
    expect(byId.ai).toBe('#ai');
    expect(byId.lab).toBe('#lab');
    expect(byId.reports).toBe('#reports');
    expect(byId.soil).toBe('#soil');
    expect(byId['fertilizer-plans']).toBe('#fert');
  });
});
