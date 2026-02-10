import type { PlannedInputItem } from '@/types/task';

const PLAN_MARKER = '[VS_PLAN]';

interface EncodedPlanPayload {
  v: 1;
  items: PlannedInputItem[];
}

export function encodeTaskPlanInDescription(
  description: string | null | undefined,
  items: PlannedInputItem[] | null | undefined,
): string | null {
  const base = (description ?? '').trim();
  const cleaned = stripTaskPlanFromDescription(base);
  const normalizedItems = (items ?? []).filter((item) => item.name.trim());

  if (normalizedItems.length === 0) {
    return cleaned || null;
  }

  const payload: EncodedPlanPayload = { v: 1, items: normalizedItems };
  const encoded = `${PLAN_MARKER}${JSON.stringify(payload)}`;
  if (!cleaned) return encoded;
  return `${cleaned}\n\n${encoded}`;
}

export function stripTaskPlanFromDescription(description: string | null | undefined): string {
  if (!description) return '';
  const markerIndex = description.indexOf(PLAN_MARKER);
  if (markerIndex < 0) return description.trim();
  return description.slice(0, markerIndex).trim();
}

export function decodeTaskPlanFromDescription(
  description: string | null | undefined,
): PlannedInputItem[] {
  if (!description) return [];
  const markerIndex = description.indexOf(PLAN_MARKER);
  if (markerIndex < 0) return [];

  const raw = description.slice(markerIndex + PLAN_MARKER.length).trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Partial<EncodedPlanPayload>;
    if (!parsed || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter((item) => typeof item?.name === 'string' && item.name.trim());
  } catch {
    return [];
  }
}
