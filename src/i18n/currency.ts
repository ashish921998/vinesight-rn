import * as Localization from 'expo-localization';

const FALLBACK_CURRENCY = 'USD';

function isValidCurrencyCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z]{3}$/.test(code);
}

export function getDefaultCurrency(): string {
  const currencyCode = Localization.getLocales()?.[0]?.currencyCode;

  if (isValidCurrencyCode(currencyCode)) {
    try {
      new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(0);
      return currencyCode;
    } catch {
      // unsupported currency code, fall through
    }
  }

  return FALLBACK_CURRENCY;
}
