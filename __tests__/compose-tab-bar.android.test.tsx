/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';

let mockDetailedMode = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/styles/use-theme', () => ({
  useM3: () => ({
    colorScheme: {
      onSecondaryContainer: '#123456',
      onSurface: '#111111',
      onSurfaceVariant: '#666666',
      outlineVariant: '#dddddd',
      secondaryContainer: '#eeeeee',
    },
    surface: {
      surfaceContainerLow: '#ffffff',
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
    Icon: () => <NativeView />,
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
});
