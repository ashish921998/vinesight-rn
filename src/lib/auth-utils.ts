import { supabase } from './supabase';

export async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('Please sign in to continue');
  }
  return userId;
}

/**
 * Current session's access token, or null when there is no active session.
 * The canonical accessor for the bearer token used to authorize direct calls
 * to Supabase edge functions — keep raw `supabase.auth.getSession()` reads for
 * the token out of feature code so all session access goes through this seam.
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
