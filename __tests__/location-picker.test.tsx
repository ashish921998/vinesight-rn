import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

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

const originalApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key';
const LocationPicker = jest.requireActual<
  typeof import('../src/components/screens/location-picker')
>('../src/components/screens/location-picker').default;
if (originalApiKey === undefined) {
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
} else {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalApiKey;
}

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

  it('does not report an error when a new search cancels place details', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let resolveDetailsAbort: () => void = () => undefined;
    const detailsAborted = new Promise<void>((resolve) => {
      resolveDetailsAbort = resolve;
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        json: async () => ({
          status: 'OK',
          predictions: [
            {
              place_id: 'first-place',
              description: 'First place',
              structured_formatting: { main_text: 'First place' },
            },
          ],
        }),
      } as Response)
      .mockImplementationOnce((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            queueMicrotask(resolveDetailsAbort);
          });
        });
      })
      .mockResolvedValueOnce({
        json: async () => ({ status: 'ZERO_RESULTS', predictions: [] }),
      } as Response);

    try {
      const { getByPlaceholderText, getByText } = render(
        <LocationPicker visible onClose={() => null} onLocationSelect={() => null} />,
      );
      const input = getByPlaceholderText('locationPicker.searchPlaceholder');

      fireEvent.changeText(input, 'First');
      fireEvent(input, 'submitEditing');
      await waitFor(() => expect(getByText('First place')).toBeTruthy());

      fireEvent.press(getByText('First place'));
      fireEvent.changeText(input, 'Second');
      fireEvent(input, 'submitEditing');

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      await detailsAborted;
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
      consoleErrorSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });
});
