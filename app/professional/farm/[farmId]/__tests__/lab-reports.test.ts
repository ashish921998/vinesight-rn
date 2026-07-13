import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const screenSource = readFileSync(resolve(__dirname, '../lab-reports.tsx'), 'utf8');

describe('professional fertilizer plan form', () => {
  it('does not ask the professional for a plan title', () => {
    expect(screenSource).not.toContain("t('professional.reviews.planTitle')");
    expect(screenSource).not.toContain('planTitleInput');
  });
  it('does not send a hidden title to the backend', () => {
    expect(screenSource).not.toContain('title: planItems[0].fertilizer_name');
  });
});
