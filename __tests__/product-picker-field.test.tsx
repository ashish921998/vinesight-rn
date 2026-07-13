import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProductPickerField } from '@/components/professional/product-picker-field';
import { buildSearchSelectSections } from '@/components/ui/search-select-logic';

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
    colorScheme: { surface: '#fff', primary: '#357047', onSurfaceVariant: '#555' },
    surface: { s100: '#fff', s300: '#ddd', s500: '#888', s600: '#666', s900: '#111' },
    neutral: { n400: '#aaa' },
  }),
}));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

const historySections = buildSearchSelectSections({
  query: '',
  history: [
    {
      key: 'org:karate',
      name: 'Karate',
      detail: '2 ml/L',
      selection: { kind: 'item', name: 'Karate', isCustom: false },
    },
  ],
  allowCustom: false,
});

describe('ProductPickerField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a placeholder when closed and opens on tap', () => {
    const onOpen = jest.fn();
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen={false}
        query=""
        sections={[]}
        onOpen={onOpen}
        onClose={jest.fn()}
        onQueryChange={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('professional.reviews.selectProduct')).toBeTruthy();
    fireEvent.press(screen.getByText('professional.reviews.selectProduct'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows the picked name when closed', () => {
    const screen = render(
      <ProductPickerField
        productName="Urea"
        isOpen={false}
        query=""
        sections={[]}
        onOpen={jest.fn()}
        onClose={jest.fn()}
        onQueryChange={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('Urea')).toBeTruthy();
  });

  it('renders a search box and results when open, and emits the selection on tap', () => {
    const onSelect = jest.fn();
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen
        query=""
        sections={historySections}
        onOpen={jest.fn()}
        onClose={jest.fn()}
        onQueryChange={jest.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByPlaceholderText('searchSelect.searchPlaceholder')).toBeTruthy();
    expect(screen.getByText('Karate')).toBeTruthy();

    fireEvent.press(screen.getByText('Karate'));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'item', name: 'Karate', isCustom: false });
  });

  it('shows the empty-state hint when there are no sections to show', () => {
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen
        query=""
        sections={[]}
        onOpen={jest.fn()}
        onClose={jest.fn()}
        onQueryChange={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByText('searchSelect.empty')).toBeTruthy();
  });

  it('collapses on blur (moving focus elsewhere without picking anything)', () => {
    const onClose = jest.fn();
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen
        query=""
        sections={historySections}
        onOpen={jest.fn()}
        onClose={onClose}
        onQueryChange={jest.fn()}
        onSelect={jest.fn()}
      />,
    );

    fireEvent(screen.getByPlaceholderText('searchSelect.searchPlaceholder'), 'blur');
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not collapse on blur when a result row is mid-tap', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen
        query=""
        sections={historySections}
        onOpen={jest.fn()}
        onClose={onClose}
        onQueryChange={jest.fn()}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByText('Karate');
    // Touch-down on the row fires before the TextInput's blur is processed —
    // this is the race the selectingRef guard exists to protect.
    fireEvent(row, 'pressIn');
    fireEvent(screen.getByPlaceholderText('searchSelect.searchPlaceholder'), 'blur');

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(row);
    expect(onSelect).toHaveBeenCalledWith({ kind: 'item', name: 'Karate', isCustom: false });
  });

  it('collapses on blur after a result-row tap is cancelled by dragging away', () => {
    // Regression: onPressIn sets the selectingRef guard, but a cancelled press
    // (finger dragged off the row) fires onPressOut — not onPress. Without
    // resetting the flag on press-out, the deferred blur would consume it and
    // return without closing, stranding the picker open with no focus.
    const onClose = jest.fn();
    const onSelect = jest.fn();
    const screen = render(
      <ProductPickerField
        productName=""
        isOpen
        query=""
        sections={historySections}
        onOpen={jest.fn()}
        onClose={onClose}
        onQueryChange={jest.fn()}
        onSelect={onSelect}
      />,
    );

    const row = screen.getByText('Karate');
    // Touch-down latches the guard, then the drag-away cancels: press-out with
    // no subsequent press.
    fireEvent(row, 'pressIn');
    fireEvent(row, 'pressOut');
    fireEvent(screen.getByPlaceholderText('searchSelect.searchPlaceholder'), 'blur');

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
