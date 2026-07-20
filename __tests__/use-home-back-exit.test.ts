import { renderHook } from '@testing-library/react-native';
// Test-only: these platform APIs are mocked below; the split-platform rule is
// not relevant inside a jest test.
// eslint-disable-next-line react-native/split-platform-components
import { BackHandler, ToastAndroid, type HardwareBackPressEvent } from 'react-native';

// Capture the focus-effect cleanups so we can assert the BackHandler
// subscription is detached on blur (deeper screens must keep normal back),
// and let per-test code control what the local navigator's canGoBack() reports
// (false = directory is the root; true = a modal such as log/add is on top).
jest.mock('expo-router', () => {
  const cleanups: Array<(() => void) | undefined> = [];
  let canGoBackImpl = () => false;
  return {
    useFocusEffect: (cb: () => (() => void) | undefined) => {
      cleanups.push(cb());
    },
    useNavigation: () => ({ canGoBack: () => canGoBackImpl() }),
    __testFocusCleanups: () => cleanups,
    __setCanGoBack: (fn: () => boolean) => {
      canGoBackImpl = fn;
    },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

// Imported after the mocks so the hook resolves the stubbed dependencies.
import { useHomeBackExit } from '@/hooks/use-home-back-exit.android';

const expoRouterMock = jest.requireMock('expo-router') as {
  __testFocusCleanups: () => Array<(() => void) | undefined>;
  __setCanGoBack: (fn: () => boolean) => void;
};
const focusCleanups = expoRouterMock.__testFocusCleanups();
const setCanGoBack = expoRouterMock.__setCanGoBack;

/**
 * Regression tests for the professional-module back-button fix.
 *
 * The professional directory must NEVER be escapable into the farmer app via
 * the hardware back button. Instead it behaves like a home screen: the first
 * back press is swallowed (with a toast) and a second press within the window
 * exits the app. While a deeper professional screen (farmer → farm → …) is on
 * top, the directory is not focused, so its back subscription must be detached —
 * keeping normal back/pop behaviour there.
 */
describe('useHomeBackExit', () => {
  const toastShow = jest.fn();
  const backExitApp = jest.fn();
  const removeSubscription = jest.fn();
  let backHandler: () => boolean | null | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    focusCleanups.splice(0);
    setCanGoBack(() => false); // directory is the professional-root by default

    // jest-expo ships an empty ToastAndroid — populate just the surface the hook uses.
    (ToastAndroid as unknown as { show: typeof toastShow }).show = toastShow;
    (ToastAndroid as unknown as { SHORT: number }).SHORT = 0;

    jest.spyOn(BackHandler, 'exitApp').mockImplementation(backExitApp);
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      _event: string,
      cb: (event: HardwareBackPressEvent) => boolean | null | undefined,
    ) => {
      backHandler = () => cb({ type: 'hardwareBackPress', timeStamp: Date.now() });
      return { remove: removeSubscription };
    }) as typeof BackHandler.addEventListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('swallows the first back press instead of popping into another module', () => {
    renderHook(() => useHomeBackExit());

    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );

    const result = backHandler!();

    // The fix: back returns true (handled) so React Navigation never pops the
    // professional group out into the farmer app; we just prompt + wait.
    expect(result).toBe(true);
    expect(toastShow).toHaveBeenCalledTimes(1);
    expect(backExitApp).not.toHaveBeenCalled();
  });

  it('exits the app when back is pressed again within the window', () => {
    renderHook(() => useHomeBackExit(1000));

    backHandler!(); // first press → toast
    expect(backExitApp).not.toHaveBeenCalled();

    const result = backHandler!(); // second press, immediately (< 1000ms)

    expect(result).toBe(true);
    expect(backExitApp).toHaveBeenCalledTimes(1);
  });

  it('does not exit when the second press lands outside the window', async () => {
    renderHook(() => useHomeBackExit(5));

    backHandler!();
    expect(toastShow).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const result = backHandler!();

    expect(result).toBe(true);
    expect(backExitApp).not.toHaveBeenCalled();
    expect(toastShow).toHaveBeenCalledTimes(2);
  });

  it('detaches the back subscription on blur so deeper screens keep normal back', () => {
    renderHook(() => useHomeBackExit());

    expect(focusCleanups).toHaveLength(1);
    // Simulate the directory losing focus (a deeper professional screen pushed on top).
    focusCleanups[0]?.();
    expect(removeSubscription).toHaveBeenCalledTimes(1);
  });

  it('defers to the navigator when a full-screen modal is open on top', () => {
    // A presented modal (e.g. the full-screen add-log composer) can leave the
    // directory focused underneath, so this listener still fires. The navigator
    // has something to dismiss, so we must NOT hijack the press into the toast.
    setCanGoBack(() => true);
    renderHook(() => useHomeBackExit());

    const result = backHandler!();

    // Returning false lets React Navigation dismiss the modal as usual — no
    // exit toast, no app exit.
    expect(result).toBe(false);
    expect(toastShow).not.toHaveBeenCalled();
    expect(backExitApp).not.toHaveBeenCalled();
  });

  it('swallows back presses during sign-out instead of unregistering', () => {
    // Regression: a slow signOut() used to leave a window with no back handler,
    // letting a hardware back press fall through to the root navigator and quit
    // the app. Lock mode keeps the listener but absorbs every press (no toast,
    // no exit) until sign-out navigation completes.
    renderHook(() => useHomeBackExit(2000, false));

    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );

    const result = backHandler!();

    expect(result).toBe(true); // swallowed — React Navigation never sees it
    expect(toastShow).not.toHaveBeenCalled();
    expect(backExitApp).not.toHaveBeenCalled();
  });
});
