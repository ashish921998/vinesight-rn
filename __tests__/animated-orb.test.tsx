/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests for AnimatedOrb component.
 * Verifies:
 * - Renders in each state (idle / listening / processing / speaking / error)
 * - Calls onPress when tapped
 * - Disabled prop prevents press
 * - accessibilityLabel is applied
 * - testID is applied
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimatedOrb } from '@/components/assistant/VoiceMode/AnimatedOrb';
import type { VoiceModeState } from '@/components/assistant/VoiceMode/AnimatedOrb';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return Reanimated;
});

jest.mock('@/components/ui/symbol', () => ({
  Symbol: ({ testID, ...props }: Record<string, unknown>) => {
    const { View } = require('react-native');
    return <View testID={testID} {...props} />;
  },
}));

jest.mock('@/styles/use-theme', () => ({
  useThemeTokens: () => ({
    isDark: false,
    m3: {
      colorScheme: {
        primary: '#408059',
        onPrimary: '#ffffff',
        primaryContainer: '#e1ebe5',
        onPrimaryContainer: '#1f412b',
        secondary: '#5a7a6a',
        onSecondary: '#ffffff',
        secondaryContainer: '#d5e8de',
        onSecondaryContainer: '#1a3829',
        tertiary: '#3a6a8a',
        onTertiary: '#ffffff',
        surface: '#f9fafb',
        onSurface: '#111827',
        onSurfaceVariant: '#6b7280',
        outlineVariant: '#e5e7eb',
        error: '#dc2626',
        onError: '#ffffff',
      },
    },
  }),
}));

describe('AnimatedOrb', () => {
  const defaultProps = {
    state: 'idle' as VoiceModeState,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const states: VoiceModeState[] = ['idle', 'listening', 'processing', 'speaking', 'error'];

  states.forEach((state) => {
    it(`renders without crash in ${state} state`, () => {
      const { getByTestId } = render(
        <AnimatedOrb {...defaultProps} state={state} testID="animated-orb" />,
      );
      expect(getByTestId('animated-orb')).toBeTruthy();
    });
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getAllByRole } = render(
      <AnimatedOrb {...defaultProps} onPress={onPress} testID="animated-orb" />,
    );
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.press(buttons[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getAllByRole } = render(
      <AnimatedOrb {...defaultProps} onPress={onPress} disabled testID="animated-orb" />,
    );
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.press(buttons[0]);
    // TouchableOpacity with disabled=true will not call onPress
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies accessibilityLabel to orb button', () => {
    const label = 'Tap to start speaking';
    const { getAllByRole } = render(
      <AnimatedOrb {...defaultProps} accessibilityLabel={label} testID="animated-orb" />,
    );
    const buttons = getAllByRole('button');
    const orbButton = buttons.find((btn) => btn.props.accessibilityLabel === label);
    expect(orbButton).toBeTruthy();
  });

  it('shows processing dots in processing state', () => {
    const { UNSAFE_getAllByType } = render(
      <AnimatedOrb {...defaultProps} state="processing" testID="animated-orb" />,
    );
    const { View } = require('react-native');
    // Processing state renders View-based dots row; ensure no crash
    expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
  });

  it('renders idle state without crash', () => {
    const { getByTestId } = render(
      <AnimatedOrb state="idle" onPress={jest.fn()} testID="orb-idle" />,
    );
    expect(getByTestId('orb-idle')).toBeTruthy();
  });

  it('renders listening state without crash', () => {
    const { getByTestId } = render(
      <AnimatedOrb state="listening" onPress={jest.fn()} testID="orb-listening" />,
    );
    expect(getByTestId('orb-listening')).toBeTruthy();
  });

  it('renders speaking state without crash', () => {
    const { getByTestId } = render(
      <AnimatedOrb state="speaking" onPress={jest.fn()} testID="orb-speaking" />,
    );
    expect(getByTestId('orb-speaking')).toBeTruthy();
  });

  it('renders error state without crash', () => {
    const { getByTestId } = render(
      <AnimatedOrb state="error" onPress={jest.fn()} testID="orb-error" />,
    );
    expect(getByTestId('orb-error')).toBeTruthy();
  });
});
