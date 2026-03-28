import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/lib/supabase';
import { openAuthSessionAsync } from 'expo-web-browser';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signInWithOtp: jest.fn(),
      signInWithOAuth: jest.fn(),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('@/services/telemetry', () => ({
  telemetry: {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
  },
}));

jest.mock('@/lib/query-cache', () => ({
  queryClient: {
    clear: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
  },
  queryPersister: {
    removeClient: jest.fn().mockResolvedValue(undefined),
  },
}));

const initialState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  errorMessage: null,
  pendingOTPEmail: null,
  pendingOTPPhone: null,
  pendingOTPPhoneMode: null as 'signin' | 'signup' | null,
  otpSentSuccessfully: false,
  pendingOTPType: 'email' as const,
  needsProfileCompletion: false,
  hasSeenOnboarding: false,
};

function mockProfilesTable(
  lookupResult: { data: Array<{ id: string }>; error: null } = { data: [], error: null },
) {
  const limit = jest.fn().mockResolvedValue(lookupResult);
  const neq = jest.fn(() => ({ limit }));
  const single = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
  const eq = jest.fn(() => ({ limit }));
  const select = jest.fn(() => ({ eq }));
  const upsert = jest.fn().mockResolvedValue({ error: null });
  (supabase.from as jest.Mock).mockImplementation(() => ({
    select: jest.fn(() => ({ eq: jest.fn(() => ({ limit, neq, single })) })),
    upsert,
  }));
  return { limit, eq, neq, single, select, upsert };
}

beforeEach(() => {
  useAuthStore.setState(initialState);
  jest.clearAllMocks();
  mockProfilesTable();
});

// ============================================================
// initialize
// ============================================================

describe('initialize', () => {
  it('restores session without forcing profile completion from stale metadata', async () => {
    const mockUser = {
      id: 'existing-user',
      email: 'existing@example.com',
      user_metadata: {},
    };
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.needsProfileCompletion).toBe(false);
  });
});

// ============================================================
// signInWithPhone
// ============================================================

describe('signInWithPhone', () => {
  describe('validation', () => {
    it.each([
      ['', 'empty string'],
      ['9876543210', 'no + prefix'],
      ['+123', 'too short'],
      ['+1234567890123456', 'too long (16 digits)'],
      ['+1234abcd90', 'contains letters'],
      ['+0123456789', 'starts with 0 after +'],
    ])('rejects invalid phone "%s" (%s)', async (phone) => {
      await useAuthStore.getState().signInWithPhone(phone);
      const state = useAuthStore.getState();
      expect(state.errorMessage).toBe('Please enter a valid phone number with country code');
      expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it.each([
      ['+919876543210', 'Indian number'],
      ['+14155552671', 'US number'],
      ['+447911123456', 'UK number'],
    ])('accepts valid E.164 phone "%s" (%s)', async (phone) => {
      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
      await useAuthStore.getState().signInWithPhone(phone);
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone,
        options: { shouldCreateUser: false },
      });
    });
  });

  it('trims whitespace from phone input', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
    await useAuthStore.getState().signInWithPhone('  +919876543210  ');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { shouldCreateUser: false },
    });
  });

  it('uses signup mode to allow account creation for new phone users', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });

    await useAuthStore.getState().signInWithPhone('+919876543210', 'signup');

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { shouldCreateUser: true },
    });
  });

  it('sets pendingOTPPhone and otpSentSuccessfully on success', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
    await useAuthStore.getState().signInWithPhone('+919876543210');
    const state = useAuthStore.getState();
    expect(state.pendingOTPPhone).toBe('+919876543210');
    expect(state.otpSentSuccessfully).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.errorMessage).toBeNull();
  });

  it('handles Supabase error', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });
    await useAuthStore.getState().signInWithPhone('+919876543210');
    const state = useAuthStore.getState();
    expect(state.errorMessage).toBe(
      'Too many attempts right now. Please wait a minute and try again.',
    );
    expect(state.otpSentSuccessfully).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.pendingOTPPhone).toBeNull();
  });
});

// ============================================================
// verifyPhoneOTP
// ============================================================

