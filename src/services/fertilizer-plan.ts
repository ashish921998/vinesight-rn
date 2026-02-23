import type { FertilizerPlan } from '@/types/fertilizer-plan';

const MOCK_PLANS: FertilizerPlan[] = [
  {
    farm_id: 1,
    consultant_name: 'Consultant',
    updated_at: new Date().toISOString(),
    notes: 'Apply after irrigation. Maintain uniform coverage across blocks.',
    items: [
      { name: 'Urea', quantity: 8, unit: 'kg/acre' },
      { name: 'MAP 12-61-0', quantity: 4, unit: 'kg/acre' },
      { name: 'Potassium Sulphate', quantity: 6, unit: 'kg/acre' },
    ],
  },
];

export async function fetchFertilizerPlanForFarm(farmId: number): Promise<FertilizerPlan | null> {
  // Placeholder implementation: replace with Supabase query once schema is available.
  if (__DEV__) {
    const match = MOCK_PLANS.find((plan) => plan.farm_id === farmId);
    if (match) {
      return {
        ...match,
        items: match.items.map((item) => ({ ...item })),
      };
    }
    return {
      ...MOCK_PLANS[0],
      farm_id: farmId,
      items: MOCK_PLANS[0].items.map((item) => ({ ...item })),
    };
  }
  // TODO: Replace with a Supabase-backed query once the fertilizer plan schema is finalized.
  return null;
}
