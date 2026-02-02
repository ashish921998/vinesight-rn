import i18n from './index';

function getLocaleWithLatinDigits(): string {
  const lang = i18n.language || 'en';
  const base = lang.startsWith('mr') ? 'mr-IN' : lang.startsWith('en') ? 'en-IN' : 'en-IN';
  return `${base}-u-nu-latn`;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocaleWithLatinDigits(), {
    numberingSystem: 'latn',
    ...options,
  }).format(value);
}

export function formatCurrency(
  value: number,
  currency: string,
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>,
): string {
  return new Intl.NumberFormat(getLocaleWithLatinDigits(), {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    ...options,
  }).format(value);
}

export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(getLocaleWithLatinDigits(), {
    numberingSystem: 'latn',
    ...options,
  }).format(d);
}

export function formatTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDate(date, { hour: '2-digit', minute: '2-digit', ...options });
}
