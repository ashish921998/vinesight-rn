jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import {
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
