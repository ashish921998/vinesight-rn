import { getDataAccess } from '@/data-access';
import { telemetry } from '@/services/telemetry';
import {
  getErrorMessage,
  getAuthErrorMessage,
  setSentryUser,
  clearQueryCache,
} from './auth-helpers';
import type { SetState, GetState } from './auth-types';
import { signedOutState } from './auth-constants';

export const createAccountActions = (set: SetState, get: GetState) => ({
  signOut: async () => {
    const userId = get().user?.id ?? null;
    set({ errorMessage: null, isLoading: true });
    telemetry.capture('auth_sign_out');

    try {
      if (__DEV__) {
        console.log('Signing out...');
      }

      // 'local' scope signs out only this device. Other devices logged in
      // with the same account keep their sessions alive.
      const { error } = await getDataAccess().auth.signOut({ scope: 'local' });
      if (error) throw error;

      if (__DEV__) {
        console.log('Sign out successful, clearing state');
      }

      telemetry.capture('user_logged_out');
      setSentryUser(null);

      set(signedOutState);
      telemetry.reset();
      try {
        await clearQueryCache('sign out success path', userId);
      } catch (cacheError) {
        if (__DEV__) {
          console.error('Failed to clear query cache after sign out:', cacheError);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Sign out error:', error);
      }

      set({
        isLoading: false,
        errorMessage: getAuthErrorMessage(error, 'Failed to sign out'),
      });
      throw error;
    }
  },

  deleteAccount: async (deleteReason: string) => {
    set({ errorMessage: null, isLoading: true });

    const currentUser = get().user;
    const userId = currentUser?.id;
    const userEmail = currentUser?.email;

    try {
      telemetry.capture('account_deletion_requested', {
        has_reason: Boolean(deleteReason?.trim()),
      });

      if (__DEV__) {
        console.log('Logging deletion request...');
      }

      if (userId) {
        const maskEmail = (email: string) => {
          const [localPart, domain] = email.split('@');
          if (localPart.length <= 2) {
            return `${localPart[0]}***@${domain}`;
          }
          return `${localPart[0]}${localPart[1]}***@${domain}`;
        };
        if (__DEV__) {
          console.warn('[DELETE ACCOUNT REQUEST]', {
            user_id: userId,
            user_email: userEmail ? maskEmail(userEmail) : undefined,
            delete_reason: deleteReason || 'Not provided',
            status: 'pending',
            requested_at: new Date().toISOString(),
          });
        } else {
          console.warn('[DELETE ACCOUNT REQUEST]', {
            user_id: userId,
            status: 'pending',
            requested_at: new Date().toISOString(),
            has_delete_reason: Boolean(deleteReason?.trim()),
          });
        }
      }

      const { error } = await getDataAccess().auth.signOut({ scope: 'global' });
      if (error) throw error;

      setSentryUser(null);

      set(signedOutState);
      try {
        await clearQueryCache('delete account', userId ?? null, false);
      } catch (cacheError) {
        if (__DEV__) {
          console.error('Failed to clear query cache after delete account:', cacheError);
        }
      }
      telemetry.capture('account_deletion_requested_sent');
      try {
        await telemetry.flush();
      } catch (err) {
        if (__DEV__) {
          console.error('[Telemetry] Failed to flush account deletion event:', err);
        }
      }
      telemetry.reset();
    } catch (error) {
      telemetry.capture('account_deletion_request_failed', {
        message: getErrorMessage(error, 'Failed to process account deletion request'),
      });
      if (__DEV__) {
        console.error('Delete account error:', error);
      }

      set({
        isLoading: false,
        errorMessage: getAuthErrorMessage(error, 'Failed to delete account', 'delete_account'),
      });

      throw error;
    }
  },

  updateUserCountry: async (country: string) => {
    const trimmedCountry = country.trim();
    if (!trimmedCountry) {
      set({ errorMessage: 'Country cannot be empty' });
      return;
    }

    set({ errorMessage: null });

    try {
      const { error } = await getDataAccess().auth.updateUser({
        data: { country: trimmedCountry },
      });

      if (error) throw error;

      const { data, error: getUserError } = await getDataAccess().auth.getUser();

      if (getUserError) {
        if (__DEV__) {
          console.error('Failed to get user after country update:', getUserError);
        }
        set({
          errorMessage: getAuthErrorMessage(
            getUserError,
            'Failed to get user after country update',
            'profile_update',
          ),
        });
        return;
      }

      if (data?.user) {
        set({ user: data.user });
      }
    } catch (error: unknown) {
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to update country', 'profile_update'),
      });
    }
  },

  updateUserAreaUnit: async (areaUnit: 'hectares' | 'acres') => {
    set({ errorMessage: null });
    try {
      const { error } = await getDataAccess().auth.updateUser({
        data: { area_unit: areaUnit },
      });

      if (error) throw error;

      const { data, error: getUserError } = await getDataAccess().auth.getUser();

      if (getUserError) {
        if (__DEV__) {
          console.error('Failed to get user after area unit update:', getUserError);
        }
        set({
          errorMessage: getAuthErrorMessage(
            getUserError,
            'Failed to get user after area unit update',
            'profile_update',
          ),
        });
        return;
      }

      if (data?.user) {
        set({ user: data.user });
      }
    } catch (error: unknown) {
      set({
        errorMessage: getAuthErrorMessage(error, 'Failed to update area unit', 'profile_update'),
      });
      throw error;
    }
  },
});
