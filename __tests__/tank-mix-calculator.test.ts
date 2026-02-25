import { computeTankMixQuantities } from '@/services/phi-service';
import type { ChemicalMix } from '@/types/phi';

const mix: ChemicalMix = {
  id: 1,
  name: 'Test Mix',
  is_active: true,
  target_problem: 'Demo',
  application_mode: 'preventive',
  source_page: 1,
  components: [
    {
      id: 1,
      mix_id: 1,
      product_id: 11,
      product_name: 'Per Liter Product',
      dose_value: 2,
      dose_unit: 'gm',
      dose_basis: 'per_liter',
      phi_days: 10,
      phi_source: 'Label',
    },
    {
      id: 2,
      mix_id: 1,
      product_id: 12,
      product_name: 'Per 100L Product',
      dose_value: 150,
      dose_unit: 'ml',
      dose_basis: 'per_100_liter',
      phi_days: 7,
      phi_source: 'Label',
    },
    {
      id: 3,
      mix_id: 1,
      product_id: 13,
      product_name: 'Fixed Tank Product',
      dose_value: 400,
      dose_unit: 'gm',
      dose_basis: 'fixed_per_tank',
      base_tank_liters: 200,
      phi_days: 14,
      phi_source: 'Label',
    },
  ],
};

describe('tank mix calculator', () => {
  it('calculates per-liter basis correctly', () => {
    const rows = computeTankMixQuantities(mix, 200);
    const row = rows.find((item) => item.productName === 'Per Liter Product');
    expect(row?.totalQuantity).toBe(400);
  });

  it('calculates per-100L basis correctly', () => {
    const rows = computeTankMixQuantities(mix, 200);
    const row = rows.find((item) => item.productName === 'Per 100L Product');
    expect(row?.totalQuantity).toBe(300);
  });

  it('calculates fixed-per-tank basis correctly', () => {
    const rows = computeTankMixQuantities(mix, 400);
    const row = rows.find((item) => item.productName === 'Fixed Tank Product');
    expect(row?.totalQuantity).toBe(800);
  });
});
