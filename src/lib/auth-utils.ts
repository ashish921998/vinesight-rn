import { getDataAccess } from '@/data-access';

export async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await getDataAccess().auth.getSession();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('Please sign in to continue');
  }
  return userId;
}
