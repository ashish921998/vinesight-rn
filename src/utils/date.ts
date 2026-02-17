export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDbDateToLocalDate = (value: string): Date | null => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  // Accept only ISO datetime strings with explicit timezone.
  const isoWithTimezoneMatch =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!isoWithTimezoneMatch) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getDaysAfterPruning = (
  recordDate: string,
  pruningDate: string | null | undefined,
): number | null => {
  if (!pruningDate) return null;

  const record = parseDbDateToLocalDate(recordDate);
  const pruning = parseDbDateToLocalDate(pruningDate);
  if (!record || !pruning) return null;

  const recordDay = Date.UTC(record.getFullYear(), record.getMonth(), record.getDate());
  const pruningDay = Date.UTC(pruning.getFullYear(), pruning.getMonth(), pruning.getDate());
  const diffDays = Math.floor((recordDay - pruningDay) / (24 * 60 * 60 * 1000));

  return diffDays >= 0 ? diffDays : null;
};
