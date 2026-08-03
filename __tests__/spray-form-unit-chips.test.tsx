/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  SprayForm,
  createEmptySprayFormData,
  type SprayFormData,
} from '@/components/forms/spray-form';
import { useSprayUnitStore } from '@/stores/spray-unit-store';
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
      if (opts && 'total' in opts) {
        return `${key}:${opts.quantity} ${opts.unit} × ${opts.water ?? opts.area} = ${opts.total}`;
      }
      if (opts && 'ratio' in opts) return `${key}:${opts.ratio}:${opts.reference}`;
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
    name: 'Karate',
    unit: 'ml/L',
    quantity: 2,
    quantityBasis: 'total',
    catalogProductId: 100,
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

function sprayData(overrides: Partial<SprayFormData> = {}): SprayFormData {
  return { ...createEmptySprayFormData(), ...overrides };
}

function chemicalRow(
  overrides: Partial<SprayFormData['chemicals'][number]> = {},
): SprayFormData['chemicals'][number] {
  return { ...createEmptySprayFormData().chemicals[0], ...overrides };
}

beforeEach(() => {
  useSprayUnitStore.setState({ lastUsedChips: {} });
});

describe('fused quantity + unit input', () => {
  it('renders one unit segment instead of an inline chip row', () => {
    const screen = render(<SprayForm data={sprayData()} onChange={jest.fn()} />);

    // Only the fused input's unit segment shows the active chip key.
    expect(screen.getAllByText('g/L').length).toBe(1);
    // No inline chips, no overflow trigger, and the old basis toggle stays gone.
    for (const label of ['mL/L', 'g/acre', 'mL/acre', 'ppm']) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByText('sprayForm.chemicals.moreUnits')).toBeNull();
    expect(screen.queryByText('sprayForm.chemicals.totalQty')).toBeNull();
    expect(screen.queryByText('sprayForm.chemicals.perAcre')).toBeNull();
  });

  it('selecting g/acre from the unit menu stores the bare unit plus explicit per_acre basis', () => {
    const onChange = jest.fn();
    const screen = render(<SprayForm data={sprayData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('g/L')); // unit segment → opens menu
    fireEvent.press(screen.getByText('g/acre'));

    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({ unit: 'gram', quantityBasis: 'per_acre' });
  });

  it('selecting an overflow total keeps the unchanged total storage shape', () => {
    const onChange = jest.fn();
    const screen = render(<SprayForm data={sprayData()} onChange={onChange} />);

    fireEvent.press(screen.getByText('g/L')); // unit segment → opens menu
    // The picker renders the chip's clearer label ("kg (total)"), not its
    // stable persistence key ("kg total").
    fireEvent.press(screen.getByText('kg (total)'));

    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({ unit: 'kg', quantityBasis: 'total' });
  });

  it('a plan prefill row (kg + per_acre) renders its chip as the active unit segment', () => {
    const data = sprayData({
      chemicals: [chemicalRow({ name: 'PlanUrea', unit: 'kg', quantityBasis: 'per_acre' })],
    });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} />);

    expect(screen.getAllByText('kg/acre').length).toBeGreaterThan(0);
    expect(screen.queryByText('sprayForm.chemicals.moreUnits')).toBeNull();
  });
});

describe('tank echo line', () => {
  it('shows the kernel-resolved tank total for a g/L dose and updates with the entry', () => {
    const row = chemicalRow({ name: 'Copper', quantity: 2, unit: 'gm/L' });
    const data = sprayData({ waterVolume: 400, chemicals: [row] });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} />);

    // Complete rows render as receipts — expand to see the full echo line.
    fireEvent.press(screen.getByText('Copper'));
    expect(screen.getByText('sprayForm.chemicals.tankEcho.water:2 g/L × 400 = 800 g')).toBeTruthy();

    // Live: the echo re-derives from the controlled data on every change
    // (same row id, so the expanded editing state persists).
    screen.rerender(
      <SprayForm
        data={sprayData({ waterVolume: 400, chemicals: [{ ...row, quantity: 3 }] })}
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByText('sprayForm.chemicals.tankEcho.water:3 g/L × 400 = 1.2 kg'),
    ).toBeTruthy();
  });

  it('resolves per-acre doses against the farm area', () => {
    const data = sprayData({
      waterVolume: 400,
      chemicals: [
        chemicalRow({ name: 'Copper', quantity: 100, unit: 'gram', quantityBasis: 'per_acre' }),
      ],
    });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} areaAcres={2.5} />);

    fireEvent.press(screen.getByText('Copper'));
    expect(
      screen.getByText('sprayForm.chemicals.tankEcho.area:100 g/acre × 2.5 = 250 g'),
    ).toBeTruthy();
  });

  it('stays silent when the resolving context is missing', () => {
    const data = sprayData({
      chemicals: [chemicalRow({ name: 'Copper', quantity: 2, unit: 'gm/L' })],
    });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} />);

    expect(screen.queryByText(/tankEcho/)).toBeNull();
  });
});

