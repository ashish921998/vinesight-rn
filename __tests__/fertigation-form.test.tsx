import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  FertigationForm,
  type FertigationFormData,
  type FertigationQuickAddItem,
} from '@/components/forms/fertigation-form';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useThemeColors: () => ({
    surface: {
      50: '#fff',
      200: '#ddd',
      500: '#888',
      700: '#444',
      800: '#222',
      900: '#111',
    },
    gray: {
      400: '#aaa',
    },
    success: '#0f0',
    primary: '#06c',
    error: '#c00',
  }),
  useM3: () => ({
    colorScheme: {
      primary: '#06c',
      tertiary: '#0a6',
      onSurface: '#111',
      onSurfaceVariant: '#666',
      surface: '#fff',
      surfaceVariant: '#f5f5f5',
      outline: '#ccc',
      error: '#c00',
      success: '#0a0',
      warning: '#c80',
    },
    surface: {
      s50: '#fff',
      s100: '#fff',
      s200: '#ddd',
      s300: '#ccc',
      s400: '#aaa',
      s500: '#888',
      s600: '#666',
      s700: '#444',
      s800: '#222',
      s900: '#111',
    },
    primary: {
      p50: '#eef',
      p100: '#dde',
      p200: '#ccd',
      p300: '#9cb',
      p400: '#7b9',
      p500: '#06c',
      p600: '#05a',
      p700: '#048',
      p800: '#036',
      p900: '#024',
      p950: '#012',
    },
    neutral: {
      n50: '#fafafa',
      n100: '#f3f3f3',
      n200: '#e5e5e5',
      n300: '#d4d4d4',
      n400: '#a3a3a3',
      n500: '#737373',
      n600: '#525252',
      n700: '#404040',
      n800: '#262626',
      n900: '#171717',
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/components/ui/unit-picker-modal', () => ({
  UnitPickerModal: () => null,
}));

function makeEmptyRowData(): FertigationFormData {
  return {
    fertilizers: [
      {
        id: 'fert-1',
        name: '',
        quantity: 0,
        unit: 'kg',
        quantityBasis: undefined,
      },
    ],
  };
}

function quickAdd(quickAddItems: FertigationQuickAddItem[], pressLabel: string) {
  const onChange = jest.fn();
  const screen = render(
    <FertigationForm data={makeEmptyRowData()} onChange={onChange} quickAddItems={quickAddItems} />,
  );
  fireEvent.press(screen.getByText(pressLabel));
  const latestState = onChange.mock.calls.at(-1)?.[0] as FertigationFormData | undefined;
  expect(latestState).toBeDefined();
  return latestState!;
}

describe('FertigationForm regression', () => {
  it('keeps per_acre basis when quick-add unit is normalized from /acre', () => {
    const state = quickAdd([{ name: 'Urea', unit: 'kg/acre', quantity: 10 }], 'Urea');
    expect(state.fertilizers[0]).toEqual(
      expect.objectContaining({
        name: 'Urea',
        unit: 'kg',
        quantity: 10,
        quantityBasis: 'per_acre',
      }),
    );
  });

  it("quick-adding an 'L/acre' plan item stays volume + per_acre (issue #192 AC1)", () => {
    const state = quickAdd([{ name: 'Humic acid', unit: 'L/acre', quantity: 2 }], 'Humic acid');
    expect(state.fertilizers[0]).toEqual(
      expect.objectContaining({
        name: 'Humic acid',
        unit: 'liter',
        quantity: 2,
        quantityBasis: 'per_acre',
      }),
    );
  });

  it('quick-adding an unknown unit keeps it verbatim — never kg (issue #192 AC2)', () => {
    const state = quickAdd(
      [{ name: 'Mystery mix', unit: 'banana/acre', quantity: 5 }],
      'Mystery mix',
    );
    expect(state.fertilizers[0]).toEqual(
      expect.objectContaining({
        name: 'Mystery mix',
        unit: 'banana/acre',
        quantity: 5,
        quantityBasis: 'per_acre',
      }),
    );
    expect(state.fertilizers[0].unit).not.toBe('kg');
  });

  it('ppm quick-add items render as an explanatory notice, not a tappable chip (issue #197 AC2)', () => {
    // ppm items cannot be one-tap added — tapping a chip would silently
    // enter a water-concentration dose without a water volume. Instead the
    // form shows an informational row via the ppmPlanItemNotice translation key.
    // The t-mock returns the translation key itself so we can look for it in the tree.
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={makeEmptyRowData()}
        onChange={onChange}
        quickAddItems={[{ name: 'GA3', unit: 'ppm', quantity: 100 }]}
      />,
    );
    // The notice row is present (via the translated key, t-mock returns key as-is).
    expect(screen.queryByText('fertigationForm.ppmPlanItemNotice')).toBeTruthy();
    // No pressable chip — the item is NOT in the horizontal chip scroll.
    // After rendering, onChange must NOT have been called (no side effect on mount).
    expect(onChange).not.toHaveBeenCalled();
  });

  it('verbatim non-ppm units (unknown strings) still appear as tappable chips', () => {
    // Only water-concentration units (ppm, g/L …) are excluded from chips.
    // Truly unknown strings like 'banana/acre' remain in the chip row.
    const onChange = jest.fn();
    const screen = render(
      <FertigationForm
        data={makeEmptyRowData()}
        onChange={onChange}
        quickAddItems={[{ name: 'Mystery mix', unit: 'banana/acre', quantity: 5 }]}
      />,
    );
    // 'Mystery mix' chip is present (non-ppm verbatim unit renders as a chip).
    const allMysteryTexts = screen.queryAllByText('Mystery mix');
    // There should be at least one occurrence (the chip).
    expect(allMysteryTexts.length).toBeGreaterThan(0);
    // Notice key should NOT appear for a non-ppm unit.
    expect(screen.queryByText('fertigationForm.ppmPlanItemNotice')).toBeNull();
  });
});
