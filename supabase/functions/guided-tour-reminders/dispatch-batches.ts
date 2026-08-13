type UserScopedPush = {
  userId: string;
};

export async function beginDispatchAndBatch<T extends UserScopedPush>(
  pushes: T[],
  batchLimit: number,
  beginDispatch: (pushes: T[]) => Promise<T[]>,
): Promise<{ batches: T[][]; skippedUserIds: Set<string> }> {
  if (pushes.length === 0) {
    return { batches: [], skippedUserIds: new Set() };
  }

  const dispatchingPushes = await beginDispatch(pushes);
  const dispatchingUserIds = new Set(dispatchingPushes.map((push) => push.userId));
  const skippedUserIds = new Set<string>();
  for (const push of pushes) {
    if (!dispatchingUserIds.has(push.userId)) skippedUserIds.add(push.userId);
  }

  const batches: T[][] = [];
  for (let offset = 0; offset < dispatchingPushes.length; offset += batchLimit) {
    batches.push(dispatchingPushes.slice(offset, offset + batchLimit));
  }

  return { batches, skippedUserIds };
}
