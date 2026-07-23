/* eslint-disable @typescript-eslint/no-require-imports -- deferred require, see note below */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

const mockBottomSheet = jest.fn(
  ({ children, index }: { children: React.ReactNode; index: number }) => (
    <View testID="date-field-sheet" data-index={index}>
      {children}
    </View>
  ),
);

const mockDateTimePicker = jest.fn(
  ({
    display,
    onValueChange,
  }: {
    display?: string;
    onValueChange?: (_event: unknown, date: Date) => void;
  }) => (
    <Pressable
      testID="native-date-picker"
      accessibilityLabel={`native-date-picker-${display ?? 'default'}`}
      onPress={() => onValueChange?.({}, new Date(2026, 7, 5))}
    >
      <Text>{display}</Text>
    </Pressable>
  ),
);

jest.mock('@expo/ui/community/bottom-sheet', () => ({
  __esModule: true,
  BottomSheet: mockBottomSheet,
}));

jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: mockDateTimePicker,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key,
  }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

// The trigger formats via the app-language formatter; stub it so the test
// doesn't boot the full i18n stack (and to assert it is used, not the device
// locale). ISO keeps the assertion locale-independent.
jest.mock('@/i18n/format', () => ({
  // Mirrors the real formatDate contract: '' for an invalid date.
  formatDate: (date: Date) =>
    Number.isNaN(date.getTime())
      ? ''
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate(),
        ).padStart(2, '0')}`,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      primary: '#355847',
      onPrimary: '#ffffff',
      onSurface: '#1E241F',
      onSurfaceVariant: '#5C584F',
    },
    surface: {
      surfaceContainerLow: '#F7F3ED',
    },
    typography: {
      labelLarge: { fontSize: 16, fontWeight: '500' },
      titleMedium: { fontSize: 18, fontWeight: '600' },
    },
  }),
}));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

// Deferred require: the component must load only after the module-scope `mock*`
// variables above are initialized. A top-level import would load it too early,
// so the mocked BottomSheet factory would capture an undefined ref.
const { DateField } =
  require('@/components/ui/date-field.ios') as typeof import('@/components/ui/date-field.ios');
const { relativeDayOffset } =
  require('@/components/ui/date-field-shared') as typeof import('@/components/ui/date-field-shared');

describe('relativeDayOffset', () => {
  const now = new Date(2026, 6, 23, 15, 0, 0); // 23 Jul 2026, afternoon

  it('returns 0 for any time on the same day', () => {
    expect(relativeDayOffset(new Date(2026, 6, 23, 1, 0), now)).toBe(0);
  });

  it('returns 1 for the previous calendar day', () => {
    expect(relativeDayOffset(new Date(2026, 6, 22, 23, 0), now)).toBe(1);
  });

  it('returns null for older dates and future dates', () => {
    expect(relativeDayOffset(new Date(2026, 6, 21), now)).toBeNull();
    expect(relativeDayOffset(new Date(2026, 6, 24), now)).toBeNull();
  });
});

describe('DateField iOS', () => {
  beforeEach(() => {
    mockBottomSheet.mockClear();
    mockDateTimePicker.mockClear();
  });

  it('renders the app-styled trigger instead of the native compact chip', () => {
    render(<DateField value={new Date(2026, 6, 20)} onChange={jest.fn()} label="Planting Date" />);

    expect(mockDateTimePicker).toHaveBeenCalledWith(
      expect.objectContaining({ display: 'spinner' }),
      undefined,
    );
    expect(mockDateTimePicker).not.toHaveBeenCalledWith(
      expect.objectContaining({ display: 'compact' }),
      expect.anything(),
    );
  });

  it('opens the sheet and commits the draft date with Done', () => {
    const onChange = jest.fn();
    const screen = render(
      <DateField value={new Date(2026, 6, 20)} onChange={onChange} label="Planting Date" />,
    );

    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: -1 }),
      undefined,
    );

    fireEvent.press(screen.getByLabelText('Select date'));
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 0 }),
      undefined,
    );

    fireEvent.press(screen.getByTestId('native-date-picker'));
    fireEvent.press(screen.getByText('common.done'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 7, 5));
  });

  it('formats the value via the app-language formatter, not the device locale', () => {
    const screen = render(<DateField value={new Date(2026, 6, 20)} onChange={jest.fn()} />);
    // Stubbed formatDate returns ISO — proves the trigger routes through it.
    expect(screen.getByText('2026-07-20')).toBeTruthy();
  });

  it('shows a placeholder (not today) when value is null', () => {
    const screen = render(
      <DateField value={null} onChange={jest.fn()} placeholder="No due date" />,
    );
    expect(screen.getByText('No due date')).toBeTruthy();
  });

  it('does not commit a date until the user confirms an empty field', () => {
    const onChange = jest.fn();
    const screen = render(<DateField value={null} onChange={onChange} />);

    // Opening a null field must not fire onChange (nothing is "set" yet).
    fireEvent.press(screen.getByLabelText('Select date'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the placeholder for an invalid date (formatDate returns empty)', () => {
    const screen = render(
      <DateField value={new Date('not-a-date')} onChange={jest.fn()} placeholder="No due date" />,
    );
    // Empty formatted string must fall through to the placeholder, not render blank.
    expect(screen.getByText('No due date')).toBeTruthy();
  });

  it('overlay mode presents the picker in a Modal, not a nested bottom sheet', () => {
    const onChange = jest.fn();
    const screen = render(
      <DateField value={new Date(2026, 6, 20)} onChange={onChange} overlay label="Date" />,
    );

    // No nested @expo/ui sheet — that is the whole point inside another sheet.
    expect(mockBottomSheet).not.toHaveBeenCalled();

    // The picker lives in a Modal; opening flips it visible and commits on Done.
    fireEvent.press(screen.getByLabelText('Select date'));
    fireEvent.press(screen.getByTestId('native-date-picker'));
    fireEvent.press(screen.getByText('common.done'));

    expect(onChange).toHaveBeenCalledWith(new Date(2026, 7, 5));
    expect(mockBottomSheet).not.toHaveBeenCalled();
  });

  it('clamps to maximumDate so Done cannot commit an out-of-range date', () => {
    const onChange = jest.fn();
    const maximumDate = new Date(2020, 0, 1);
    const screen = render(<DateField value={null} onChange={onChange} maximumDate={maximumDate} />);

    // A nullable field opens on today (out of range); commit without scrolling.
    fireEvent.press(screen.getByLabelText('Select date'));
    fireEvent.press(screen.getByText('common.done'));

    expect(onChange).toHaveBeenCalledWith(maximumDate);
  });
});
