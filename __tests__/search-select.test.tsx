import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SearchSelect, SEARCH_SELECT_DEBOUNCE_MS } from '@/components/ui/search-select';
import {
  recentItemsToOptions,
  type SearchSelectSelection,
} from '@/components/ui/search-select-logic';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts?.query === 'string') return `${key}:${opts.query}`;
      return (opts?.defaultValue as string) ?? key;
    },
  }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      surface: '#fff',
      shadow: '#000',
      primary: '#357047',
      outlineVariant: '#ddd',
      onSurfaceVariant: '#555',
    },
    surface: { s100: '#fff', s200: '#eee', s500: '#888', s900: '#111' },
  }),
}));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

const historyOptions = recentItemsToOptions(
  [
    {
      name: 'Karate',
      unit: 'ml/L',
      quantity: 2,
      quantityBasis: 'total',
      catalogProductId: 5,
      warehouseItemId: 9,
      catalogMixId: 77,
    },
  ],
  { mixLabel: 'Mix' },
);

function renderPicker(onSelect: (selection: SearchSelectSelection) => void) {
  return render(
    <SearchSelect
      visible
      onClose={jest.fn()}
      onSelect={onSelect}
      historyOptions={historyOptions}
      planOptions={[
        {
          key: 'plan:p1',
          name: 'Urea',
          detail: '5 kg/acre',
          selection: {
            kind: 'item',
            name: 'Urea',
            planItemId: 'p1',
            isCustom: false,
            prefill: { quantity: 5, unit: 'kg/acre' },
          },
        },
      ]}
      catalogOptions={[]}
    />,
  );
}

describe('SearchSelect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders sections with rows and emits the identity-rich history payload on tap', () => {
    const onSelect = jest.fn();
    const screen = renderPicker(onSelect);

    expect(screen.getByText('searchSelect.sections.history')).toBeTruthy();
    expect(screen.getByText('searchSelect.sections.plan')).toBeTruthy();
    // Empty catalog section degrades to hidden.
    expect(screen.queryByText('searchSelect.sections.catalog')).toBeNull();
    expect(screen.getByText('2 ml/L · Mix')).toBeTruthy();

    fireEvent.press(screen.getByText('Karate'));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'item',
      name: 'Karate',
      catalogProductId: 5,
      warehouseItemId: 9,
      catalogMixId: 77,
      isCustom: false,
      prefill: { quantity: 2, unit: 'ml/L', quantityBasis: 'total' },
    });
  });

  it('debounces the query and always offers the custom escape hatch', () => {
    const onSelect = jest.fn();
    const screen = renderPicker(onSelect);

    fireEvent.changeText(
      screen.getByPlaceholderText('searchSelect.searchPlaceholder'),
      'New Chemical',
    );
    // Before the debounce elapses the list is unchanged.
    expect(screen.queryByText('searchSelect.addCustom:New Chemical')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(SEARCH_SELECT_DEBOUNCE_MS + 50);
    });

    expect(screen.queryByText('Karate')).toBeNull();
    fireEvent.press(screen.getByText('searchSelect.addCustom:New Chemical'));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'item',
      name: 'New Chemical',
      isCustom: true,
    });
  });

  it('dismisses on backdrop tap but not on taps inside the card', () => {
    const onClose = jest.fn();
    const screen = render(
      <SearchSelect
        visible
        onClose={onClose}
        onSelect={jest.fn()}
        historyOptions={historyOptions}
        catalogOptions={[]}
      />,
    );

    fireEvent.press(screen.getByText('Karate'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('search-select-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
