/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';

let mockDetailedMode = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/styles/use-theme', () => ({
  useIsDark: () => false,
  useM3: () => ({
    colorScheme: {
      onSecondaryContainer: '#123456',
      onSurface: '#111111',
      onSurfaceVariant: '#666666',
      outlineVariant: '#dddddd',
      secondaryContainer: '#eeeeee',
    },
    primary: { p200: '#cfe8dd', p500: '#355847' },
    surface: {
      surfaceContainerLow: '#ffffff',
      surfaceContainer: '#ffffff',
    },
  }),
}));

jest.mock('@/stores', () => ({
  useAppModeStore: (selector: (state: { detailedMode: boolean }) => boolean) =>
    selector({ detailedMode: mockDetailedMode }),
}));

jest.mock('@expo/ui/jetpack-compose', () => {
  const React = require('react');
  const { Text: NativeText, View: NativeView } = require('react-native');

  const NavigationBarItem = ({ children }: { children: React.ReactNode }) => (
    <NativeView>{children}</NativeView>
  );
  NavigationBarItem.Icon = function NavigationBarItemIcon({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <NativeView>{children}</NativeView>;
  };
  NavigationBarItem.Label = function NavigationBarItemLabel({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return <NativeView>{children}</NativeView>;
  };

  return {
    Host: ({ children, ...props }: { children: React.ReactNode }) => (
      <NativeView testID="compose-host" {...props}>
        {children}
      </NativeView>
    ),
    AnimatedVisibility: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? <NativeView>{children}</NativeView> : null,
    Box: ({ children }: { children: React.ReactNode }) => <NativeView>{children}</NativeView>,
    EnterTransition: {
      fadeIn: () => ({ plus: () => ({}) }),
      scaleIn: () => ({}),
    },
    ExitTransition: {
      fadeOut: () => ({ plus: () => ({}) }),
      scaleOut: () => ({}),
    },
    Icon: (props: { source: number; tint?: string }) => <NativeView testID="tab-icon" {...props} />,
    NavigationBar: ({ children }: { children: React.ReactNode }) => (
      <NativeView>{children}</NativeView>
    ),
    NavigationBarItem,
    Text: ({ children }: { children: React.ReactNode }) => <NativeText>{children}</NativeText>,
  };
});

const { ComposeTabBar } = require('@/components/navigation/compose-tab-bar.android');

describe('ComposeTabBar Android layout', () => {
  beforeEach(() => {
    mockDetailedMode = false;
  });

  it('fills the available width while measuring its height from Compose content', () => {
    const state = {
      index: 0,
      routes: [
        { key: 'index-key', name: 'index' },
        { key: 'explore-key', name: 'explore' },
      ],
    };
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    };

    const { getByTestId } = render(
      <ComposeTabBar
        state={state}
        navigation={navigation}
        descriptors={{}}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />,
    );

    const host = getByTestId('compose-host');
    expect(host.props.matchContents).toEqual({ vertical: true });
    expect(host).toHaveStyle({ width: '100%' });
  });

  it('does not render the assistant as a detailed-mode tab', () => {
    mockDetailedMode = true;
    const state = {
      index: 0,
      routes: [
        { key: 'index-key', name: 'index' },
        { key: 'explore-key', name: 'explore' },
        { key: 'workers-key', name: 'workers' },
        { key: 'tools-key', name: 'tools' },
        { key: 'assistant-key', name: 'assistant' },
      ],
    };

    const { getByText, queryByText } = render(
      <ComposeTabBar
        state={state}
        navigation={{
          emit: jest.fn(() => ({ defaultPrevented: false })),
          navigate: jest.fn(),
        }}
        descriptors={{}}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />,
    );

    expect(getByText('tabs.workers')).toBeTruthy();
    expect(getByText('tabs.tools')).toBeTruthy();
    expect(queryByText('tabs.aiAssistant')).toBeNull();
  });

  it('renders one icon per tab — filled + green for selected, outline for the rest', () => {
    mockDetailedMode = true;
    const state = {
      index: 0,
      routes: [
        { key: 'index-key', name: 'index' },
        { key: 'explore-key', name: 'explore' },
        { key: 'workers-key', name: 'workers' },
        { key: 'tools-key', name: 'tools' },
      ],
    };

    const { getAllByTestId } = render(
      <ComposeTabBar
        state={state}
        navigation={{
          emit: jest.fn(() => ({ defaultPrevented: false })),
          navigate: jest.fn(),
        }}
        descriptors={{}}
        insets={{ top: 0, right: 0, bottom: 24, left: 0 }}
      />,
    );

    const icons = getAllByTestId('tab-icon');
    // One icon per tab — no outline-drawn-over-filled overlay.
    expect(icons).toHaveLength(4);
    // The selected tab (index) is the filled glyph tinted green.
    expect(icons.filter((icon) => icon.props.tint === '#355847')).toHaveLength(1);
    // The three inactive tabs are the outline glyph in onSurfaceVariant.
    expect(icons.filter((icon) => icon.props.tint === '#666666')).toHaveLength(3);
  });
});
