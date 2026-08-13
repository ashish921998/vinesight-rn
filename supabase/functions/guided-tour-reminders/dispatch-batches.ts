type UserScopedPush = {
  userId: string;
};

export async function authorizeDispatchBatches<T extends UserScopedPush>(
  pushes: T[],
  batchLimit: number,
  authorize: (pushes: T[]) => Promise<T[]>,
): Promise<{ batches: T[][]; skippedUserIds: Set<string> }> {
  if (pushes.length === 0) {
    return { batches: [], skippedUserIds: new Set() };
  }

  const authorizedPushes = await authorize(pushes);
  const authorizedUserIds = new Set(authorizedPushes.map((push) => push.userId));
  const skippedUserIds = new Set<string>();
  for (const push of pushes) {
    if (!authorizedUserIds.has(push.userId)) skippedUserIds.add(push.userId);
  }

  const batches: T[][] = [];
  for (let offset = 0; offset < authorizedPushes.length; offset += batchLimit) {
    batches.push(authorizedPushes.slice(offset, offset + batchLimit));
  }

  return { batches, skippedUserIds };
}
