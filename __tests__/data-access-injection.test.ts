import { getDataAccess, InMemoryDataAccess, setDataAccess } from '@/data-access';

describe('DataAccess injection', () => {
  it('restores the previous adapter after explicit injection', () => {
    const originalDataAccess = getDataAccess();
    const injectedDataAccess = new InMemoryDataAccess();
    const restore = setDataAccess(injectedDataAccess);

    expect(getDataAccess()).toBe(injectedDataAccess);

    restore();

    expect(getDataAccess()).toBe(originalDataAccess);
  });

  it('supports nested injection with proper restore chain', () => {
    const original = getDataAccess();
    const first = new InMemoryDataAccess();
    const second = new InMemoryDataAccess();

    const restoreFirst = setDataAccess(first);
    expect(getDataAccess()).toBe(first);

    const restoreSecond = setDataAccess(second);
    expect(getDataAccess()).toBe(second);

    restoreSecond();
    expect(getDataAccess()).toBe(first);

    restoreFirst();
    expect(getDataAccess()).toBe(original);
  });
});
