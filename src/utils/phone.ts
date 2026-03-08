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

export function getLocalPhoneDigitLimit(dialCode: string): number {
  if (dialCode === '+91') return 10;
  return 15;
}

export function limitLocalPhoneDigits(dialCode: string, phoneNumber: string): string {
  const normalizedDigits = normalizeLocalPhoneDigits(phoneNumber);
  return normalizedDigits.slice(0, getLocalPhoneDigitLimit(dialCode));
}

export function isValidLocalPhoneNumberForDialCode(
  dialCode: string,
  localPhoneNumber: string,
): boolean {
  const normalizedLocalNumber = normalizeLocalPhoneDigits(localPhoneNumber);
  if (!normalizedLocalNumber) return false;
  if (dialCode === '+91') return normalizedLocalNumber.length === 10;
  return normalizedLocalNumber.length <= getLocalPhoneDigitLimit(dialCode);
}

export function buildE164PhoneNumber(dialCode: string, localPhoneNumber: string): string {
  const normalizedLocalNumber = limitLocalPhoneDigits(dialCode, localPhoneNumber);
  if (!isValidLocalPhoneNumberForDialCode(dialCode, normalizedLocalNumber)) return '';
  const fullNumber = `${dialCode}${normalizedLocalNumber}`;
  return isValidE164PhoneNumber(fullNumber) ? fullNumber : '';
}

export interface PhoneDialCodeCountry {
  dialCode: string;
}

export interface PhoneNumberHintMatch<TCountry extends PhoneDialCodeCountry> {
  country: TCountry;
  localNumber: string;
}

export function matchPhoneNumberHintToCountry<TCountry extends PhoneDialCodeCountry>(
  phoneNumberHint: string,
  countries: readonly TCountry[],
): PhoneNumberHintMatch<TCountry> | null {
  const trimmedHint = phoneNumberHint.trim();
  if (!trimmedHint.startsWith('+')) return null;

  const normalizedHint = `+${sanitizePhoneDigits(trimmedHint)}`;
  if (!isValidE164PhoneNumber(normalizedHint)) return null;

  let matchedCountry: TCountry | null = null;

  for (const country of countries) {
    if (!normalizedHint.startsWith(country.dialCode)) continue;

    if (!matchedCountry || country.dialCode.length > matchedCountry.dialCode.length) {
      matchedCountry = country;
    }
  }

  if (!matchedCountry) return null;

  const localNumber = limitLocalPhoneDigits(
    matchedCountry.dialCode,
    normalizedHint.slice(matchedCountry.dialCode.length),
  );

  if (!isValidLocalPhoneNumberForDialCode(matchedCountry.dialCode, localNumber)) {
    return null;
  }

  return {
    country: matchedCountry,
    localNumber,
  };
}
