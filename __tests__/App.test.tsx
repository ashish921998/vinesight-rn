import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

function TestComponent() {
  return <Text>Testing works</Text>;
}

describe('Basic test harness', () => {
  it('renders the test component', () => {
    const { getByText } = render(<TestComponent />);
    expect(getByText('Testing works')).toBeTruthy();
  });
});
