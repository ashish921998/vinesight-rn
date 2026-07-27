/**
 * App-mode store: the Simplified default, the telemetry stamp that makes
 * "who is on Simplified?" answerable, and the FORCE_SIMPLE_MODE ramp-down.
 *
 * `@/services/telemetry` is mocked (it is a dependency here, not the module
 * under test — its own behaviour is covered by feature-flags.test.ts).
 * The store subscribes to `onFeatureFlags` at module load, so the callback is
 * captured by the mock and invoked manually to simulate a flag refresh.
 */

const mockRegister = jest.fn();
const mockCapture = jest.fn();
const mockIsFeatureEnabled = jest.fn<boolean, [string]>();
let flagsCallback: (() => void) | null = null;

jest.mock('@/services/telemetry', () => ({
  FLAG_KEYS: { FORCE_SIMPLE_MODE: 'force-simple-mode' },
  isFeatureEnabled: (key: string) => mockIsFeatureEnabled(key),
  // Every member is an arrow that defers to the mock: the factory runs at
  // import time, which hoists above the `const mock*` declarations below.
  posthogClient: {
    register: (properties: unknown) => mockRegister(properties),
    onFeatureFlags: (cb: () => void) => {
      flagsCallback = cb;
      return () => {};
    },
  },
  telemetry: { capture: (event: string, properties: unknown) => mockCapture(event, properties) },
}));

// require, not import: the store subscribes to onFeatureFlags during its own
// module evaluation, and a static import hoists above the `let`/`const` above
// (whose initializers would then clobber the captured callback with null).
const store =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/stores/app-mode-store') as typeof import('@/stores/app-mode-store');
const { useAppModeStore } = store;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsFeatureEnabled.mockReturnValue(false);
  useAppModeStore.setState({ detailedMode: false });
});

it('defaults to Simplified mode', () => {
  expect(useAppModeStore.getState().detailedMode).toBe(false);
});

it('stamps the mode onto later events and the person on every change', () => {
  useAppModeStore.getState().setDetailedMode(true);

  expect(mockRegister).toHaveBeenCalledWith({ app_mode: 'detailed' });
  expect(mockCapture).toHaveBeenCalledWith('app_mode_set', {
    app_mode: 'detailed',
    $set: { app_mode: 'detailed' },
  });
});

it('pulls Detailed-mode users back to Simplified when FORCE_SIMPLE_MODE is on', () => {
  useAppModeStore.setState({ detailedMode: true });
  mockIsFeatureEnabled.mockReturnValue(true);

  flagsCallback?.();

  expect(useAppModeStore.getState().detailedMode).toBe(false);
  expect(mockRegister).toHaveBeenCalledWith({ app_mode: 'simplified' });
});

it('refuses to enter Detailed mode via the setter while FORCE_SIMPLE_MODE is on', () => {
  mockIsFeatureEnabled.mockReturnValue(true);

  useAppModeStore.getState().setDetailedMode(true);

  expect(useAppModeStore.getState().detailedMode).toBe(false);
  expect(mockRegister).not.toHaveBeenCalled();
});

it("leaves a user's own Detailed choice alone while the flag is off", () => {
  useAppModeStore.setState({ detailedMode: true });

  flagsCallback?.();

  expect(useAppModeStore.getState().detailedMode).toBe(true);
});
