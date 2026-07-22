import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import {
  FertigationForm,
  createEmptyFertigationFormData,
  type FertigationFormData,
} from '@/components/forms/fertigation-form';
import { SEARCH_SELECT_DEBOUNCE_MS } from '@/components/ui/search-select';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { MasterCatalogProduct } from '@/types/catalog';

jest.mock('@/data-access', () => {
  const dataAccess = { from: jest.fn() };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts?.query === 'string') return `${key}:${opts.query}`;
      return key;
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({ Symbol: () => null }));

jest.mock('@/components/ui/unit-picker-modal', () => ({
  UnitPickerModal: () => null,
}));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      error: '#c00',
      success: '#4F7A5A',
      onSurface: '#111',
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
    name: 'WarehouseUrea',
    unit: 'kg',
    quantity: 10,
    quantityBasis: 'total',
    warehouseItemId: 9,
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
    product_id: null,
    quantity_basis: null,
  },
];

const catalogProducts: MasterCatalogProduct[] = [
  {
    id: 500,
    name: '19:19:19',
    manufacturer: 'IFFCO',
    active_ingredient: null,
    input_type: 'fertilizer',
    verification_tier: 'verified',
    formulation: null,
    state_code: 'MH',
    source_reference: null,
    is_active: true,
    aliases: [],
    compositions: [
      {
        id: 1,
        product_id: 500,
        component_code: 'N',
        component_type: 'nutrient',
        percent: 19,
        basis: 'declared',
        verified: true,
      },
    ],
  },
];

function renderFertigationForm(onChange: (data: FertigationFormData) => void) {
  const data = createEmptyFertigationFormData();
  const screen = render(
    <FertigationForm
      data={data}
      onChange={onChange}
      historyItems={historyItems}
      planItems={planItems}
      catalogProducts={catalogProducts}
    />,
  );
  // "Add fertilizer" opens the sectioned picker (there are options to pick from).
  fireEvent.press(screen.getByText('fertigationForm.fertilizers.addFertilizer'));
  return screen;
}

describe('FertigationForm × SearchSelect adoption', () => {
  it('fills the empty row with identity when a history row is tapped (warehouse id passes through)', () => {
    const onChange = jest.fn();
    const screen = renderFertigationForm(onChange);

    fireEvent.press(screen.getByText('WarehouseUrea'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers).toHaveLength(1);
    expect(next.fertilizers[0]).toMatchObject({
      name: 'WarehouseUrea',
      quantity: 10,
      unit: 'kg',
      // The history row's explicit basis wins over the pristine row default.
      quantityBasis: 'total',
      warehouseItemId: 9,
      catalogProductId: null,
      planItemId: null,
      compositionSnapshot: null,
    });
  });

  it('stamps planItemId and the per-acre prescribed dose for plan-item selections', () => {
    const onChange = jest.fn();
    const screen = renderFertigationForm(onChange);

    fireEvent.press(screen.getByText('PlanUrea'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'PlanUrea',
      quantity: 5,
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p1',
      warehouseItemId: null,
      catalogProductId: null,
    });
  });

  it('stamps catalogProductId + composition_snapshot for catalog picks (nutrient ledger, #200)', () => {
    const onChange = jest.fn();
    const screen = renderFertigationForm(onChange);

    fireEvent.press(screen.getByText('19:19:19'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: '19:19:19',
      catalogProductId: 500,
      planItemId: null,
      warehouseItemId: null,
      compositionSnapshot: [{ nutrient_code: 'N', percent: 19, basis: 'declared' }],
    });
  });

  it('finds the canonical "19:19:19" catalog row when searching "19-19-19"', () => {
    jest.useFakeTimers();
    try {
      const onChange = jest.fn();
      const screen = renderFertigationForm(onChange);

      fireEvent.changeText(
        screen.getByPlaceholderText('searchSelect.searchPlaceholder'),
        '19-19-19',
      );
      act(() => {
        jest.advanceTimersByTime(SEARCH_SELECT_DEBOUNCE_MS + 50);
      });
      fireEvent.press(screen.getByText('19:19:19'));

      const next = onChange.mock.calls[0][0] as FertigationFormData;
      // The canonical catalog name is stored, not the typed spelling.
      expect(next.fertilizers[0]).toMatchObject({ name: '19:19:19', catalogProductId: 500 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('adds a plain custom row from the escape hatch', () => {
    jest.useFakeTimers();
    try {
      const onChange = jest.fn();
      const screen = renderFertigationForm(onChange);

      fireEvent.changeText(
        screen.getByPlaceholderText('searchSelect.searchPlaceholder'),
        'Brand New Fert',
      );
      act(() => {
        jest.advanceTimersByTime(SEARCH_SELECT_DEBOUNCE_MS + 50);
      });
      fireEvent.press(screen.getByText('searchSelect.addCustom:Brand New Fert'));

      const next = onChange.mock.calls[0][0] as FertigationFormData;
      expect(next.fertilizers[0]).toMatchObject({
        name: 'Brand New Fert',
        unit: 'kg',
        warehouseItemId: null,
        catalogProductId: null,
        planItemId: null,
        compositionSnapshot: null,
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
