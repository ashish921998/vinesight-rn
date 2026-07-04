import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  FertigationForm,
  createEmptyFertigationFormData,
  type FertigationFormData,
} from '@/components/forms/fertigation-form';
import type { RecentInputItem } from '@/hooks/use-records';
import type { FertilizerPlanItem } from '@/types/fertilizer-plan';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

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

describe('basis-fused unit chips', () => {
  it('renders exactly kg/acre, L/acre, kg, L plus the overflow trigger; the basis toggle is gone', () => {
    const screen = render(<FertigationForm data={fertigationData()} onChange={jest.fn()} />);

    for (const label of ['kg/acre', 'L/acre', 'L']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // 'kg' appears twice: as the selected chip and as the row's unit label.
    expect(screen.getAllByText('kg').length).toBe(2);
    expect(screen.getByText('fertigationForm.fertilizers.moreUnits')).toBeTruthy();
    // The old separate per-acre/total toggle must not exist, and bare chips
    // carry no "total" wording.
    expect(screen.queryByText('Total Qty')).toBeNull();
    expect(screen.queryByText('Per acre')).toBeNull();
    expect(screen.queryByText(/total/i)).toBeNull();
  });

  it('selecting kg/acre stores the existing bare unit spelling plus explicit per_acre basis', () => {
    const onChange = jest.fn();
    const screen = render(<FertigationForm data={fertigationData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('kg/acre'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({ unit: 'kg', quantityBasis: 'per_acre' });
  });

  it('selecting a bare overflow chip keeps the unchanged total storage shape', () => {
    const onChange = jest.fn();
    const screen = render(<FertigationForm data={fertigationData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('fertigationForm.fertilizers.moreUnits'));
    fireEvent.press(screen.getByText('g'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({ unit: 'gram', quantityBasis: 'total' });
  });

  it('an overflow selection renders as the active overflow trigger', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ unit: 'gram', quantityBasis: 'per_acre' })],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} />);

    expect(screen.getAllByText('g/acre').length).toBeGreaterThan(0);
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
    // No picker options → the add button appends a blank manual row.
    const screen = render(<FertigationForm data={data} onChange={onChange} />);
    fireEvent.press(screen.getByText('fertigationForm.fertilizers.addFertilizer'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers).toHaveLength(2);
    expect(next.fertilizers[1]).toMatchObject({ unit: 'kg', quantityBasis: 'total' });
  });

  it('a plan quick-add lands on the per-acre chip via its explicit prefill basis', () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData()}
        onChange={onChange}
        quickAddItems={[
          {
            name: 'PlanUrea',
            unit: 'kg',
            quantity: 5,
            quantityBasis: 'per_acre',
            planItemId: 'p1',
          },
        ]}
      />,
    );

    fireEvent.press(screen.getByText('PlanUrea'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'PlanUrea',
      unit: 'kg',
      quantityBasis: 'per_acre',
      planItemId: 'p1',
    });
  });

  it("a quick-add unit's own '/acre' testimony beats the pristine row's total default", () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData()}
        onChange={onChange}
        quickAddItems={[{ name: 'Humic acid', unit: 'L/acre', quantity: 2 }]}
      />,
    );

    fireEvent.press(screen.getByText('Humic acid'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
    expect(next.fertilizers[0]).toMatchObject({
      name: 'Humic acid',
      unit: 'liter',
      quantityBasis: 'per_acre',
    });
  });

  it('a history quick-add keeps the basis it carries', () => {
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={fertigationData()}
        onChange={onChange}
        quickAddItems={[{ name: 'Urea', unit: 'kg', quantity: 10, quantityBasis: 'total' }]}
      />,
    );

    fireEvent.press(screen.getByText('Urea'));

    const next = onChange.mock.calls[0][0] as FertigationFormData;
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

    expect(
      screen.getByText('fertigationForm.fertilizers.areaEcho.toPerAcre:10 kg → ≈ 2.86 kg/acre'),
    ).toBeTruthy();
  });

  it('translates a per-acre entry into the plot total', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({ name: 'Urea', quantity: 3, unit: 'kg', quantityBasis: 'per_acre' }),
      ],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    expect(
      screen.getByText('fertigationForm.fertilizers.areaEcho.toTotal:3 kg/acre → ≈ 10.5 kg total'),
    ).toBeTruthy();
  });

  it('stays silent when no farm area is available', () => {
    const data = fertigationData({
      fertilizers: [fertilizerRow({ name: 'Urea', quantity: 10, unit: 'kg' })],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} />);

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

    expect(screen.queryByText(/doseGuard/)).toBeNull();
  });
});

describe('verbatim units (#192 testimony rule)', () => {
  it('renders the raw unit text where the chip row would be — no chips, never coerced', () => {
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

    // The row's unit label shows the verbatim string…
    expect(screen.getByText('banana/acre')).toBeTruthy();
    // …the chip row is replaced by the verbatim hint…
    expect(
      screen.getByText('fertigationForm.fertilizers.verbatimUnitHint:banana/acre'),
    ).toBeTruthy();
    // …and no chip or overflow control renders.
    expect(screen.queryByText('kg/acre')).toBeNull();
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
    // Kernel-unknown units also keep the echo silent (no guessed conversion).
    expect(screen.queryByText(/areaEcho/)).toBeNull();
  });

  it('ppm rows stay verbatim and chipless', () => {
    const data = fertigationData({
      fertilizers: [
        fertilizerRow({ name: 'GA3', quantity: 100, unit: 'ppm', quantityBasis: 'total' }),
      ],
    });
    const screen = render(<FertigationForm data={data} onChange={jest.fn()} areaAcres={3.5} />);

    expect(screen.getByText('ppm')).toBeTruthy();
    expect(screen.getByText('fertigationForm.fertilizers.verbatimUnitHint:ppm')).toBeTruthy();
    expect(screen.queryByText('fertigationForm.fertilizers.moreUnits')).toBeNull();
  });
});