describe('dose guardrail', () => {
  it('warns on a 1000× entry vs the prior log of the same product', () => {
    const data = sprayData({
      waterVolume: 400,
      chemicals: [
        chemicalRow({ name: 'Karate', quantity: 2000, unit: 'ml/L', catalogProductId: 100 }),
      ],
    });
    const screen = render(
      <SprayForm data={data} onChange={jest.fn()} historyItems={historyItems} />,
    );

    fireEvent.press(screen.getByText('Karate'));
    // Reference units keep their stored casing ('ml/L') — the old lowercase
    // rendering was an artifact of the deleted foldUnitText (#207).
    expect(screen.getByText('sprayForm.chemicals.doseGuard.highLastLog:1000:2 ml/L')).toBeTruthy();
  });

  it('warns against the linked plan item dose (10× per-acre)', () => {
    const data = sprayData({
      waterVolume: 400,
      chemicals: [
        chemicalRow({
          name: 'PlanUrea',
          quantity: 50,
          unit: 'kg',
          quantityBasis: 'per_acre',
          planItemId: 'p1',
        }),
      ],
    });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} planItems={planItems} />);

    fireEvent.press(screen.getByText('PlanUrea'));
    expect(screen.getByText('sprayForm.chemicals.doseGuard.highPlan:10:5 kg/acre')).toBeTruthy();
  });

  it('is silent for a first-ever product log, whatever the dose', () => {
    const data = sprayData({
      waterVolume: 400,
      chemicals: [chemicalRow({ name: 'Brand New Chem', quantity: 5000, unit: 'gm/L' })],
    });
    const screen = render(
      <SprayForm data={data} onChange={jest.fn()} historyItems={historyItems} />,
    );

    expect(screen.queryByText(/doseGuard/)).toBeNull();
  });
});

describe('last-used chip persistence', () => {
  it('records the chip on explicit selection, keyed by catalog identity', () => {
    const data = sprayData({
      chemicals: [chemicalRow({ name: 'Karate', catalogProductId: 100 })],
    });
    const screen = render(<SprayForm data={data} onChange={jest.fn()} />);

    fireEvent.press(screen.getByText('g/L')); // unit segment → opens menu
    fireEvent.press(screen.getByText('ppm'));

    expect(useSprayUnitStore.getState().lastUsedChips['catalog:100']).toBe('ppm');
  });

  it('preselects the last-used chip when the product name is typed into a pristine row', () => {
    useSprayUnitStore.getState().setLastUsedChip('name:copper', 'g/acre');
    const onChange = jest.fn();
    const screen = render(<SprayForm data={sprayData()} onChange={onChange} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('sprayForm.chemicals.namePlaceholder'),
      'Copper',
    );

    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({
      name: 'Copper',
      unit: 'gram',
      quantityBasis: 'per_acre',
    });
  });

  it('never overrides the unit once a dose has been entered', () => {
    useSprayUnitStore.getState().setLastUsedChip('name:copper', 'g/acre');
    const onChange = jest.fn();
    const data = sprayData({
      chemicals: [chemicalRow({ quantity: 2, unit: 'ml/L' })],
    });
    const screen = render(<SprayForm data={data} onChange={onChange} />);

    fireEvent.changeText(
      screen.getByPlaceholderText('sprayForm.chemicals.namePlaceholder'),
      'Copper',
    );

    const next = onChange.mock.calls[0][0] as SprayFormData;
    expect(next.chemicals[0]).toMatchObject({ name: 'Copper', unit: 'ml/L' });
  });
});
