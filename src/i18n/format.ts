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

  const includesDateOptions =
    options?.month != null ||
    options?.day != null ||
    options?.year != null ||
    options?.weekday != null ||
    options?.dateStyle != null ||
    options?.era != null;

  if (!includesTime && !includesDateOptions) return formattedDate;

  if (includesDateOptions && !includesTime) {
    return new Intl.DateTimeFormat(getLocaleWithLatinDigits(), {
      numberingSystem: 'latn',
      ...options,
    }).format(d);
  }

  // Use the same timezone for both date and time to ensure consistency
  const timeZone = options?.timeZone;
  const locale = getLocaleWithLatinDigits();

  // When time is included, use the same timezone for date extraction
  // to ensure day/month/year match the time string
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = dateFormatter.formatToParts(d);
  const partMap = new Map(parts.map((p) => [p.type, p.value]));
  const formattedDay = partMap.get('day') || String(d.getUTCDate()).padStart(2, '0');
  const formattedMonth = partMap.get('month') || String(d.getUTCMonth() + 1).padStart(2, '0');
  const formattedYear = partMap.get('year') || String(d.getUTCFullYear());

  const time = new Intl.DateTimeFormat(locale, {
    numberingSystem: 'latn',
    hour: options?.hour ?? '2-digit',
    minute: options?.minute ?? '2-digit',
    second: options?.second,
    hour12: options?.hour12,
    timeZone,
    timeZoneName: options?.timeZoneName,
  }).format(d);

  return `${formattedDay}-${formattedMonth}-${formattedYear} ${time}`;
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
