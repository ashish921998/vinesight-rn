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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DateField } =
  require('@/components/ui/date-field.ios') as typeof import('@/components/ui/date-field.ios');

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
});
