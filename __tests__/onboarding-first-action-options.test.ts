import { ACTIONS } from '@/features/onboarding/slides/first-action-slide';

describe('onboarding first-action options', () => {
  it('offers only log and note (no task)', () => {
    const types = ACTIONS.map((action) => action.type);
    expect(types).toEqual(['log', 'note']);
    expect(types).not.toContain('task');
  });
});
