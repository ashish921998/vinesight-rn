import { isValidOTPCode, isValidEmail, AUTH_ERROR_MESSAGES } from '@/types/auth';
import type { PhoneOTPCredentials, PhoneOTPType } from '@/types/auth';

describe('isValidOTPCode', () => {
  it('returns true for valid 6-digit codes', () => {
    expect(isValidOTPCode('123456')).toBe(true);
    expect(isValidOTPCode('000000')).toBe(true);
  });

  it('returns false for too short codes', () => {
    expect(isValidOTPCode('12345')).toBe(false);
  });

  it('returns false for too long codes', () => {
    expect(isValidOTPCode('1234567')).toBe(false);
  });

  it('returns false for non-numeric codes', () => {
    expect(isValidOTPCode('abcdef')).toBe(false);
    expect(isValidOTPCode('12345a')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidOTPCode('')).toBe(false);
  });

  it('returns false for codes with internal spaces', () => {
    expect(isValidOTPCode('123 456')).toBe(false);
    expect(isValidOTPCode('12 3456')).toBe(false);
  });
});

describe('AUTH_ERROR_MESSAGES', () => {
  it('contains INVALID_PHONE with expected message', () => {
    expect(AUTH_ERROR_MESSAGES.INVALID_PHONE).toBe('Please enter a valid phone number');
  });

  it('contains PHONE_OTP_FAILED', () => {
    expect(AUTH_ERROR_MESSAGES.PHONE_OTP_FAILED).toBeDefined();
  });

  it('contains PHONE_OTP_EXPIRED', () => {
    expect(AUTH_ERROR_MESSAGES.PHONE_OTP_EXPIRED).toBeDefined();
  });

  it('contains PROFILE_UPDATE_FAILED', () => {
    expect(AUTH_ERROR_MESSAGES.PROFILE_UPDATE_FAILED).toBeDefined();
  });
});

describe('PhoneOTPCredentials type check', () => {
  it('accepts an object with phone and code fields', () => {
    const credentials: PhoneOTPCredentials = { phone: '+919876543210', code: '123456' };
    expect(credentials.phone).toBe('+919876543210');
    expect(credentials.code).toBe('123456');
  });
});

describe('PhoneOTPType', () => {
  it('accepts sms as a valid value', () => {
    const otpType: PhoneOTPType = 'sms';
    expect(otpType).toBe('sms');
  });
});

describe('isValidEmail rejects phone-like strings', () => {
  it('rejects a phone number', () => {
    expect(isValidEmail('+919876543210')).toBe(false);
  });

  it('rejects strings without @', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });
});
