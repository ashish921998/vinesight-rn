jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import {
  buildDelegatedLogPayload,
  createDelegatedLog,
  getProfessionalWorkspace,
  isValidDelegatedLogInput,
} from '@/services/delegated-logs';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase.rpc as jest.Mock;

describe('delegated logs service', () => {
  beforeEach(() => mockRpc.mockReset());

  it('rejects invalid numeric and date inputs before submission', () => {
    expect(isValidDelegatedLogInput('irrigation', '2026-06-21', '.')).toBe(false);
    expect(isValidDelegatedLogInput('harvest', '2026-06-21', '0')).toBe(false);
    expect(isValidDelegatedLogInput('harvest', 'bad-date', '10')).toBe(false);
    expect(isValidDelegatedLogInput('irrigation', '2026-06-21', '1.5')).toBe(true);
  });

  it('requires catalog selection for sprays', () => {
    expect(isValidDelegatedLogInput('spray', '2026-06-21', '', false)).toBe(false);
    expect(isValidDelegatedLogInput('spray', '2026-06-21', '', true)).toBe(true);
  });

  it('uses the authenticated delegated RPC contract', async () => {
    mockRpc.mockResolvedValue({ data: { id: 7 }, error: null });
    await createDelegatedLog({
      organizationId: 'org-1',
      clientUserId: 'farmer-1',
      farmId: 4,
      recordType: 'note',
      date: '2026-06-21',
      payload: { notes: 'Checked vines' },
    });
    expect(mockRpc).toHaveBeenCalledWith('create_delegated_log', {
      p_organization_id: 'org-1',
      p_client_user_id: 'farmer-1',
      p_farm_id: 4,
      p_record_type: 'note',
      p_date: '2026-06-21',
      p_payload: { notes: 'Checked vines' },
    });
  });

  it('distinguishes a successful non-member lookup from an RPC failure', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getProfessionalWorkspace()).resolves.toBeNull();
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(getProfessionalWorkspace()).rejects.toThrow('offline');
  });
});

describe('buildDelegatedLogPayload', () => {
  it('maps irrigation and note to their minimal payloads', () => {
    expect(
      buildDelegatedLogPayload({ type: 'irrigation', data: { duration: 1.5 } }, { area: 3 }),
    ).toEqual({ duration: 1.5 });
    expect(
      buildDelegatedLogPayload({ type: 'note', data: { notes: '  watch mildew  ' } }, { area: 3 }),
    ).toEqual({ notes: 'watch mildew' });
  });

  it('drops empty optional harvest fields', () => {
    expect(
      buildDelegatedLogPayload(
        { type: 'harvest', data: { quantity: 100, grade: 'Premium', price: 0, buyer: '' } },
        { area: 2 },
      ),
    ).toEqual({ quantity: 100, grade: 'Premium', price: undefined, buyer: undefined });
  });

  it('builds the rich spray payload with chemical_items and nutrient totals', () => {
    const payload = buildDelegatedLogPayload(
      {
        type: 'spray',
        data: {
          waterVolume: 200,
          chemicals: [
            { id: 'a', name: ' Captan ', quantity: 2, unit: 'gm/L', quantityBasis: 'total' },
          ],
          catalogMixId: null,
          phiStatus: null,
        },
      },
      { area: 3 },
    );
    expect(payload.chemical).toBe(' Captan  (2 gm/L)');
    expect(payload.dose).toBe('Water: 200L');
    expect(payload.area).toBe(3);
    expect(payload.phi_status).toBe('unknown');
    expect(payload.chemical_items).toEqual([
      expect.objectContaining({ name: 'Captan', quantity: 2, quantity_basis: 'total' }),
    ]);
    expect(payload).toHaveProperty('nutrient_totals_elemental');
    expect(payload).toHaveProperty('nutrient_calc_coverage');
  });

  it('marks a catalog spray without resolved PHI as legacy_unverified', () => {
    const payload = buildDelegatedLogPayload(
      {
        type: 'spray',
        data: {
          waterVolume: 100,
          chemicals: [{ id: 'a', name: 'Mix', quantity: 1, unit: 'gm/L', quantityBasis: 'total' }],
          catalogMixId: 42,
          safeHarvestDate: null,
          governingPhiDays: null,
          phiStatus: null,
        },
      },
      { area: 1 },
    );
    expect(payload.phi_status).toBe('legacy_unverified');
    expect(payload.phi_calc_version).toBeNull();
    expect(payload.catalog_mix_id).toBe(42);
  });

  it('includes fertilizers, area, and nutrient totals for fertigation', () => {
    const payload = buildDelegatedLogPayload(
      {
        type: 'fertigation',
        data: {
          waterVolume: 50,
          fertilizers: [
            { id: 'f', name: 'Urea', quantity: 10, unit: 'kg', quantityBasis: 'total' },
          ],
        },
      },
      { area: 4 },
    );
    expect(payload.area).toBe(4);
    expect(payload.water_volume).toBe(50);
    expect(payload.fertilizers).toEqual([
      expect.objectContaining({ name: 'Urea', quantity: 10, quantity_basis: 'total' }),
    ]);
    expect(payload).toHaveProperty('nutrient_totals_elemental_per_acre');
  });
});
