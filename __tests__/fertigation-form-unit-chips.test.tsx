/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  FertigationForm,
  createEmptyFertigationFormData,
  type FertigationFormData,
} from '@/components/forms/fertigation-form';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';

jest.mock('@expo/ui/community/bottom-sheet', () =>
  require('../jest-setup/expo-ui-bottom-sheet-mock'),
);
jest.mock('@/data-access', () => {
  const dataAccess = { from: jest.fn() };
  return { getDataAccess: jest.fn(() => dataAccess), supabase: dataAccess };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'rate' in opts) return `${key}:${opts.quantity} ${opts.unit} → ${opts.rate}/acre`;
      if (opts && 'total' in opts)
        return `${key}:${opts.quantity} ${opts.unit} → ${opts.total} total`;
      if (opts && 'ratio' in opts) return `${key}:${opts.ratio}:${opts.reference}`;
      if (opts && 'unit' in opts) return `${key}:${opts.unit}`;
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
      onSurface: '#111',
      onSurfaceVariant: '#555',
      outline: '#999',
      outlineVariant: '#ddd',
      primary: '#357047',
      shadow: '#000',
      surface: '#fff',
      tertiary: '#587',
      warning: '#C58A2B',
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
    name: 'Urea',
    unit: 'kg',
    quantity: 10,
    quantityBasis: 'total',
    catalogProductId: 42,
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

function fertigationData(overrides: Partial<FertigationFormData> = {}): FertigationFormData {
  return { ...createEmptyFertigationFormData(), ...overrides };
}

function fertilizerRow(
  overrides: Partial<FertigationFormData['fertilizers'][number]> = {},
): FertigationFormData['fertilizers'][number] {
  return { ...createEmptyFertigationFormData().fertilizers[0], id: 'row-1', ...overrides };
}

describe('fused quantity + unit input', () => {
  it('renders one unit segment instead of an inline chip row', () => {
    const screen = render(<FertigationForm data={fertigationData()} onChange={jest.fn()} />);

    // Only the fused input's unit segment shows the active chip label.
    expect(screen.getAllByText('kg (total)').length).toBe(1);
    // No inline chips, no overflow trigger, and the old basis toggle stays gone.
    expect(screen.queryByText('kg/acre')).toBeNull();
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
    expect(screen.queryByText('Total Qty')).toBeNull();
    expect(screen.queryByText('Per acre')).toBeNull();
  });

  it('selecting kg/acre from the unit menu stores the bare unit plus explicit per_acre basis', () => {
    const onChange = jest.fn();
    const screen = render(<FertigationForm data={fertigationData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('kg (total)')); // unit segment → opens menu
    fireEvent.press(screen.getByText('kg/acre'));

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({ unit: 'kg', quantityBasis: 'per_acre' });
  });

  it('selecting a bare overflow unit keeps the unchanged total storage shape', () => {
    const onChange = jest.fn();
    const screen = render(<FertigationForm data={fertigationData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('kg (total)')); // unit segment → opens menu
    fireEvent.press(screen.getByText('gm (total)'));

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({ unit: 'gram', quantityBasis: 'total' });
  });

  it('an overflow selection renders as the active unit segment', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ unit: 'gram', quantityBasis: 'per_acre' })],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} />);

    expect(screen.getAllByText('gm/acre').length).toBeGreaterThan(0);
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
  });
});

describe('smart defaults', () => {
  it('manual add defaults to total — the bare kg chip', () => {
    expect(createEmptyFertigationFormData().fertilizers[0]).toMatchObject({
      unit: 'kg',
      quantityBasis: 'total',
    });

    const onChange = jest.fn();
    const data = fertigationData({
      fertilizers: [fertilizerRow({ name: 'Urea', quantity: 5 })],
    });
    const screen = render(<FertigationForm data={data} onChange={onChange} />);
    fireEvent.press(screen.getByText('fertigationForm.fertilizers.addFertilizer'));

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers).toHaveLength(2);
    expect(next.fertilizers[1]).toMatchObject({ unit: 'kg', quantityBasis: 'total' });
  });

  it('a plan pick lands on the per-acre chip via its explicit prefill basis', () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm data={fertigationData()} onChange={onChange} planItems={planItems} />,
    );

    fireEvent(screen.getByPlaceholderText('Fertilizer name'), 'focus');
    fireEvent.changeText(screen.getByPlaceholderText('Fertilizer name'), 'Plan');
    fireEvent.press(screen.getAllByText('PlanUrea')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'PlanUrea',
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p1',
    });
  });

  it("a history unit's own '/acre' testimony beats the pristine row's total default", () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData()}
        onChange={onChange}
        historyItems={[{ name: 'Humic acid', unit: 'L/acre', quantity: 2 }]}
      />,
    );

    fireEvent(screen.getByPlaceholderText('Fertilizer name'), 'focus');
    fireEvent.changeText(screen.getByPlaceholderText('Fertilizer name'), 'Hum');
    fireEvent.press(screen.getByText('Humic acid'));

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'Humic acid',
      unit: 'liter',
      quantityBasis: 'per_acre',
    });
  });

  it('a typeahead selection replaces the active row with the selected basis', () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData({
          fertilizers: [
            fertilizerRow({ name: 'Urea', unit: 'kg', quantity: 5, quantityBasis: 'per_acre' }),
          ],
        })}
        onChange={onChange}
        historyItems={[{ name: 'urea', unit: 'kg', quantity: 10, quantityBasis: 'total' }]}
      />,
    );

    // Complete rows render as receipts — tap to re-open for editing.
    fireEvent.press(screen.getAllByText('Urea')[0]);
    fireEvent(screen.getByPlaceholderText('Fertilizer name'), 'focus');
    fireEvent.changeText(screen.getByPlaceholderText('Fertilizer name'), 'ure');
    onChange.mockClear();
    fireEvent.press(screen.getByText('urea'));

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers).toHaveLength(1);
    expect(next.fertilizers[0]).toMatchObject({
      name: 'urea',
      quantity: 5,
      quantityBasis: 'total',
    });
  });

  it('a history pick keeps the basis it carries', () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData()}
        onChange={onChange}
        historyItems={[{ name: 'Urea', unit: 'kg', quantity: 10, quantityBasis: 'total' }]}
      />,
    );

    fireEvent(screen.getByPlaceholderText('Fertilizer name'), 'focus');
    fireEvent.changeText(screen.getByPlaceholderText('Fertilizer name'), 'Ure');
    fireEvent.press(screen.getAllByText('Urea')[0]);

    const next = onChange.mock.calls.at(-1)?.[0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'Urea',
      unit: 'kg',
      quantityBasis: 'total',
    });
  });
});

