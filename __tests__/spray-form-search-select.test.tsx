import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  SprayForm,
  createEmptySprayFormData,
  type SprayFormData,
} from '@/components/forms/spray-form';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';
import type { ChemicalMix } from '@/types/phi';

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
    product_id: null,
    quantity_basis: null,
  },
  {
    id: 'p2',
    name: 'PlanMagnesium',
    quantity: 3,
    unit: 'Kg per Acre',
    application_date: null,
    application_method: null,
    application_frequency: null,
    notes: null,
    sort_order: null,
    product_id: null,
    quantity_basis: null,
  },
  {
    id: 'p3',
    name: 'PlanZinc',
    quantity: 200,
    unit: 'g/acre',
    application_date: null,
    application_method: null,
    application_frequency: null,
    notes: null,
    sort_order: null,
    product_id: null,
    quantity_basis: null,
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

const invalidCatalogMix: ChemicalMix = {
  id: 88,
  name: 'Invalid mix',
  target_problem: 'Unknown',
  application_mode: 'preventive',
  source_page: null,
  is_active: true,
  components: [
    {
      id: 3,
      mix_id: 88,
      product_id: 300,
      product_name: 'Broken dose',
      active_ingredient: null,
      dose_value: 10,
      dose_unit: 'gm',
      dose_basis: 'fixed_per_tank',
      base_tank_liters: null,
      phi_days: null,
      phi_verified: false,
      phi_source: 'unknown',
    },
  ],
};

/**
 * Stateful harness: the ChemicalRow name field is parent-controlled, so the
 * typeahead only opens when onChange round-trips into fresh data.
 */
function Harness({
  initial,
  onChange,
  mixes,
}: {
  initial: SprayFormData;
  onChange: (data: SprayFormData) => void;
  mixes: ChemicalMix[];
}) {
  const [data, setData] = useState(initial);
  return (
    <SprayForm
      data={data}
      onChange={(next) => {
        setData(next);
        onChange(next);
      }}
      historyItems={historyItems}
      planItems={planItems}
      catalogMixes={mixes}
    />
  );
}

function renderSprayForm(
  onChange: (data: SprayFormData) => void,
  data: SprayFormData = createEmptySprayFormData(),
  mixes: ChemicalMix[] = catalogMixes,
) {
  return render(<Harness initial={data} onChange={onChange} mixes={mixes} />);
}

/** Type into the empty row's name field so the typeahead opens. */
function typeName(screen: ReturnType<typeof render>, text: string) {
  const input = screen.getByPlaceholderText('sprayForm.chemicals.namePlaceholder');
  fireEvent(input, 'focus', { target: null });
  fireEvent.changeText(input, text);
}

describe('SprayForm typeahead adoption', () => {
  it('fills the row with full identity when a plain history option is tapped', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    typeName(screen, 'Sol');
    fireEvent.press(screen.getByText('Solo'));

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
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

  it('restores the whole mix when a history option logged as a mix is tapped', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    // 'Karate' also exists as a derived catalog product row; the history
    // section renders first, so the first match is the history row.
    typeName(screen, 'Kar');
    fireEvent.press(screen.getAllByText('Karate')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.catalogMixId).toBe(77);
    expect(next.catalogMixName).toBe('Downy special');
    expect(next.chemicals.map((c) => c.name)).toEqual(['Karate', 'Curzate']);
    expect(next.chemicals.map((c) => c.catalogProductId)).toEqual([100, 200]);
    expect(next.chemicals.map((c) => `${c.quantity} ${c.unit}`)).toEqual(['2 ml/L', '1.5 gm/L']);
  });

  it('stamps planItemId and keeps the per-acre basis for plan-item selections', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    typeName(screen, 'PlanUrea');
    fireEvent.press(screen.getAllByText('PlanUrea')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'PlanUrea',
      quantity: 5,
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p1',
      catalogProductId: null,
    });
  });

  it('folds freeform unit spellings — "Kg per Acre" resolves to kg + per_acre', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    typeName(screen, 'PlanMag');
    fireEvent.press(screen.getAllByText('PlanMagnesium')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'PlanMagnesium',
      quantity: 3,
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p2',
    });
  });

  it("resolves the canonical plan spelling 'g/acre' to gram + per_acre, never gm/L", () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    typeName(screen, 'PlanZinc');
    fireEvent.press(screen.getAllByText('PlanZinc')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'PlanZinc',
      quantity: 200,
      unit: 'gram',
      quantityBasis: 'per_acre',
      planItemId: 'p3',
    });
  });

  it('keeps existing custom rows and appends the mix instead of wiping them', () => {
    const onChange = jest.fn();
    const base = createEmptySprayFormData();
    const initial: SprayFormData = {
      ...base,
      waterVolume: 200,
      chemicals: [
        { ...base.chemicals[0], id: 'custom1', name: 'My Custom Chem', quantity: 3 },
        { ...base.chemicals[0], id: 'blank1' },
      ],
    };
    const screen = renderSprayForm(onChange, initial);

    // Pick a catalog mix from the still-blank second row's typeahead.
    typeName(screen, 'Kar');
    fireEvent.press(screen.getAllByText('Karate')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    // Custom row survives; the mix's components are appended after it.
    expect(next.chemicals.map((c) => c.name)).toEqual(['My Custom Chem', 'Karate', 'Curzate']);
    expect(next.chemicals[0]).toMatchObject({ name: 'My Custom Chem', quantity: 3 });
    // Combined tank → mix identity/PHI dropped (can't vouch for the custom row).
    expect(next.catalogMixId ?? null).toBeNull();
  });

  it('drops the stale triggering row when every mix component is already present', () => {
    const onChange = jest.fn();
    const base = createEmptySprayFormData();
    const initial: SprayFormData = {
      ...base,
      waterVolume: 200,
      // Stale identity + verified PHI from a previously selected mix.
      catalogMixId: 999,
      catalogMixName: 'Old mix',
      governingPhiDays: 7,
      safeHarvestDate: '2026-12-31',
      phiStatus: 'verified',
      chemicals: [
        // Both of mix 77's components (product_id 100 + 200) already in the tank.
        {
          ...base.chemicals[0],
          id: 'a',
          name: 'Alpha',
          catalogProductId: 100,
          quantity: 2,
          unit: 'ml/L',
        },
        {
          ...base.chemicals[0],
          id: 'b',
          name: 'Beta',
          catalogProductId: 200,
          quantity: 150,
          unit: 'gm/L',
        },
        { ...base.chemicals[0], id: 'blank1' },
      ],
    };
    const screen = renderSprayForm(onChange, initial);

    // Type a query into the blank row, then pick the mix — nothing new to add.
    typeName(screen, 'Kar');
    fireEvent.press(screen.getAllByText('Karate')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    // Existing rows survive; the triggering row (its stale "Kar" query) is gone —
    // no duplicates appended, no stale row left behind.
    expect(next.chemicals.map((c) => c.name)).toEqual(['Alpha', 'Beta']);
    // The tank isn't this mix, so prior identity + PHI are dropped (never
    // inherit another mix's verified safe-harvest date).
    expect(next.catalogMixId ?? null).toBeNull();
    expect(next.catalogMixName ?? null).toBeNull();
    expect(next.safeHarvestDate ?? null).toBeNull();
    expect(next.governingPhiDays ?? null).toBeNull();
    expect(next.phiStatus ?? null).toBeNull();
  });

  it('keeps a blank editable row when a mix has no valid components', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange, createEmptySprayFormData(), [invalidCatalogMix]);

    typeName(screen, 'Invalid');
    fireEvent.press(screen.getByText('Invalid mix'));

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.chemicals).toHaveLength(1);
    expect(next.chemicals[0]).toMatchObject({
      name: '',
      quantity: undefined,
      unit: 'gm/L',
    });
  });

  it('adds a plain custom row from the escape hatch', () => {
    const onChange = jest.fn();
    const screen = renderSprayForm(onChange);

    typeName(screen, 'Brand New Chem');
    fireEvent.press(screen.getByText('searchSelect.addCustom:Brand New Chem'));

    const next = onChange.mock.calls.at(-1)?.[0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'Brand New Chem',
      unit: 'gm/L',
      catalogProductId: null,
      warehouseItemId: null,
      planItemId: null,
    });
    expect(next.catalogMixId ?? null).toBeNull();
  });
});
