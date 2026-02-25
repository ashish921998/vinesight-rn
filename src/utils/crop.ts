const GRAPE_PATTERN = /\b(grapes?|vitis)\b/i;

export function isGrapeCrop(crop?: string | null, cropVariety?: string | null): boolean {
  return GRAPE_PATTERN.test(crop ?? '') || GRAPE_PATTERN.test(cropVariety ?? '');
}