describe('verifyPhoneOTP', () => {
  describe('validation', () => {
    it.each([
      ['12345', 'less than 6 digits'],
      ['abcdef', 'non-numeric'],
      ['', 'empty string'],
      ['12345a', '5 digits + letter'],
    ])('rejects invalid code "%s" (%s)', async (code) => {
      await useAuthStore.getState().verifyPhoneOTP('+919876543210', code);
      const state = useAuthStore.getState();
      expect(state.errorMessage).toBe('Please enter a valid 6-digit code');
      expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    });
  });

  it('sets isAuthenticated and needsProfileCompletion=false for existing user', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_metadata: { full_name: 'John Doe', email: 'test@example.com' },
    };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().verifyPhoneOTP('+919876543210', '123456');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.needsProfileCompletion).toBe(false);
    expect(state.user).toEqual(mockUser);
  });

  it('requires profile completion when name fields are missing, even if email exists', async () => {
    const mockUser = {
      id: 'user-3',
      email: 'existing@example.com',
      user_metadata: {},
    };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().verifyPhoneOTP('+919876543210', '123456');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.needsProfileCompletion).toBe(true);
  });

  it('sets needsProfileCompletion=true for new user (no full_name or email in metadata)', async () => {
    const mockUser = {
      id: 'user-2',
      user_metadata: {},
    };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().verifyPhoneOTP('+919876543210', '654321');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.needsProfileCompletion).toBe(true);
  });

  it('clears pendingOTPPhone and otpSentSuccessfully on success', async () => {
    useAuthStore.setState({ pendingOTPPhone: '+919876543210', otpSentSuccessfully: true });
    const mockUser = {
      id: 'user-1',
      user_metadata: { full_name: 'Jane' },
    };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().verifyPhoneOTP('+919876543210', '123456');
    const state = useAuthStore.getState();
    expect(state.pendingOTPPhone).toBeNull();
    expect(state.otpSentSuccessfully).toBe(false);
  });

  it('calls verifyOtp with correct params', async () => {
    const mockUser = { id: 'u1', user_metadata: { full_name: 'A' } };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { user: mockUser, session: { user: mockUser } },
      error: null,
    });

    await useAuthStore.getState().verifyPhoneOTP('+14155552671', '999888');
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+14155552671',
      token: '999888',
      type: 'sms',
    });
  });

  it('handles Supabase error', async () => {
    (supabase.auth.verifyOtp as jest.Mock).mockRejectedValue(new Error('Token expired'));
    await useAuthStore.getState().verifyPhoneOTP('+919876543210', '123456');
    const state = useAuthStore.getState();
    expect(state.errorMessage).toBe(
      'The verification code is invalid or expired. Please request a new code.',
    );
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});

// ============================================================
// resendPhoneOTP
// ============================================================

describe('resendPhoneOTP', () => {
  it('shows an actionable error when no pendingOTPPhone is available', async () => {
    await useAuthStore.getState().resendPhoneOTP();
    expect(useAuthStore.getState().errorMessage).toBe(
      'Phone number is missing. Please enter it again.',
    );
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('uses explicit phone when pendingOTPPhone is missing', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });

    await useAuthStore.getState().resendPhoneOTP('signin', '+14155552671');

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+14155552671',
      options: { shouldCreateUser: false },
    });
  });

  it('calls signInWithPhone with the pending phone number', async () => {
    useAuthStore.setState({ pendingOTPPhone: '+919876543210' });
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });

    await useAuthStore.getState().resendPhoneOTP();
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { shouldCreateUser: false },
    });
  });

  it('resends in signup mode when requested', async () => {
    useAuthStore.setState({ pendingOTPPhone: '+919876543210', pendingOTPPhoneMode: null });
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });

    await useAuthStore.getState().resendPhoneOTP('signup');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+919876543210',
      options: { shouldCreateUser: true },
    });
  });

  it('preserves pendingOTPPhone when resend fails', async () => {
    useAuthStore.setState({ pendingOTPPhone: '+919876543210' });
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });

    await useAuthStore.getState().resendPhoneOTP();

    const state = useAuthStore.getState();
    expect(state.pendingOTPPhone).toBe('+919876543210');
    expect(state.errorMessage).toBe(
      'Too many attempts right now. Please wait a minute and try again.',
    );
  });
});

// ============================================================
// cancelPhoneOTPFlow
// ============================================================

describe('cancelPhoneOTPFlow', () => {
  it('clears pendingOTPPhone, otpSentSuccessfully, and errorMessage', () => {
    useAuthStore.setState({
      pendingOTPPhone: '+919876543210',
      otpSentSuccessfully: true,
      errorMessage: 'Some error',
    });

    useAuthStore.getState().cancelPhoneOTPFlow();
    const state = useAuthStore.getState();
    expect(state.pendingOTPPhone).toBeNull();
    expect(state.otpSentSuccessfully).toBe(false);
    expect(state.errorMessage).toBeNull();
  });
});

// ============================================================
// completeProfile
// ============================================================

