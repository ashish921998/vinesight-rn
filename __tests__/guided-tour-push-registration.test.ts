import { Platform } from 'react-native';

const mockCapture = jest.fn();
const mockGetSession = jest.fn();

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
}));

jest.mock('@/services/telemetry', () => ({
  telemetry: { capture: (...args: unknown[]) => mockCapture(...args) },
}));

jest.mock('@/data-access', () => ({
  getDataAccess: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

function makeFisError(): Error {
  const error = new Error('java.io.IOException: FIS_AUTH_ERROR');
  (error as { code?: string }).code = 'ERR_NOTIFICATIONS_FETCH_TOKEN';
  return error;
}

// Re-require the module for each test so the module-level dedup set is fresh.
function loadService() {
  let service: typeof import('@/features/guided-tour/service');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require('@/features/guided-tour/service');
  });
  return service!;
}

describe('fetchExpoPushTokenWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers when a transient failure clears before the attempt ceiling', async () => {
    const { fetchExpoPushTokenWithRetry } = loadService();
    const fetchToken = jest
      .fn()
      .mockRejectedValueOnce(makeFisError())
      .mockRejectedValueOnce(makeFisError())
      .mockResolvedValueOnce({ data: 'ExponentPushToken[abc]' });

    const promise = fetchExpoPushTokenWithRetry(fetchToken);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBe('ExponentPushToken[abc]');
    expect(fetchToken).toHaveBeenCalledTimes(3);
  });

  it('rethrows the last error after the attempt ceiling', async () => {
    const { fetchExpoPushTokenWithRetry } = loadService();
    const fetchToken = jest.fn().mockRejectedValue(makeFisError());

    const promise = fetchExpoPushTokenWithRetry(fetchToken);
    const assertion = expect(promise).rejects.toThrow('FIS_AUTH_ERROR');
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;

    expect(fetchToken).toHaveBeenCalledTimes(3);
  });

  it('does not retry a resolved-but-empty token', async () => {
    const { fetchExpoPushTokenWithRetry } = loadService();
    const fetchToken = jest.fn().mockResolvedValue({ data: '' });

    await expect(fetchExpoPushTokenWithRetry(fetchToken)).resolves.toBeNull();
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
});

describe('syncPushDeviceRegistration telemetry dedup', () => {
  beforeEach(() => {
    mockCapture.mockReset();
    mockGetSession
      .mockReset()
      .mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    Platform.OS = 'android';
  });

  it('reports an identical failure once across repeated invocations', async () => {
    const { syncPushDeviceRegistration } = loadService();

    // getExpoPushToken fails the same way on every call in this environment, so
    // repeated fire-and-forget invocations must still emit a single event.
    await syncPushDeviceRegistration('en');
    await syncPushDeviceRegistration('en');
    await syncPushDeviceRegistration('en');

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(
      'guided_tour_push_registration_failed',
      expect.objectContaining({ stage: 'fetch_token', platform: 'android' }),
    );
  });
});
