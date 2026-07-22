/**
 * Chainable data-access query-builder mock shared by the offline write tests.
 *
 * Records upsert args / update patch / eq calls; resolves `single` /
 * `maybeSingle` (and the chain itself, via `then`, for the delete path)
 * to `result`.
 *
 * Lives in jest-setup/ (not __tests__/) because jest's default testMatch
 * collects every file under __tests__/ as a test suite.
 */
export type MockResult = { data?: unknown; error?: unknown };

export function makeChain(result: MockResult = { data: null, error: null }) {
  const calls = {
    upsertArgs: undefined as undefined | [Record<string, unknown>, unknown],
    updatePatch: undefined as unknown,
    eqCalls: [] as Array<[string, unknown]>,
  };
  const chain: Record<string, unknown> = {};
  chain.upsert = jest.fn((payload: Record<string, unknown>, opts: unknown) => {
    calls.upsertArgs = [payload, opts];
    return chain;
  });
  chain.update = jest.fn((patch: unknown) => {
    calls.updatePatch = patch;
    return chain;
  });
  chain.delete = jest.fn(() => chain);
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn((col: string, val: unknown) => {
    calls.eqCalls.push([col, val]);
    return chain;
  });
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  // Thenable so `await chain` (delete path) resolves to result.
  chain.then = (onF: ((v: MockResult) => unknown) | null, onR?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onF, onR);
  return { chain, calls };
}
