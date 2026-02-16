import React from 'react';
import { render } from '../../shared/utils/testUtils';
import { TestWidget } from './TestWidget';

describe('TestWidget', () => {
  it('renders widget label', () => {
    const { getByText } = render(<TestWidget />);

    expect(getByText('Test Widget')).toBeTruthy();
  });

  it('applies testID and accessibilityLabel', () => {
    const { getByTestId } = render(
      <TestWidget testID="test-widget" accessibilityLabel="Test widget" />,
    );
    expect(getByTestId('test-widget')).toBeTruthy();
  });

  it('merges custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = render(<TestWidget testID="test-widget" style={customStyle} />);
    expect(getByTestId('test-widget').props.style).toContainEqual(customStyle);
  });
});
