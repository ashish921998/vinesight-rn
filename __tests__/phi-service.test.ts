import {
  buildSafeToSprayStatus,
  computeEarliestSafeHarvest,
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
      phi_verified: true,
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
      phi_verified: true,
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

  it('returns legacy_unverified status when a component has phi_verified: false', () => {
    const unverifiedMix: ChemicalMix = {
      ...sampleMix,
      id: 9,
      name: 'Unverified Mix',
      components: [
        {
          ...sampleMix.components[0],
          id: 4,
          mix_id: 9,
          product_id: 4,
          product_name: 'Unverified Product',
          phi_days: 14,
          phi_verified: false,
        },
        {
          ...sampleMix.components[1],
          id: 5,
          mix_id: 9,
          product_id: 5,
          product_name: 'Verified Product',
          phi_days: 7,
          phi_verified: true,
        },
      ],
    };

    const result = computePhiForMix(unverifiedMix, '2026-01-15');
    expect(result).not.toBeNull();
    expect(result?.phiStatus).toBe('legacy_unverified');
    expect(result?.governingPhiDays).toBeNull();
    expect(result?.safeHarvestDate).toBeNull();
    expect(result?.blockingComponentName).toBeNull();
  });

  it('treats 0-day PHI as valid in safe-to-spray status', () => {
    const zeroPhiMix: ChemicalMix = {
      ...sampleMix,
      id: 8,
      name: 'Zero PHI Mix',
      components: [
        {
          ...sampleMix.components[0],
          id: 3,
          mix_id: 8,
          product_id: 3,
          product_name: 'Zero Day Product',
          phi_days: 0,
          phi_verified: true,
        },
      ],
    };

    const statuses = buildSafeToSprayStatus({
      mixes: [zeroPhiMix],
      targetHarvestDate: '2026-03-01',
      today: '2026-03-01',
      yellowBufferDays: 3,
    });

    expect(statuses).toHaveLength(1);
    expect(statuses[0]?.status).toBe('yellow');
    expect(statuses[0]?.governingPhiDays).toBe(0);
    expect(statuses[0]?.latestSafeSprayDate).toBe('2026-03-01');
  });
});

describe('computeEarliestSafeHarvest (fail-closed aggregate)', () => {
  it('returns no_sprays for an empty season', () => {
    const result = computeEarliestSafeHarvest([]);
    expect(result.status).toBe('no_sprays');
    expect(result.earliestDate).toBeNull();
    expect(result.unverifiedCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('is verified when every spray has a safe-harvest date, picking the most constraining', () => {
    const result = computeEarliestSafeHarvest([
      { safe_harvest_date: '2026-03-10', chemical: 'Spray A' },
      {
        safe_harvest_date: '2026-03-15',
        chemical: 'Spray B',
        phi_blocking_component: 'Mancozeb',
        date: '2026-03-03',
      },
    ]);
    expect(result.status).toBe('verified');
    expect(result.earliestDate).toBe('2026-03-15');
    expect(result.reason).toBe('Mancozeb (Spray B, 2026-03-03)');
    expect(result.unverifiedCount).toBe(0);
  });

  // REGRESSION (the fail-open bug): pre-2026-06 this dropped the null-dated
  // spray and returned a confident "safe" date. It must now fail closed.
  it('REGRESSION: one verified + one unmapped spray is unverified, not a false safe date', () => {
    const result = computeEarliestSafeHarvest([
      { safe_harvest_date: '2026-03-15', chemical: 'Verified spray' },
      { safe_harvest_date: null, chemical: 'Legacy free-text spray' },
    ]);
    expect(result.status).toBe('unverified');
    expect(result.earliestDate).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.unverifiedCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it('is unverified when no spray has a valid safe-harvest date', () => {
    const result = computeEarliestSafeHarvest([
      { safe_harvest_date: null },
      { safe_harvest_date: undefined },
      { safe_harvest_date: 'not-a-date' },
    ]);
    expect(result.status).toBe('unverified');
    expect(result.unverifiedCount).toBe(3);
    expect(result.earliestDate).toBeNull();
  });
});
