jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  onlineManager: { setOnline: jest.fn() },
}));

import NetInfo from '@react-native-community/netinfo';
import { startOnlineManager, stopOnlineManagerForTests } from '@/features/offline/online-manager';

const mockedAddEventListener = NetInfo.addEventListener as jest.MockedFunction<
  typeof NetInfo.addEventListener
>;

describe('online manager', () => {
  beforeEach(() => {
    stopOnlineManagerForTests();
    jest.clearAllMocks();
  });

  afterEach(() => stopOnlineManagerForTests());

  it('subscribes again after an effect cleanup', () => {
    const firstUnsubscribe = jest.fn();
    const secondUnsubscribe = jest.fn();
    mockedAddEventListener
      .mockReturnValueOnce(firstUnsubscribe)
      .mockReturnValueOnce(secondUnsubscribe);

    const stopFirst = startOnlineManager();
    stopFirst();
    const stopSecond = startOnlineManager();

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockedAddEventListener).toHaveBeenCalledTimes(2);

    stopSecond();
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