describe('completeProfile', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'initial@example.com',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: { area_unit: 'acres' },
        created_at: new Date(0).toISOString(),
      },
      isAuthenticated: true,
    });
  });

  it('rejects missing required fields', async () => {
    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: '',
    });

    const state = useAuthStore.getState();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe('Please enter first name and last name.');
    expect(state.isLoading).toBe(false);
  });

  it('rejects invalid email format', async () => {
    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice-at-example.com',
    });

    const state = useAuthStore.getState();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe('Please enter a valid email address.');
    expect(state.isLoading).toBe(false);
  });

  it('calls updateUser with full_name, first_name, last_name, and email', async () => {
    const refreshedUser = {
      id: 'u1',
      user_metadata: {
        full_name: 'Alice Smith',
        first_name: 'Alice',
        last_name: 'Smith',
        email: 'alice@example.com',
      },
    };
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: refreshedUser },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      data: {
        email: 'alice@example.com',
        full_name: 'Alice Smith',
        first_name: 'Alice',
        last_name: 'Smith',
      },
    });
  });

  it('allows profile completion without email', async () => {
    const refreshedUser = {
      id: 'u1',
      user_metadata: { full_name: 'Alice Smith', first_name: 'Alice', last_name: 'Smith' },
    };
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: refreshedUser },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        full_name: 'Alice Smith',
        first_name: 'Alice',
        last_name: 'Smith',
      },
    });
  });

  it('normalizes email before update', async () => {
    const refreshedUser = {
      id: 'u1',
      user_metadata: { full_name: 'Bob Jones', email: 'bob@example.com' },
    };
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: refreshedUser },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Bob',
      lastName: 'Jones',
      email: ' Bob@Example.com ',
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      email: 'bob@example.com',
      data: {
        email: 'bob@example.com',
        full_name: 'Bob Jones',
        first_name: 'Bob',
        last_name: 'Jones',
      },
    });
  });

  it('does not update profile when email already exists in another account', async () => {
    mockProfilesTable({ data: [{ id: 'existing-user-id' }], error: null });

    await useAuthStore.getState().completeProfile({
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
    });

    const state = useAuthStore.getState();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(state.errorMessage).toContain('An account with this email already exists');
    expect(state.isLoading).toBe(false);
  });

  it('sets needsProfileCompletion=false on success', async () => {
    useAuthStore.setState({ needsProfileCompletion: true });
    const refreshedUser = { id: 'u1', user_metadata: { full_name: 'Alice Smith' } };
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: refreshedUser },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });
    expect(useAuthStore.getState().needsProfileCompletion).toBe(false);
  });

  it('refreshes user from getUser() after update', async () => {
    const refreshedUser = { id: 'u1', user_metadata: { full_name: 'Alice Smith' } };
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: refreshedUser },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });
    expect(supabase.auth.getUser).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(refreshedUser);
  });

  it('handles error and sets errorMessage', async () => {
    (supabase.auth.updateUser as jest.Mock).mockResolvedValue({
      error: { message: 'Update failed' },
    });

    await useAuthStore.getState().completeProfile({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
    });
    const state = useAuthStore.getState();
    expect(state.errorMessage).toBe(
      'We could not save your profile changes right now. Please try again.',
    );
    expect(state.isLoading).toBe(false);
  });
});

// ============================================================
// Google OAuth
// ============================================================

describe('signInWithGoogle', () => {
  it('rejects token-only callback URLs and never installs a session from raw tokens', async () => {
    (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
      data: { url: 'https://example.com/oauth/start' },
      error: null,
    });
    (openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'vinesight://auth/callback#access_token=attacker-token&refresh_token=attacker-refresh',
    });

    await useAuthStore.getState().signInWithGoogle();

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().errorMessage).toBe('OAuth callback missing authorization code');
  });
});

// ============================================================
// State cleanup
// ============================================================

describe('state cleanup', () => {
  it('signOut clears pendingOTPPhone and needsProfileCompletion', async () => {
    useAuthStore.setState({
      pendingOTPPhone: '+919876543210',
      needsProfileCompletion: true,
      phoneLinkingPending: true,
      phoneLinkingNumber: '+14155552671',
      isAuthenticated: true,
    });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.pendingOTPPhone).toBeNull();
    expect(state.needsProfileCompletion).toBe(false);
    expect(state.phoneLinkingPending).toBe(false);
    expect(state.phoneLinkingNumber).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('cancelOTPFlow clears pendingOTPPhone', () => {
    useAuthStore.setState({ pendingOTPPhone: '+919876543210' });
    useAuthStore.getState().cancelOTPFlow();
    expect(useAuthStore.getState().pendingOTPPhone).toBeNull();
  });
});
