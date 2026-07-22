/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks', () => ({
  isIOS: false,
}));

jest.mock('@/components/ui/symbol', () => ({
  Symbol: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/screens/settings/settings-styles', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    SettingsItem: ({ title, subtitle }: { title: string; subtitle?: string }) => (
      <View>
        <Text>{title}</Text>
        {subtitle ? <Text>{subtitle}</Text> : null}
      </View>
    ),
  };
});

const { PreferencesSection } = require('@/components/screens/settings/PreferencesSection');

describe('PreferencesSection', () => {
  it('opens the assistant from Settings', () => {
    const onOpenAssistant = jest.fn();
    const { getByText } = render(
      <PreferencesSection
        language="en"
        themeMode="system"
        selectedCurrency="INR"
        selectedAreaUnit="acres"
        isResettingGuidedTour={false}
        detailedMode={false}
        styles={{}}
        m3={{ neutral: { n400: '#999999' }, colorScheme: { primary: '#008000' } }}
        onLanguageChange={jest.fn()}
        onThemeChange={jest.fn()}
        onCurrencyChange={jest.fn()}
        onAreaUnitChange={jest.fn()}
        onReplayGuidedTour={jest.fn()}
        onDetailedModeChange={jest.fn()}
        onOpenAssistant={onOpenAssistant}
      />,
    );

    fireEvent.press(getByText('settings.aiAssistant.title'));
    expect(onOpenAssistant).toHaveBeenCalledTimes(1);
  });
});
