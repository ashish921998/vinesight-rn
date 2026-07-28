/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockDetailedMode = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons/Ionicons', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('@/stores', () => ({
  useAppModeStore: (selector: (state: { detailedMode: boolean }) => boolean) =>
    selector({ detailedMode: mockDetailedMode }),
}));

jest.mock('@/styles/use-theme', () => ({
  useIsDark: () => false,
  useM3: () => ({
    colorScheme: {
      background: '#ffffff',
      onSurfaceVariant: '#666666',
      outline: '#dddddd',
      primary: '#355847',
      shadow: '#000000',
    },
    surface: {
      surfaceContainerHigh: '#eeeeee',
      surfaceContainerLowest: '#ffffff',
    },
  }),
}));

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

jest.mock('react-native-gesture-handler', () => {
  const chain = () => {
    const gesture: Record<string, unknown> = {};
    for (const method of [
      'activeOffsetX',
      'failOffsetY',
      'maxDistance',
      'maxDuration',
      'onStart',
      'onUpdate',
      'onFinalize',
      'onEnd',
    ]) {
      gesture[method] = () => gesture;
    }
    return gesture;
  };
  return {
    Gesture: {
      Pan: chain,
      Tap: chain,
      Race: (...gestures: unknown[]) => gestures,
    },
    GestureDetector: ({ children }: { children: import('react').ReactNode }) => children,
  };
});

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useAnimatedStyle: (fn: () => object) => fn(),
    useSharedValue: (value: number | boolean) => ({ value }),
    withSpring: (value: number) => value,
  };
});

const { GlassTabBar } = require('@/components/navigation/glass-tab-bar');

const routes = [
  { key: 'index-key', name: 'index' },
  { key: 'explore-key', name: 'explore' },
  { key: 'workers-key', name: 'workers' },
  { key: 'tools-key', name: 'tools' },
];

describe('GlassTabBar', () => {
  beforeEach(() => {
    mockDetailedMode = false;
  });

  it('uses the Vinesight simple-mode destinations and navigates through expo-router', () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    const { getByRole, queryByText } = render(
      <GlassTabBar
        state={{ index: 0, routes }}
        navigation={{ emit, navigate }}
        descriptors={{}}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />,
    );

    expect(getByRole('tab', { name: 'tabs.home' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(queryByText('tabs.workers')).toBeNull();

    fireEvent.press(getByRole('tab', { name: 'tabs.explore' }));

    expect(emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'explore-key',
      canPreventDefault: true,
    });
    expect(navigate).toHaveBeenCalledWith('explore');
  });

  it('adds Workers and Tools in detailed mode', () => {
    mockDetailedMode = true;
    const { getByRole } = render(
      <GlassTabBar
        state={{ index: 2, routes }}
        navigation={{
          emit: jest.fn(() => ({ defaultPrevented: false })),
          navigate: jest.fn(),
        }}
        descriptors={{}}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />,
    );

    expect(getByRole('tab', { name: 'tabs.workers' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(getByRole('tab', { name: 'tabs.tools' })).toBeTruthy();
  });
});
