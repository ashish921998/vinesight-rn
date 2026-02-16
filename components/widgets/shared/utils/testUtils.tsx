import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';

interface AllProvidersProps {
  children: React.ReactNode;
}

const AllProviders = ({ children }: AllProvidersProps) => {
  return (
    <I18nextProvider i18n={i18n}>
      {/* TODO: Add theme store provider when widgets are tested */}
      {children}
    </I18nextProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, {
    wrapper: AllProviders,
    ...options,
  });

export * from '@testing-library/react-native';
export { customRender as render };
