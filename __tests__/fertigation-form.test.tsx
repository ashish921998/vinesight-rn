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
    },
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/components/ui/unit-picker-modal', () => ({
  UnitPickerModal: () => null,
}));

describe('FertigationForm regression', () => {
  it('keeps per_acre basis when quick-add unit is normalized from /acre', () => {
    const onChange = jest.fn();
    const data: FertigationFormData = {
      waterVolume: undefined,
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
    const quickAddItems: FertigationQuickAddItem[] = [
      {
        name: 'Urea',
        unit: 'kg/acre',
        quantity: 10,
      },
    ];

    const screen = render(
      <FertigationForm data={data} onChange={onChange} quickAddItems={quickAddItems} />,
    );

    fireEvent.press(screen.getByText('Urea'));

    const latestState = onChange.mock.calls.at(-1)?.[0] as FertigationFormData | undefined;
    expect(latestState).toBeDefined();
    expect(latestState?.fertilizers[0]).toEqual(
      expect.objectContaining({
        name: 'Urea',
        unit: 'kg',
        quantity: 10,
        quantityBasis: 'per_acre',
      }),
    );
  });
});
