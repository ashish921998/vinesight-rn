import React from 'react';
import { render } from '../../shared/utils/testUtils';
import { TestWidget } from './TestWidget';

describe('TestWidget', () => {
  it('renders widget label', () => {
    const { getByText } = render(<TestWidget />);

    expect(getByText('TestWidget')).toBeTruthy();
  });
});
