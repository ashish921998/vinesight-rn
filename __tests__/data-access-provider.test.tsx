import React from 'react';
import { renderHook } from '@testing-library/react-native';

import {
  DataAccessProvider,
  getDataAccess,
  InMemoryDataAccess,
  setDataAccess,
  useDataAccess,
} from '@/data-access';

describe('DataAccessProvider', () => {
  it('provides the adapter through context without changing non-React access', () => {
    const originalDataAccess = getDataAccess();
    const providerDataAccess = new InMemoryDataAccess();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DataAccessProvider value={providerDataAccess}>{children}</DataAccessProvider>
    );
    const { result } = renderHook(() => useDataAccess(), { wrapper });

    expect(result.current).toBe(providerDataAccess);
    expect(getDataAccess()).toBe(originalDataAccess);
  });

  it('restores the previous adapter after explicit non-React injection', () => {
    const originalDataAccess = getDataAccess();
    const injectedDataAccess = new InMemoryDataAccess();
    const restore = setDataAccess(injectedDataAccess);

    expect(getDataAccess()).toBe(injectedDataAccess);

    restore();

    expect(getDataAccess()).toBe(originalDataAccess);
  });
});
