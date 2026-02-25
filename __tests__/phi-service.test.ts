import {
  buildSafeToSprayStatus,
  computePhiForMix,
  computeGoverningPhiComponent,
} from '@/services/phi-service';
import type { ChemicalMix } from '@/types/phi';

const sampleMix: ChemicalMix = {
  id: 7,
  name: 'Acrobat + M45',
  target_problem: 'Downy mildew',
  application_mode: 'preventive',
  source_page: 1,
  is_active: true,
  components: [
    {
      id: 1,
      mix_id: 7,
      product_id: 1,
      product_name: 'Acrobat',
      active_ingredient: 'Dimethomorph',
      dose_value: 1,
      dose_unit: 'gm',
      dose_basis: 'per_liter',
      phi_days: 10,
      phi_source: 'Label',
    },
    {
      id: 2,
      mix_id: 7,
      product_id: 2,
      product_name: 'M45',
      active_ingredient: 'Mancozeb',
      dose_value: 2.5,
      dose_unit: 'gm',
      dose_basis: 'per_liter',
      phi_days: 28,
      phi_source: 'Label',
    },
  ],
};

describe('phi-service', () => {
  it('selects highest PHI component as governing', () => {
    const governing = computeGoverningPhiComponent(sampleMix);
    expect(governing?.product_name).toBe('M45');
    expect(governing?.phi_days).toBe(28);
  });

  it('computes safe harvest date across month boundary', () => {
    const result = computePhiForMix(sampleMix, '2026-01-31');
    expect(result?.safeHarvestDate).toBe('2026-02-28');
    expect(result?.governingPhiDays).toBe(28);
  });

  it('builds green/yellow/red statuses with 3-day yellow buffer', () => {
    const statuses = buildSafeToSprayStatus({
      mixes: [sampleMix],
      targetHarvestDate: '2026-03-01',
      today: '2026-01-20',
      yellowBufferDays: 3,
    });
    expect(statuses[0]?.status).toBe('green');

    const yellow = buildSafeToSprayStatus({
      mixes: [sampleMix],
      targetHarvestDate: '2026-03-01',
      today: '2026-01-31',
      yellowBufferDays: 3,
    });
    expect(yellow[0]?.status).toBe('yellow');

    const red = buildSafeToSprayStatus({
      mixes: [sampleMix],
      targetHarvestDate: '2026-03-01',
      today: '2026-03-02',
      yellowBufferDays: 3,
    });
    expect(red[0]?.status).toBe('red');
  });
});
