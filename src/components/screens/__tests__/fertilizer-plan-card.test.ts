import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import { planItemQuantityDisplay } from '../fertilizer-plan-card';

function planItem(overrides: Partial<FertilizerPlanItem>): FertilizerPlanItem {
  return {
    id: 'item-1',
    name: 'Input',
    quantity: null,
    unit: null,
    application_date: null,
    application_method: null,
    application_frequency: null,
    notes: null,
    sort_order: null,
    product_id: null,
    quantity_basis: null,
    ...overrides,
  };
}

describe('planItemQuantityDisplay', () => {
  it('promotes the plot total headline for acre-safe per-acre plan items', () => {
    const display = planItemQuantityDisplay(planItem({ quantity: 250, unit: 'ml/acre' }), 3.5);

    expect(display).toEqual({
      headline: '≈ 875 ml',
      subtitle: '250 ml/acre',
      isDerivedTotal: true,
    });
  });

  it('falls back to the stored rate when area provenance is ambiguous or missing', () => {
    const display = planItemQuantityDisplay(planItem({ quantity: 250, unit: 'ml/acre' }), null);

    expect(display).toEqual({
      headline: '250 ml/acre',
      subtitle: null,
      isDerivedTotal: false,
    });
  });

  it('keeps ppm items rate-only with no derived headline', () => {
    const display = planItemQuantityDisplay(planItem({ quantity: 100, unit: 'ppm' }), 3.5);

    expect(display).toEqual({
      headline: '100 ppm',
      subtitle: null,
      isDerivedTotal: false,
    });
  });

  it('treats bare plan units as per-acre rates', () => {
    const display = planItemQuantityDisplay(planItem({ quantity: 10, unit: 'kg' }), 3.5);

    expect(display).toEqual({
      headline: '≈ 35 kg',
      subtitle: '10 kg',
      isDerivedTotal: true,
    });
  });

  it('preserves count unit labels on derived plot totals', () => {
    const display = planItemQuantityDisplay(planItem({ quantity: 2, unit: 'bag/acre' }), 3.5);

    expect(display).toEqual({
      headline: '≈ 7 bag',
      subtitle: '2 bag/acre',
      isDerivedTotal: true,
    });
  });
});
