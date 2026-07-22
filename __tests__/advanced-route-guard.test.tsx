import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { AdvancedRouteGuard, withAdvancedRouteGuard } from '@/components/advanced-route-guard';
import { useAppModeStore } from '@/stores';
import { ADVANCED_ROUTE_SEGMENTS, isAdvancedRoute } from '@/constants/advanced-routes';

// Mock Redirect so we can assert it renders (and to what href) without a router.
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

function setMode({ detailedMode, hydrated }: { detailedMode: boolean; hydrated: boolean }) {
  useAppModeStore.setState({ detailedMode, hydrated });
}

const Child = () => <Text testID="child">child</Text>;

beforeEach(() => {
  mockRedirect.mockClear();
});

describe('AdvancedRouteGuard', () => {
  it('renders nothing while the app-mode store is not hydrated', () => {
    setMode({ detailedMode: true, hydrated: false });
    const { queryByTestId } = render(
      <AdvancedRouteGuard>
        <Child />
      </AdvancedRouteGuard>,
    );
    expect(queryByTestId('child')).toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects home in Simplified mode and does not render the child', () => {
    setMode({ detailedMode: false, hydrated: true });
    const { queryByTestId } = render(
      <AdvancedRouteGuard>
        <Child />
      </AdvancedRouteGuard>,
    );
    expect(queryByTestId('child')).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
  });

  it('renders the child in Detailed mode', () => {
    setMode({ detailedMode: true, hydrated: true });
    const { queryByTestId } = render(
      <AdvancedRouteGuard>
        <Child />
      </AdvancedRouteGuard>,
    );
    expect(queryByTestId('child')).not.toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('withAdvancedRouteGuard', () => {
  it('renders the wrapped screen in Detailed mode', () => {
    setMode({ detailedMode: true, hydrated: true });
    const Guarded = withAdvancedRouteGuard(Child);
    const { queryByTestId } = render(<Guarded />);
    expect(queryByTestId('child')).not.toBeNull();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects home in Simplified mode instead of rendering the screen', () => {
    setMode({ detailedMode: false, hydrated: true });
    const Guarded = withAdvancedRouteGuard(Child);
    const { queryByTestId } = render(<Guarded />);
    expect(queryByTestId('child')).toBeNull();
    expect(mockRedirect).toHaveBeenCalledWith('/(tabs)');
  });
});

describe('advanced add-* deep links are gated', () => {
  it('every add-* segment is an advanced route', () => {
    const addSegments = ADVANCED_ROUTE_SEGMENTS.filter((s) => s.startsWith('add-'));
    expect(addSegments).toEqual(['add-worker', 'add-task', 'add-soil-profile', 'add-lab-test']);
    for (const segment of addSegments) {
      expect(isAdvancedRoute(`/${segment}`)).toBe(true);
    }
  });
});
