import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  SprayForm,
  createEmptySprayFormData,
  type SprayFormData,
} from '@/components/forms/spray-form';
import { SEARCH_SELECT_DEBOUNCE_MS } from '@/components/ui/search-select';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { ChemicalMix } from '@/types/phi';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts?.query === 'string') return `${key}:${opts.query}`;
      return key;
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      error: '#c00',
      success: '#4F7A5A',
      onSurfaceVariant: '#555',
      outline: '#999',
      outlineVariant: '#ddd',
      primary: '#357047',
      shadow: '#000',
      surface: '#fff',
      tertiary: '#587',
    },
    primary: { p500: '#357047', p600: '#2d5f3c' },
    neutral: { n400: '#aaa', n500: '#888' },
    surface: {
      s50: '#fafafa',
      s100: '#fff',
      s200: '#eee',
      s300: '#ccc',
      s500: '#888',
      s600: '#666',
      s800: '#222',
      s900: '#111',
    },
  }),
}));

const historyItems: RecentInputItem[] = [
  {
    name: 'Karate',
    unit: 'ml/L',
    quantity: 2,
    quantityBasis: 'total',
    catalogProductId: 100,
    catalogMixId: 77,
  },
  {
    name: 'Solo',
    unit: 'gm/L',
    quantity: 1.5,
    quantityBasis: 'total',
    catalogProductId: 5,
  },
];

const planItems: FertilizerPlanItem[] = [
  {
    id: 'p1',
    name: 'PlanUrea',
    quantity: 5,
    unit: 'kg/acre',
    application_date: null,
    application_method: null,
    application_frequency: null,
    notes: null,
    sort_order: null,
  },
];

const catalogMixes: ChemicalMix[] = [
  {
    id: 77,
    name: 'Downy special',
    target_problem: 'Downy mildew',
    application_mode: 'preventive',
    source_page: null,
    is_active: true,
    components: [
      {
        id: 1,
        mix_id: 77,
        product_id: 100,
        product_name: 'Karate',
        active_ingredient: 'Lambda',
        dose_value: 2,
        dose_unit: 'ml',
        dose_basis: 'per_liter',
        base_tank_liters: null,
        phi_days: 7,
        phi_verified: true,
        phi_source: 'label',
      },
      {
        id: 2,
        mix_id: 77,
        product_id: 200,
        product_name: 'Curzate',
        active_ingredient: 'Cymoxanil',
        dose_value: 150,
        dose_unit: 'gm',
        dose_basis: 'per_100_liter',
        base_tank_liters: null,
        phi_days: null,
        phi_verified: false,
        phi_source: 'unknown',
      },
    ],
  },
];

function renderSprayForm(onChange: (data: SprayFormData) => void) {
  const data = createEmptySprayFormData();
  const screen = render(
    <SprayForm
      data={data}
      onChange={onChange}
      historyItems={historyItems}
      planItems={planItems}
      catalogMixes={catalogMixes}
    />,
  );
  // "Add chemical" opens the sectioned picker (there are options to pick from).
  fireEvent.press(screen.getByText('sprayForm.chemicals.addChemical'));
  return screen;
}

describe('SprayForm × SearchSelect adoption', () => {
  it('fills the empty row with full identity when a plain history row is tapped', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    fireEvent.press(screen.getByText('Solo'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals).toHaveLength(1);
    expect(next.chemicals[0]).toMatchObject({
      name: 'Solo',
      quantity: 1.5,
      unit: 'gm/L',
      quantityBasis: 'total',
      catalogProductId: 5,
      warehouseItemId: null,
      planItemId: null,
    });
    // No mix involved → record-level mix identity untouched.
    expect(next.catalogMixId ?? null).toBeNull();
  });

  it('restores the whole mix when a history row logged as a mix is tapped', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    // 'Karate' also exists as a derived catalog product row; the history
    // section renders first, so the first match is the history row.
    fireEvent.press(screen.getAllByText('Karate')[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.catalogMixId).toBe(77);
    expect(next.catalogMixName).toBe('Downy special');
    expect(next.chemicals.map((c) => c.name)).toEqual(['Karate', 'Curzate']);
    expect(next.chemicals.map((c) => c.catalogProductId)).toEqual([100, 200]);
    expect(next.chemicals.map((c) => `${c.quantity} ${c.unit}`)).toEqual(['2 ml/L', '1.5 gm/L']);
  });

  it('stamps planItemId and keeps the per-acre basis for plan-item selections', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    fireEvent.press(screen.getByText('PlanUrea'));

    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'PlanUrea',
      quantity: 5,
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p1',
      catalogProductId: null,
    });
  });

  it('adds a plain custom row from the escape hatch', () => {
    jest.useFakeTimers();
    try {
      const onChange = jest.fn();
      const screen = renderSprayForm(onChange);

      fireEvent.changeText(
        screen.getByPlaceholderText('searchSelect.searchPlaceholder'),
        'Brand New Chem',
      );
      act(() => {
        jest.advanceTimersByTime(SEARCH_SELECT_DEBOUNCE_MS + 50);
      });
      fireEvent.press(screen.getByText('searchSelect.addCustom:Brand New Chem'));

      const next = onChange.mock.calls[0][0] as SprayFormData;
      expect(next.chemicals[0]).toMatchObject({
        name: 'Brand New Chem',
        unit: 'gm/L',
        catalogProductId: null,
        warehouseItemId: null,
        planItemId: null,
      });
      expect(next.catalogMixId ?? null).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
