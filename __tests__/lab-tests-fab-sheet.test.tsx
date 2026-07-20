/* eslint-disable @typescript-eslint/no-require-imports -- deferred require, see note below */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

const mockBottomSheet = jest.fn(({ children }: { children: React.ReactNode }) => (
  <View testID="fab-sheet">{children}</View>
));

jest.mock('@expo/ui/community/bottom-sheet', () => ({
  __esModule: true,
  BottomSheet: mockBottomSheet,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      primary: '#355847',
      secondary: '#4A6357',
      tertiary: '#6B7F73',
      onSurface: '#1E241F',
      onSurfaceVariant: '#5C584F',
      outlineVariant: '#D6D2CA',
      surface: '#FFFFFF',
    },
  }),
}));

jest.mock('@/utils/color', () => ({
  colorWithOpacity: (color: string) => color,
}));

// Deferred require: the component must load only after the module-scope `mock*`
// variables above are initialized. A top-level import would load it too early,
// so the mocked BottomSheet factory would capture an undefined ref.
const { LabTestsFabSheet } =
  require('@/components/modals/lab-tests-fab-sheet') as typeof import('@/components/modals/lab-tests-fab-sheet');

describe('LabTestsFabSheet', () => {
  beforeEach(() => {
    mockBottomSheet.mockClear();
  });

  it('reflects visibility through the sheet index', () => {
    const { rerender } = render(
      <LabTestsFabSheet
        visible={false}
        onClose={jest.fn()}
        onAddSoilTest={jest.fn()}
        onAddPetioleTest={jest.fn()}
      />,
    );
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: -1 }),
      undefined,
    );

    rerender(
      <LabTestsFabSheet
        visible
        onClose={jest.fn()}
        onAddSoilTest={jest.fn()}
        onAddPetioleTest={jest.fn()}
      />,
    );
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 0 }),
      undefined,
    );
  });

  it('defers navigation until the sheet has finished closing', () => {
    const onClose = jest.fn();
    const onAddSoilTest = jest.fn();
    const onAddPetioleTest = jest.fn();

    const screen = render(
      <LabTestsFabSheet
        visible
        onClose={onClose}
        onAddSoilTest={onAddSoilTest}
        onAddPetioleTest={onAddPetioleTest}
      />,
    );

    // Tapping an action requests close but must NOT navigate yet.
    fireEvent.press(screen.getByTestId('fab-action-add_soil'));
    expect(onClose).toHaveBeenCalled();
    expect(onAddSoilTest).not.toHaveBeenCalled();

    // Once the sheet finishes closing, the pending action fires exactly once.
    const { onClose: handleSheetClose } = mockBottomSheet.mock.lastCall![0] as unknown as {
      onClose: () => void;
    };
    act(() => handleSheetClose());

    expect(onAddSoilTest).toHaveBeenCalledTimes(1);
    expect(onAddPetioleTest).not.toHaveBeenCalled();
  });
});