describe('bidirectional area echo', () => {
  it('translates a total entry into the per-acre rate on a fractional-acre farm', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ name: 'Urea', quantity: 10, unit: 'kg' })],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    // Complete rows render as receipts — expand to see the full echo line.
    fireEvent.press(screen.getAllByText('Urea')[0]);
    expect(
      screen.getByText(
        'fertigationForm.fertilizers.areaEcho.toPerAcre:10 kg (total) → ≈ 2.86 kg/acre',
      ),
    ).toBeTruthy();
  });

  it('translates a per-acre entry into the plot total', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({ name: 'Urea', quantity: 3, unit: 'kg', quantityBasis: 'per_acre' }),
      ],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    fireEvent.press(screen.getAllByText('Urea')[0]);
    expect(
      screen.getByText('fertigationForm.fertilizers.areaEcho.toTotal:3 kg/acre → ≈ 10.5 kg total'),
    ).toBeTruthy();
  });

  it('stays silent when no farm area is available', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ name: 'Urea', quantity: 10, unit: 'kg' })],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} />);

    fireEvent.press(screen.getAllByText('Urea')[0]);
    expect(screen.queryByText(/areaEcho/)).toBeNull();
  });
});

describe('dose guardrail', () => {
  it('warns against the linked plan item dose (10× per-acre)', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({
          name: 'PlanUrea',
          quantity: 50,
          unit: 'kg',
          quantityBasis: 'per_acre',
          planItemId: 'p1',
        }),
      ],
    });
    const screen = render(
      <FertigationForm data={data} onChange={jest.fn()} planItems={planItems} areaAcres={3.5} />,
    );

    fireEvent.press(screen.getAllByText('PlanUrea')[0]);
    expect(
      screen.getByText('fertigationForm.fertilizers.doseGuard.highPlan:10:5 kg/acre'),
    ).toBeTruthy();
  });

  it('warns on a 1000× entry vs the prior log of the same product', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({ name: 'Urea', quantity: 10000, unit: 'kg', catalogProductId: 42 }),
      ],
    });
    const screen = render(
      <FertigationForm data={data} onChange={jest.fn()} historyItems={historyItems} />,
    );

    fireEvent.press(screen.getAllByText('Urea')[0]);
    expect(
      screen.getByText('fertigationForm.fertilizers.doseGuard.highLastLog:1000:10 kg'),
    ).toBeTruthy();
  });

  it('is silent for a first-ever product log, whatever the dose', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ name: 'Brand New Fert', quantity: 5000, unit: 'kg' })],
    });
    const screen = render(
      <FertigationForm data={data} onChange={jest.fn()} historyItems={historyItems} />,
    );

    fireEvent.press(screen.getAllByText('Brand New Fert')[0]);
    expect(screen.queryByText(/doseGuard/)).toBeNull();
  });
});

describe('verbatim units (#192 testimony rule)', () => {
  it('renders the raw unit text in the unit segment — never coerced', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({
          name: 'Mystery mix',
          quantity: 5,
          unit: 'banana/acre',
          quantityBasis: 'per_acre',
        }),
      ],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    fireEvent.press(screen.getAllByText('Mystery mix')[0]);
    // The fused input's unit segment shows the verbatim string…
    expect(screen.getByText('banana/acre')).toBeTruthy();
    // …with the verbatim hint below…
    expect(
      screen.getByText('fertigationForm.fertilizers.verbatimUnitHint:banana/acre'),
    ).toBeTruthy();
    // …and no chip vocabulary leaks in (the unit menu stays closed).
    expect(screen.queryByText('kg/acre')).toBeNull();
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
    // Kernel-unknown units also keep the echo silent (no guessed conversion).
    expect(screen.queryByText(/areaEcho/)).toBeNull();
  });

  it('ppm rows stay verbatim', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({ name: 'GA3', quantity: 100, unit: 'ppm', quantityBasis: 'total' }),
      ],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    fireEvent.press(screen.getAllByText('GA3')[0]);
    expect(screen.getByText('ppm')).toBeTruthy();
    expect(screen.getByText('fertigationForm.fertilizers.verbatimUnitHint:ppm')).toBeTruthy();
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
  });
});
