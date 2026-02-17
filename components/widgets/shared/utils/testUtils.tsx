import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

interface AllProvidersProps {
  children: React.ReactNode;
}

/**
 * AllProviders wraps components with necessary context providers for testing.
 * Note: The useM3() hook uses Zustand's useThemeStore which is a global singleton
 * and does not require a provider wrapper. The store initializes automatically.
 */
const AllProviders = ({ children }: AllProvidersProps) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, {
    wrapper: AllProviders,
    ...options,
  });

export * from '@testing-library/react-native';
export { customRender as render };
