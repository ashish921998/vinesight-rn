/**
 * Validates if a phone number is a valid E.164 format.
 * E.164 numbers must start with + and have 1-15 digits (excluding the +).
 */
export function isValidE164PhoneNumber(phoneNumber: string): boolean {
  const e164Pattern = /^\+[1-9]\d{0,14}$/;
  return e164Pattern.test(phoneNumber) && phoneNumber.length >= 8;
}

export function sanitizePhoneDigits(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d]/g, '');
}

export function normalizeLocalPhoneDigits(phoneNumber: string): string {
  const digitsOnly = sanitizePhoneDigits(phoneNumber);
  return digitsOnly.replace(/^0+/, '');
}

export function buildE164PhoneNumber(dialCode: string, localPhoneNumber: string): string {
  const normalizedLocalNumber = normalizeLocalPhoneDigits(localPhoneNumber);
  if (!normalizedLocalNumber) return '';
  const fullNumber = `${dialCode}${normalizedLocalNumber}`;
  return isValidE164PhoneNumber(fullNumber) ? fullNumber : '';
}
