import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// week-strip (pulled in via location-picker → ui/index) imports @/i18n/format,
// whose module-load side effect runs the real i18n.init() and fails under Jest.
jest.mock('@/i18n/format', () => ({
  formatDate: () => 'Jan 1',
}));

jest.mock('react-native-maps', () => {
  function BrokenMapView() {
    throw new Error('Map native view not available');
  }

  function Marker() {
    return null;
  }

  return {
    __esModule: true,
    default: BrokenMapView,
    Marker,
    PROVIDER_DEFAULT: 'default',
  };
});

import LocationPicker from '../src/components/screens/location-picker';

describe('LocationPicker', () => {
  it('does not crash when MapView throws during render', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { getByText } = render(
        <LocationPicker visible onClose={() => null} onLocationSelect={() => null} />,
      );

      await waitFor(() => {
        expect(getByText('locationPicker.mapsUnavailableTitle')).toBeTruthy();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
