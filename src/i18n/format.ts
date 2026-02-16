import i18n from './index';

function getLocaleWithLatinDigits(): string {
  const lang = i18n.language || 'en';
  let base = 'en-IN';
  if (lang.startsWith('mr')) {
    base = 'mr-IN';
  } else if (lang.startsWith('hi')) {
    base = 'hi-IN';
  } else if (lang.startsWith('en')) {
    base = 'en-IN';
  }
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
  const parseInputDate = (input: Date | string | number): Date => {
    if (input instanceof Date) return input;
    if (typeof input === 'string') {
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
      if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]) - 1;
        const day = Number(dateOnlyMatch[3]);
        return new Date(Date.UTC(year, month, day));
      }
    }
    return new Date(input);
  };

  const d = parseInputDate(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear());
  const formattedDate = `${day}-${month}-${year}`;

  const includesTime =
    options?.hour != null ||
    options?.minute != null ||
    options?.second != null ||
    options?.timeStyle != null;

  if (!includesTime) return formattedDate;

  const time = new Intl.DateTimeFormat(getLocaleWithLatinDigits(), {
    numberingSystem: 'latn',
    hour: options?.hour ?? '2-digit',
    minute: options?.minute ?? '2-digit',
    second: options?.second,
    hour12: options?.hour12,
    timeZone: options?.timeZone,
    timeZoneName: options?.timeZoneName,
  }).format(d);

  return `${formattedDate} ${time}`;
}

export function formatTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(getLocaleWithLatinDigits(), {
    numberingSystem: 'latn',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(d);
}
