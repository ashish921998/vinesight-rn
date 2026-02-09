import * as Localization from 'expo-localization';

const FALLBACK_CURRENCY = 'USD';

function isValidCurrencyCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

let _cached: string | null = null;

export function getDefaultCurrency(): string {
  if (_cached) return _cached;

  const currencyCode = Localization.getLocales()?.[0]?.currencyCode;

  if (isValidCurrencyCode(currencyCode)) {
    try {
      new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(0);
      _cached = currencyCode;
      return currencyCode;
    } catch {
      // unsupported currency code, fall through
    }
  }

  _cached = FALLBACK_CURRENCY;
  return FALLBACK_CURRENCY;
}
