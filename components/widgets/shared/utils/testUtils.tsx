import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

interface AllProvidersProps {
  children: React.ReactNode;
}

const AllProviders = ({ children }: AllProvidersProps) => {
  return children;
};

const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, {
    wrapper: AllProviders,
    ...options,
  });

export * from '@testing-library/react-native';
export { customRender as render };
