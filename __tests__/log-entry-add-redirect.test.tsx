import React from 'react';
import { render } from '@testing-library/react-native';

const mockRedirectHref = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: (props: { href: unknown }) => {
    mockRedirectHref(props.href);
    return null;
  },
  useLocalSearchParams: () => mockParams(),
}));

const mockParams = jest.fn();

import AddLogEntryRoute from '../app/log-entry/add';

beforeEach(() => mockRedirectHref.mockClear());

describe('log-entry/add redirect', () => {
  it('redirects a valid numeric farmId to the fast path', () => {
    mockParams.mockReturnValue({ farmId: '12' });
    render(<AddLogEntryRoute />);
    expect(mockRedirectHref).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/log-entry/quick',
        params: expect.objectContaining({ farmId: '12' }),
      }),
    );
  });

  it('redirects a missing farmId to the batch composer', () => {
    mockParams.mockReturnValue({});
    render(<AddLogEntryRoute />);
    expect(mockRedirectHref).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/add-entry' }),
    );
  });

  it('redirects an invalid / all farmId to the batch composer', () => {
    mockParams.mockReturnValue({ farmId: 'abc' });
    render(<AddLogEntryRoute />);
    expect(mockRedirectHref).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/add-entry' }),
    );

    mockRedirectHref.mockClear();
    mockParams.mockReturnValue({ farmId: 'all' });
    render(<AddLogEntryRoute />);
    expect(mockRedirectHref).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/add-entry' }),
    );
  });
});
